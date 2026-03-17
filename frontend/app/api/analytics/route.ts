import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { hasFeature, normalizePlan } from "@/lib/subscription"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

type Bucket = { label: string; value: number }

function toBuckets(record: Record<string, number>): Bucket[] {
  return Object.entries(record)
    .map(([label, value]) => ({ label, value }))
    .filter((b) => b.value > 0)
}

export async function POST(req: NextRequest) {
  const endpoint = "/api/analytics"
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
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    logApiError({ requestId, endpoint, status: 401, message: "Invalid or missing user", error: userError?.message ?? "no_user" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  logApiRequest({ requestId, endpoint, userId: user.id })
  const body = await req.json().catch(() => ({}))
  const requestedBusinessId = typeof body?.businessId === "string" ? body.businessId : null

  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", user.id)
    .order("id", { ascending: true })

  if (businessesError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load businesses", error: businessesError.message })
    return NextResponse.json({ error: "Failed to load businesses", detail: businessesError.message }, { status: 500 })
  }

  if (!businesses || businesses.length === 0) {
    return NextResponse.json({ businesses: [], selectedBusinessId: null, analytics: null })
  }

  const selectedBusiness = requestedBusinessId
    ? businesses.find((b) => b.id === requestedBusinessId) ?? businesses[0]
    : businesses[0]

  const { data: userRow } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle()

  const resolvedPlan = normalizePlan(userRow?.plan)

  if (!hasFeature(resolvedPlan, "analytics")) {
    logApiError({ requestId, endpoint, userId: user.id, status: 403, message: "Plan does not include analytics", error: "plan_gate", plan: resolvedPlan })
    return NextResponse.json({ error: "Analytics is not included in your current plan" }, { status: 403 })
  }

  const selectedBusinessId = selectedBusiness.id

  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("id, rating, latest_reply_id")
    .eq("business_id", selectedBusinessId)

  if (reviewsError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load reviews", error: reviewsError.message })
    return NextResponse.json({ error: "Failed to load reviews", detail: reviewsError.message }, { status: 500 })
  }

  const reviewIds = (reviews ?? []).map((r) => r.id)

  const { data: replies, error: repliesError } = reviewIds.length
    ? await supabase
        .from("review_replies")
        .select("id, review_id, status, source")
        .in("review_id", reviewIds)
    : { data: [], error: null }

  if (repliesError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load replies", error: repliesError.message })
    return NextResponse.json({ error: "Failed to load replies", detail: repliesError.message }, { status: 500 })
  }

  const { data: analyses, error: analysisError } = reviewIds.length
    ? await supabase
        .from("review_analysis")
        .select("review_id, sentiment")
        .in("review_id", reviewIds)
    : { data: [], error: null }

  if (analysisError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load analysis", error: analysisError.message })
    return NextResponse.json({ error: "Failed to load analysis", detail: analysisError.message }, { status: 500 })
  }

  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider")
    .eq("user_id", user.id)

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)

  const ratingCount = { "1★": 0, "2★": 0, "3★": 0, "4★": 0, "5★": 0 }
  for (const review of reviews ?? []) {
    const rating = Number(review.rating)
    if (rating >= 1 && rating <= 5) {
      ratingCount[`${rating}★` as keyof typeof ratingCount] += 1
    }
  }

  const statusCount = { draft: 0, approved: 0, posted: 0, failed: 0, deleted: 0, none: 0 }
  const replyById = new Map((replies ?? []).map((r) => [r.id, r]))

  for (const review of reviews ?? []) {
    const latest = review.latest_reply_id ? replyById.get(review.latest_reply_id) : undefined
    if (!latest) statusCount.none += 1
    else if (latest.status in statusCount) statusCount[latest.status as keyof typeof statusCount] += 1
  }

  const sourceCount = { ai: 0, user: 0, system: 0 }
  for (const reply of replies ?? []) {
    if (reply.source in sourceCount) {
      sourceCount[reply.source as keyof typeof sourceCount] += 1
    }
  }

  const sentimentCount = { positive: 0, neutral: 0, negative: 0 }
  for (const item of analyses ?? []) {
    const key = (item.sentiment || "").toLowerCase()
    if (key in sentimentCount) {
      sentimentCount[key as keyof typeof sentimentCount] += 1
    }
  }

  const analytics = {
    totals: {
      reviews: reviews?.length ?? 0,
      replies: replies?.length ?? 0,
      analyses: analyses?.length ?? 0,
      businesses: businesses.length,
      integrations: integrations?.length ?? 0,
      plan: subscriptions?.[0]?.plan ?? resolvedPlan,
      subscriptionStatus: subscriptions?.[0]?.status ?? "active",
    },
    charts: {
      ratings: toBuckets(ratingCount),
      replyStatuses: toBuckets(statusCount),
      replySources: toBuckets(sourceCount),
      sentiment: toBuckets(sentimentCount),
    },
  }

  return NextResponse.json({ businesses, selectedBusinessId, analytics })
}
