import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabaseServerClient";
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger";
import { trackUsageEvent } from "@/lib/usageTracking";

export async function POST(req: NextRequest) {
  const endpoint = "/api/post-reply"
  const requestId = createRequestId()
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace("Bearer ", "")

  if (!token) {
    logApiError({ requestId, endpoint, status: 401, message: "Missing bearer token", error: "missing_token" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerClient(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    logApiError({ requestId, endpoint, status: 401, message: "No user in session", error: "no_user" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reviewId, replyText } = await req.json();
  logApiRequest({ requestId, endpoint, userId: user.id, reviewId });
  const serviceSupabase = createServiceClient();
  const { data: review, error } = await supabase
    .from("reviews")
    .select(
      `*,
      businesses (
        account_id,
        location_id
      )
    `,
    )
    .eq("id", reviewId)
    .single();

  if (error || !review || !review.businesses) {
    logApiError({ requestId, endpoint, userId: user.id, status: 404, message: "Review not found or missing business", error: error?.message ?? "not_found", reviewId })
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const business = review.businesses;
  const accountId = business?.account_id;
  const locationId = business?.location_id;
  const googleReviewId = review.review_id;

  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${googleReviewId}/reply`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      comment: replyText,
    }),
  });

  if (!res.ok) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Google API rejected reply", error: `Google ${res.status}`, reviewId })
    // Only mark the specific draft/failed row as failed — not all rows for this review
    const { data: draftToFail } = await supabase
      .from("review_replies")
      .select("id")
      .eq("review_id", reviewId)
      .in("status", ["draft", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (draftToFail) {
      await supabase
        .from("review_replies")
        .update({ status: "failed" })
        .eq("id", draftToFail.id)
    }

    return NextResponse.json(
      { error: "Failed to post reply" },
      { status: 500 },
    );
  }

  const trimmedReplyText = String(replyText ?? "").trim()

  const { data: latestReply, error: latestReplyError } = await supabase
    .from("review_replies")
    .select("id, reply_text, source, status")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestReplyError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load latest reply before posting", error: latestReplyError, reviewId })
    return NextResponse.json({ error: latestReplyError.message }, { status: 500 })
  }

  const persistedSource = latestReply?.reply_text?.trim() === trimmedReplyText
    ? latestReply.source
    : "user"

  let persistedReply: { id: string; source: "ai" | "user" } | null = null

  if (latestReply && (latestReply.status === "draft" || latestReply.status === "failed")) {
    const { data: updatedReply, error: updateError } = await supabase
      .from("review_replies")
      .update({
        reply_text: replyText,
        source: persistedSource,
        status: "posted",
        posted_at: new Date().toISOString(),
      })
      .eq("id", latestReply.id)
      .select("id, source")
      .single()

    if (updateError || !updatedReply) {
      logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to update draft reply before posting", error: updateError ?? "no_updated_row", reviewId })
      return NextResponse.json({ error: updateError?.message ?? "Failed to update reply" }, { status: 500 })
    }

    persistedReply = updatedReply
  } else {
    const { data: insertedReply, error: insertError } = await supabase
      .from("review_replies")
      .insert({
        review_id: reviewId,
        user_id: user.id,
        reply_text: replyText,
        source: persistedSource,
        status: "posted",
        posted_at: new Date().toISOString(),
      })
      .select("id, source")
      .single()

    if (insertError || !insertedReply) {
      logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to save posted reply", error: insertError ?? "no_inserted_row", reviewId })
      return NextResponse.json({ error: insertError?.message ?? "Failed to save reply" }, { status: 500 })
    }

    persistedReply = insertedReply
  }

  await serviceSupabase
    .from("reviews")
    .update({ latest_reply_id: persistedReply.id })
    .eq("id", reviewId);

  await trackUsageEvent({
    requestId,
    endpoint,
    eventType: "reply_posted",
    userId: user.id,
    reviewId,
    metadata: { source: persistedReply.source, replyLength: trimmedReplyText.length },
  })

  return NextResponse.json({
    success: true,
    reply: {
      id: persistedReply.id,
      replyText,
      source: persistedReply.source,
      status: "posted",
    },
  });
}
