import { createServerClient } from "@/lib/supabaseServerClient"
import { hasFeature, normalizePlan } from "@/lib/subscription"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { trackUsageEvent } from "@/lib/usageTracking"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

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

    const { account_id, location_id, name } = body
  logApiRequest({ requestId, endpoint, userId: user.id, accountId: account_id, locationId: location_id })

    if (!account_id || !location_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle()

    const plan = normalizePlan(userRow?.plan)

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

      if ((count || 0) >= 1) {
        return NextResponse.json(
          { error: "Your plan allows only one connected business. Upgrade to Premium to add more." },
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
          location_id,
          name
        },
        {
          onConflict: "user_id,location_id"
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

    await trackUsageEvent({
      requestId,
      endpoint,
      eventType: "business_connected",
      userId: user.id,
      businessId: data.id,
      metadata: {
        accountId: account_id,
        locationId: location_id,
        plan,
      },
    })

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