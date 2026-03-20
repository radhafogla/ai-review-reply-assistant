import { createServerClient } from "@/lib/supabaseServerClient"
import { getConnectedBusinessLimitExceededMessage, getPlanLimits, hasFeature, normalizePlan } from "@/lib/subscription"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { trackUsageEvent } from "@/lib/usageTracking"
import { inngest } from "@/inngest/client"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const SUPPORTED_PLATFORMS = new Set(["google", "yelp", "facebook"])

function toNullableTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const unique = new Set<string>()

  for (const item of value) {
    if (typeof item === "string" && item.trim().length > 0) {
      unique.add(item.trim())
    }
  }

  return Array.from(unique)
}

export async function POST(req: NextRequest) {
  const endpoint = "/api/save-business"
  const requestId = createRequestId()

  try {
    const authHeader = req.headers.get("Authorization") || ""
    const token = authHeader.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createServerClient(token)
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    const { account_id, external_business_id, platform: rawPlatform, name } = body
    const primaryCategory = toNullableTrimmedString(body?.primary_category)
    const additionalCategories = toStringArray(body?.additional_categories)
    const platform = typeof rawPlatform === "string" ? rawPlatform.toLowerCase() : "google"
    logApiRequest({ requestId, endpoint, userId: user.id, accountId: account_id, locationId: external_business_id })

    if (!account_id || !external_business_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (!SUPPORTED_PLATFORMS.has(platform)) {
      return NextResponse.json(
        { error: "Unsupported platform" },
        { status: 400 }
      )
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle()

    const plan = normalizePlan(userRow?.plan)
    const connectedBusinessLimit = getPlanLimits(plan).connectedBusinesses

    if (!hasFeature(plan, "multiBusiness")) {
      const { count, error: countError } = await supabase
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)

      if (countError) {
        return NextResponse.json(
          { error: countError.message },
          { status: 500 }
        )
      }

      if ((count || 0) >= connectedBusinessLimit) {
        return NextResponse.json(
          { error: getConnectedBusinessLimitExceededMessage(connectedBusinessLimit) },
          { status: 403 }
        )
      }
    }

    const { data, error } = await supabase
      .from("businesses")
      .upsert(
        {
          user_id: user.id,
          account_id,
          external_business_id,
          name,
          platform,
          primary_category: primaryCategory,
          additional_categories: additionalCategories,
        },
        {
          onConflict: "user_id,external_business_id,platform"
        }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    const { error: membershipError } = await supabase
      .from("business_members")
      .upsert(
        {
          business_id: data.id,
          user_id: user.id,
          role: "owner",
          status: "active",
        },
        {
          onConflict: "business_id,user_id"
        }
      )

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 }
      )
    }

    await trackUsageEvent({
      requestId,
      endpoint,
      eventType: "business_connected",
      userId: user.id,
      businessId: data.id,
      metadata: {
        accountId: account_id,
        locationId: external_business_id,
        plan,
      },
    })

    // Trigger initial review sync for Google locations (best-effort; don't fail save on queue error)
    if (platform === "google") {
      inngest
        .send({ name: "reviews/sync.requested", data: { businessId: data.id, userId: user.id } })
        .catch(() => { /* non-critical: Inngest will pick it up on next scheduled run if this fails */ })
    }

    return NextResponse.json({
      success: true,
      business: data
    })

  } catch (err) {
    logApiError({
      requestId,
      endpoint,
      status: 500,
      message: "Failed to save business",
      error: err,
    })

    return NextResponse.json(
      { error: "Failed to save business" },
      { status: 500 }
    )

  }
}