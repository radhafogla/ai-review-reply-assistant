import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabaseServerClient"
import { getMonthRangeUtc } from "@/lib/subscription"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

const SUPPORTED_EVENTS = [
  "reply_generated",
  "reply_posted",
  "reviews_synced",
  "subscription_changed",
  "auto_reply_attempted",
  "auto_reply_posted",
  "auto_reply_failed",
  "limit_warning_shown",
] as const

export async function GET(req: NextRequest) {
  const endpoint = "/api/analytics/internal"
  const requestId = createRequestId()

  const adminKey = req.headers.get("x-admin-key")?.trim()
  const expectedAdminKey = process.env.INTERNAL_ANALYTICS_ADMIN_KEY?.trim()

  if (!expectedAdminKey || !adminKey || adminKey !== expectedAdminKey) {
    logApiError({ requestId, endpoint, status: 401, message: "Invalid admin key", error: "unauthorized_internal" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { monthStartIso, nextMonthStartIso } = getMonthRangeUtc()
  const supabase = createServiceClient()

  const { data: eventRows, error } = await supabase
    .from("usage_events")
    .select("event_type")
    .gte("occurred_at", monthStartIso)
    .lt("occurred_at", nextMonthStartIso)

  if (error) {
    logApiError({ requestId, endpoint, status: 500, message: "Failed loading usage events", error: error.message })
    return NextResponse.json({ error: "Failed loading usage events" }, { status: 500 })
  }

  const counts = Object.fromEntries(SUPPORTED_EVENTS.map((event) => [event, 0])) as Record<string, number>
  for (const row of eventRows ?? []) {
    const key = String(row.event_type)
    counts[key] = (counts[key] ?? 0) + 1
  }

  const [{ count: activeUsers }, { count: businesses }, { count: premiumUsers }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("businesses").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("plan", "premium"),
  ])

  logApiRequest({ requestId, endpoint, message: "Fetched internal usage analytics" })

  return NextResponse.json({
    monthStartIso,
    nextMonthStartIso,
    totals: {
      activeUsers: activeUsers ?? 0,
      businesses: businesses ?? 0,
      premiumUsers: premiumUsers ?? 0,
    },
    events: counts,
  })
}
