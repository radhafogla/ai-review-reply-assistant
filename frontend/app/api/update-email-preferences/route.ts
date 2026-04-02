import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

export async function POST(req: NextRequest) {
  const endpoint = "/api/update-email-preferences"
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
  } = await supabase.auth.getUser(token)

  if (userError || !user) {
    logApiError({ requestId, endpoint, status: 401, message: "Invalid or missing user", error: userError?.message ?? "no_user" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  logApiRequest({ requestId, endpoint, userId: user.id })

  const updates: Record<string, boolean> = {}

  if (typeof body.email_negative_review_alerts === "boolean") {
    updates.email_negative_review_alerts = body.email_negative_review_alerts
  }
  if (typeof body.email_weekly_digest === "boolean") {
    updates.email_weekly_digest = body.email_weekly_digest
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid preferences provided" }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", user.id)

  if (updateError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to update email preferences", error: updateError.message })
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(req: NextRequest) {
  const endpoint = "/api/update-email-preferences"
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
  } = await supabase.auth.getUser(token)

  if (userError || !user) {
    logApiError({ requestId, endpoint, status: 401, message: "Invalid or missing user", error: userError?.message ?? "no_user" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("users")
    .select("email_negative_review_alerts, email_weekly_digest")
    .eq("id", user.id)
    .single()

  if (error || !data) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load email preferences", error: error?.message ?? "not_found" })
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 })
  }

  return NextResponse.json({
    email_negative_review_alerts: data.email_negative_review_alerts ?? true,
    email_weekly_digest: data.email_weekly_digest ?? true,
  })
}
