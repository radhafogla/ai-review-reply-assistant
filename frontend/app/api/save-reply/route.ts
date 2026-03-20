import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabaseServerClient";
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger";
import { trackUsageEvent } from "@/lib/usageTracking";
import { assertBusinessRole } from "@/lib/businessAccess";

export async function POST(req: NextRequest) {
  const endpoint = "/api/save-reply"
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

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id, business_id")
    .eq("id", reviewId)
    .maybeSingle()

  if (reviewError || !review?.business_id) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 })
  }

  const access = await assertBusinessRole(user.id, review.business_id, supabase, "responder")
  if (access.error) {
    logApiError({ requestId, endpoint, userId: user.id, status: 403, message: "Insufficient business role for save-reply", error: access.error, reviewId, businessId: review.business_id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const serviceSupabase = createServiceClient();

  const { data: userDraft, error: userDraftError } = await supabase
    .from("review_replies")
    .select("id")
    .eq("review_id", reviewId)
    .eq("status", "draft")
    .eq("source", "user")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (userDraftError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load existing user draft", error: userDraftError, reviewId })
    return NextResponse.json({ error: userDraftError.message }, { status: 500 })
  }

  if (userDraft) {
    const { error: updateError } = await supabase
      .from("review_replies")
      .update({
        reply_text: replyText,
        tone_base: null,
        tone_effective: null,
        tone_adapted: false,
        source: "user",
      })
      .eq("id", userDraft.id);

    if (updateError) {
      logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to update draft reply", error: updateError, reviewId })
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const { error: pointerError } = await serviceSupabase
      .from("reviews")
      .update({ latest_reply_id: userDraft.id })
      .eq("id", reviewId);

    if (pointerError) {
      logApiError({
        requestId,
        endpoint,
        userId: user.id,
        status: 500,
        message: "Failed to update latest_reply_id pointer after user draft update (non-blocking)",
        error: pointerError,
        reviewId,
        latestReplyId: userDraft.id,
      })
    }
  } else {
    // Also check failed rows — post-reply failure previously marked drafts as failed,
    // so we should reuse those rows rather than inserting and hitting the unique constraint.
    const { data: latestDraft, error: latestDraftError } = await supabase
      .from("review_replies")
      .select("id")
      .eq("review_id", reviewId)
      .in("status", ["draft", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestDraftError) {
      logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load latest draft reply", error: latestDraftError, reviewId })
      return NextResponse.json({ error: latestDraftError.message }, { status: 500 })
    }

    if (latestDraft) {
      const { error: updateError } = await supabase
        .from("review_replies")
        .update({
          reply_text: replyText,
          tone_base: null,
          tone_effective: null,
          tone_adapted: false,
          source: "user",
          status: "draft",
        })
        .eq("id", latestDraft.id)

      if (updateError) {
        logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to update latest draft reply", error: updateError, reviewId })
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      const { error: pointerError } = await serviceSupabase
        .from("reviews")
        .update({ latest_reply_id: latestDraft.id })
        .eq("id", reviewId);

      if (pointerError) {
        logApiError({
          requestId,
          endpoint,
          userId: user.id,
          status: 500,
          message: "Failed to update latest_reply_id pointer after latest draft update (non-blocking)",
          error: pointerError,
          reviewId,
          latestReplyId: latestDraft.id,
        })
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("review_replies")
        .insert({
          review_id: reviewId,
          user_id: user.id,
          reply_text: replyText,
          tone_base: null,
          tone_effective: null,
          tone_adapted: false,
          source: "user",
          status: "draft",
        })
        .select()
        .single();

      if (insertError || !data) {
        logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to create draft reply", error: insertError ?? "no_inserted_row", reviewId })
        return NextResponse.json({ error: insertError?.message ?? "Failed to create draft reply" }, { status: 500 })
      }

      const { error: pointerError } = await serviceSupabase
        .from("reviews")
        .update({ latest_reply_id: data.id })
        .eq("id", reviewId);

      if (pointerError) {
        logApiError({
          requestId,
          endpoint,
          userId: user.id,
          status: 500,
          message: "Failed to update latest_reply_id pointer after draft insert (non-blocking)",
          error: pointerError,
          reviewId,
          latestReplyId: data.id,
        })
      }
    }
  }

  await trackUsageEvent({
    requestId,
    endpoint,
    eventType: "reply_saved",
    userId: user.id,
    reviewId,
    metadata: { source: "user", replyLength: String(replyText ?? "").trim().length },
  })

  return NextResponse.json({ success: true });
}
