import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { hasFeature, normalizePlan } from "@/lib/subscription"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { requireTrialOrPaidAccess } from "@/lib/subscriptionAccess"

export async function GET(req: NextRequest) {
  const endpoint = "/api/sentiment-cache"
  const requestId = createRequestId()
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    logApiError({ requestId, endpoint, status: 401, message: "Missing bearer token", error: "missing_token" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerClient(token)
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    logApiError({
      requestId,
      endpoint,
      status: 401,
      message: "Invalid token",
      error: userError?.message ?? "no_user"
    })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessCheck = await requireTrialOrPaidAccess(user.id, supabase)
  if (accessCheck.response) {
    return accessCheck.response
  }

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get("businessId")

  if (!businessId) {
    logApiError({ requestId, endpoint, userId: user.id, status: 400, message: "Missing businessId", error: "missing_businessId" })
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
  }

  // Verify business ownership
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (businessError || !business) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      status: 403,
      message: "Business not found",
      error: businessError?.message ?? "not_found"
    })
    return NextResponse.json({ error: "Not found" }, { status: 403 })
  }

  // Get user plan for feature gating
  const { data: userRow } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle()

  const userPlan = normalizePlan(userRow?.plan)
  const canUsePremium = hasFeature(userPlan, "advancedAnalytics")

  logApiRequest({ requestId, endpoint, userId: user.id, businessId })

  try {
    // Get latest cache
    const { data: cache, error: cacheError } = await supabase
      .from("sentiment_cache")
      .select("*")
      .eq("business_id", businessId)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cacheError) {
      logApiError({
        requestId,
        endpoint,
        userId: user.id,
        businessId,
        status: 500,
        message: "Failed to fetch cache",
        error: cacheError.message
      })
      return NextResponse.json({ error: "Failed to fetch cache" }, { status: 500 })
    }

    if (!cache) {
      return NextResponse.json({ error: "No analysis available" }, { status: 404 })
    }

    return NextResponse.json({
      sentiment_positive: cache.sentiment_positive,
      sentiment_neutral: cache.sentiment_neutral,
      sentiment_negative: cache.sentiment_negative,
      analyzed_review_count: cache.analyzed_review_count,
      analyzed_at: cache.analyzed_at,
      themes: canUsePremium ? cache.themes : {},
      suggestions: canUsePremium ? cache.suggestions : {},
      sentiment_trend_by_day: canUsePremium ? cache.sentiment_trend_by_day : {}
    })
  } catch (err) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      businessId,
      status: 500,
      message: "Error fetching sentiment cache",
      error: err instanceof Error ? err.message : String(err)
    })
    return NextResponse.json({ error: "Failed to fetch cache" }, { status: 500 })
  }
}
