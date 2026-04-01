import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { assertBusinessRole } from "@/lib/businessAccess"
import { requireTrialOrPaidAccess } from "@/lib/subscriptionAccess"

export async function POST(req: NextRequest) {
  const endpoint = "/api/dismiss-review"
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

  const accessCheck = await requireTrialOrPaidAccess(user.id, supabase)
  if (accessCheck.response) {
    return accessCheck.response
  }

  const { reviewId, undismiss } = await req.json().catch(() => ({}))
  logApiRequest({ requestId, endpoint, userId: user.id, reviewId })

  if (!reviewId || typeof reviewId !== "string") {
    return NextResponse.json({ error: "Missing reviewId" }, { status: 400 })
  }

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id, business_id, latest_reply_id, latest_reply:review_replies!reviews_latest_reply_id_fkey(id, status)")
    .eq("id", reviewId)
    .single()

  if (reviewError || !review) {
    logApiError({ requestId, endpoint, userId: user.id, status: 404, message: "Review not found", error: reviewError?.message ?? "not_found", reviewId })
    return NextResponse.json({ error: "Review not found" }, { status: 404 })
  }

  const access = await assertBusinessRole(user.id, review.business_id, supabase, "responder")
  if (access.error) {
    logApiError({ requestId, endpoint, userId: user.id, status: 403, message: "Insufficient business role", error: access.error, reviewId, businessId: review.business_id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const latestReply = Array.isArray(review.latest_reply) ? review.latest_reply[0] : review.latest_reply

  if (undismiss) {
    // Restore dismissed review → back to Needs Attention
    if (!latestReply?.id) {
      return NextResponse.json({ error: "No reply to restore" }, { status: 400 })
    }
    const { error: restoreError } = await supabase
      .from("review_replies")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", latestReply.id)
      .eq("status", "dismissed")

    if (restoreError) {
      logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to restore reply", error: restoreError.message, reviewId })
      return NextResponse.json({ error: "Failed to restore review" }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  if (latestReply?.id) {
    // Existing reply (draft/failed) — mark it dismissed
    const { error: updateError } = await supabase
      .from("review_replies")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", latestReply.id)

    if (updateError) {
      logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to update reply status", error: updateError.message, reviewId })
      return NextResponse.json({ error: "Failed to dismiss review" }, { status: 500 })
    }
  } else {
    // No reply record yet — insert a dismissed placeholder
    const { error: insertError } = await supabase
      .from("review_replies")
      .insert({
        review_id: reviewId,
        reply_text: "",
        source: "system",
        status: "dismissed",
        user_id: user.id,
      })

    if (insertError) {
      logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to insert dismissed reply", error: insertError.message, reviewId })
      return NextResponse.json({ error: "Failed to dismiss review" }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
