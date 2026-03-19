import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

export async function POST(req: NextRequest) {
  const endpoint = "/api/delete-reply"
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

  const { reviewId } = await req.json().catch(() => ({}))
  logApiRequest({ requestId, endpoint, userId: user.id, reviewId })

  if (!reviewId || typeof reviewId !== "string") {
    return NextResponse.json({ error: "Missing reviewId" }, { status: 400 })
  }

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select(`
      id,
      review_id,
      latest_reply_id,
        businesses (
          account_id,
          external_business_id
        ),
      latest_reply:review_replies!reviews_latest_reply_id_fkey (
        id,
        reply_text,
        source,
        status
      )
    `)
    .eq("id", reviewId)
    .single()

  if (reviewError || !review) {
    logApiError({ requestId, endpoint, userId: user.id, status: 404, message: "Review not found", error: reviewError?.message ?? "not_found", reviewId })
    return NextResponse.json({ error: "Review not found" }, { status: 404 })
  }

  const business = Array.isArray(review.businesses) ? review.businesses[0] : review.businesses
  const latestReply = Array.isArray(review.latest_reply) ? review.latest_reply[0] : review.latest_reply

  if (!business?.account_id || !business?.external_business_id || !review.review_id) {
    return NextResponse.json({ error: "Review is missing Google mapping" }, { status: 400 })
  }
  if (!latestReply?.id || latestReply.status !== "posted") {
    return NextResponse.json({ error: "Only posted replies can be deleted" }, { status: 400 })
  }

  const url = `https://mybusiness.googleapis.com/v4/accounts/${business.account_id}/locations/${business.external_business_id}/reviews/${review.review_id}/reply`

  const googleRes = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!googleRes.ok) {
    const detail = await googleRes.text().catch(() => "")
    return NextResponse.json({ error: "Failed to delete reply from Google", detail }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from("review_replies")
    .update({
      status: "deleted",
      posted_to_google: false,
    })
    .eq("id", latestReply.id)

  if (updateError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to mark reply as deleted", error: updateError, reviewId })
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    replyId: latestReply.id,
    replyText: latestReply.reply_text,
  })
}