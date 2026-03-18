import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { PREMIUM_AUTO_REPLY_DEFAULT_MIN_RATING, getFeatureGateApiMessage, hasFeature, normalizePlan } from "@/lib/subscription"

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
  const endpoint = "/api/premium-auto-reply"
  const requestId = createRequestId()
  const auth = await getAuthedUser(req)

  if ("error" in auth) {
    logApiError({ requestId, endpoint, status: 401, message: "Auth failed", error: "unauthorized" })
    return auth.error
  }

  const { user, supabase } = auth
  logApiRequest({ requestId, endpoint, userId: user.id })

  const { data: userRow, error } = await supabase
    .from("users")
    .select("plan, premium_auto_reply_enabled, premium_auto_reply_min_rating")
    .eq("id", user.id)
    .maybeSingle()

  if (error || !userRow) {
    return NextResponse.json({ error: error?.message || "User not found" }, { status: 500 })
  }

  const plan = normalizePlan(userRow.plan)

  return NextResponse.json({
    plan,
    available: hasFeature(plan, "premiumAutoReply"),
    enabled: Boolean(userRow.premium_auto_reply_enabled),
    minRating: Number(userRow.premium_auto_reply_min_rating || PREMIUM_AUTO_REPLY_DEFAULT_MIN_RATING),
  })
}

export async function POST(req: NextRequest) {
  const endpoint = "/api/premium-auto-reply"
  const requestId = createRequestId()
  const auth = await getAuthedUser(req)

  if ("error" in auth) {
    logApiError({ requestId, endpoint, status: 401, message: "Auth failed", error: "unauthorized" })
    return auth.error
  }

  const { user, supabase } = auth
  const body = await req.json().catch(() => ({}))
  const enabled = body?.enabled === true
  const minRating = Math.min(5, Math.max(1, Number(body?.minRating ?? PREMIUM_AUTO_REPLY_DEFAULT_MIN_RATING)))

  const { data: planRow } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle()

  const plan = normalizePlan(planRow?.plan)

  if (!hasFeature(plan, "premiumAutoReply")) {
    return NextResponse.json(
      { error: getFeatureGateApiMessage("premiumAutoReply") },
      { status: 403 },
    )
  }

  const { error } = await supabase
    .from("users")
    .update({
      premium_auto_reply_enabled: enabled,
      premium_auto_reply_min_rating: minRating,
    })
    .eq("id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logApiRequest({ requestId, endpoint, userId: user.id, enabled, minRating })

  return NextResponse.json({ success: true, enabled, minRating })
}
