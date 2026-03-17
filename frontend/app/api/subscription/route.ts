import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { normalizePlan } from "@/lib/subscription"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { trackUsageEvent } from "@/lib/usageTracking"

async function getAuthedUser(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const supabase = await createServerClient(token)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  return { user, supabase }
}

export async function GET(req: NextRequest) {
  const endpoint = "/api/subscription"
  const requestId = createRequestId()
  const auth = await getAuthedUser(req)
  if ("error" in auth) {
    logApiError({ requestId, endpoint, status: 401, message: "Auth failed", error: "unauthorized" })
    return auth.error
  }

  const { user, supabase } = auth
  logApiRequest({ requestId, endpoint, userId: user.id })

  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: userRow } = await supabase
    .from("users")
    .select("plan, trial_end")
    .eq("id", user.id)
    .maybeSingle()

  const resolvedPlan = normalizePlan(subscriptionRow?.plan || userRow?.plan)
  const status = typeof subscriptionRow?.status === "string" ? subscriptionRow.status : "active"

  if (!subscriptionRow) {
    await supabase
      .from("subscriptions")
      .insert({
        user_id: user.id,
        plan: resolvedPlan,
        status: "active",
      })
  }

  const trialEnd = userRow?.trial_end || null
  const trialMsLeft = trialEnd ? new Date(trialEnd).getTime() - Date.now() : null
  const trialExpired = trialMsLeft !== null ? trialMsLeft <= 0 : false
  const trialDaysRemaining =
    trialMsLeft !== null
      ? Math.max(0, Math.ceil(trialMsLeft / (1000 * 60 * 60 * 24)))
      : null

  return NextResponse.json({
    plan: resolvedPlan,
    status,
    trialEnd,
    trialExpired,
    trialDaysRemaining,
  })
}

export async function POST(req: NextRequest) {
  const endpoint = "/api/subscription"
  const requestId = createRequestId()
  const auth = await getAuthedUser(req)
  if ("error" in auth) {
    logApiError({ requestId, endpoint, status: 401, message: "Auth failed", error: "unauthorized" })
    return auth.error
  }

  const { user, supabase } = auth
  const body = await req.json().catch(() => ({}))
  logApiRequest({ requestId, endpoint, userId: user.id, plan: body?.plan })
  const plan = normalizePlan(body?.plan)

  const { data: currentUserRow } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle()

  const previousPlan = normalizePlan(currentUserRow?.plan)

  const { error: userPlanError } = await supabase
    .from("users")
    .update({ plan })
    .eq("id", user.id)

  if (userPlanError) {
    return NextResponse.json({ error: userPlanError.message }, { status: 500 })
  }

  const { error: deactivateError } = await supabase
    .from("subscriptions")
    .update({ status: "inactive", ends_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "active")

  if (deactivateError) {
    return NextResponse.json({ error: deactivateError.message }, { status: 500 })
  }

  const { error: insertError } = await supabase
    .from("subscriptions")
    .insert({
      user_id: user.id,
      plan,
      status: "active",
      started_at: new Date().toISOString(),
      ends_at: null,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("trial_end")
    .eq("id", user.id)
    .maybeSingle()

  const trialEnd = userRow?.trial_end || null
  const trialMsLeft = trialEnd ? new Date(trialEnd).getTime() - Date.now() : null
  const trialExpired = trialMsLeft !== null ? trialMsLeft <= 0 : false
  const trialDaysRemaining =
    trialMsLeft !== null
      ? Math.max(0, Math.ceil(trialMsLeft / (1000 * 60 * 60 * 24)))
      : null

  await trackUsageEvent({
    requestId,
    endpoint,
    eventType: "subscription_changed",
    userId: user.id,
    metadata: {
      fromPlan: previousPlan,
      toPlan: plan,
      trialExpired,
      trialDaysRemaining,
    },
  })

  return NextResponse.json({
    success: true,
    plan,
    status: "active",
    trialEnd,
    trialExpired,
    trialDaysRemaining,
  })
}