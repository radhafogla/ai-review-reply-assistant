import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { createServerClient, createServiceClient } from "@/lib/supabaseServerClient";
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger";
import { trackUsageEvent } from "@/lib/usageTracking";
import { getReplyTonePromptGuidance, normalizeReplyTone, resolveAdaptiveReplyTone, buildReplyPrompt } from "@/lib/replyTone";
import { requireTrialOrPaidAccess } from "@/lib/subscriptionAccess";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Auto-generate a reply for a review without counting towards the attempt limit.
 * This provides one free attempt per review on dashboard load.
 * Does NOT increment ai_reply_attempts.
 */
export async function POST(req: NextRequest) {
  const endpoint = "/api/auto-generate-reply";
  const requestId = createRequestId();
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    logApiError({
      requestId,
      endpoint,
      status: 401,
      message: "Missing bearer token",
      error: "missing_token",
    });
    return NextResponse.json({ error: "Unauthorized", reason: "missing_token" }, { status: 401 });
  }

  const supabase = await createServerClient(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    logApiError({
      requestId,
      endpoint,
      status: 401,
      message: "Invalid token",
      error: userError.message,
    });
    return NextResponse.json(
      { error: "Unauthorized", reason: "invalid_token", detail: userError.message },
      { status: 401 },
    );
  }

  if (!user) {
    logApiError({
      requestId,
      endpoint,
      status: 401,
      message: "No user in session",
      error: "no_user",
    });
    return NextResponse.json({ error: "Unauthorized", reason: "no_user" }, { status: 401 });
  }

  const accessCheck = await requireTrialOrPaidAccess(user.id, supabase);
  if (accessCheck.response) {
    return accessCheck.response;
  }

  const { reviewId, review_text, rating } = await req.json();
  logApiRequest({ requestId, endpoint, userId: user.id, reviewId });

  const { data: reviewRow, error: reviewError } = await supabase
    .from("reviews")
    .select("id, business_id, latest_reply_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewError || !reviewRow?.business_id) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      status: 404,
      message: "Review not found before auto-generate-reply",
      error: reviewError?.message ?? "review_not_found",
      reviewId,
    });
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Only auto-generate if no reply exists yet — silently skip if one already exists
  if (reviewRow.latest_reply_id) {
    return NextResponse.json({ skipped: true, reason: "reply_already_exists" });
  }

  const serviceSupabase = createServiceClient();

  const { data: businessRow } = await supabase
    .from("businesses")
    .select("reply_tone")
    .eq("id", reviewRow.business_id)
    .maybeSingle();

  const { data: latestAnalysis } = await supabase
    .from("review_analysis")
    .select("sentiment")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseTone = normalizeReplyTone(businessRow?.reply_tone);
  const effectiveTone = resolveAdaptiveReplyTone({
    baseTone,
    sentiment: latestAnalysis?.sentiment,
    rating: Number(rating),
  });

  const toneInstruction = getReplyTonePromptGuidance(effectiveTone);
  const prompt = buildReplyPrompt({
    rating,
    reviewText: review_text,
    toneInstruction,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const reply = completion.choices[0]?.message?.content || "";

    if (!reply?.trim()) {
      logApiError({
        requestId,
        endpoint,
        userId: user.id,
        status: 500,
        message: "OpenAI returned empty completion",
        error: "empty_completion",
        reviewId,
      });
      return NextResponse.json(
        { error: "Failed to generate reply", reason: "empty_completion" },
        { status: 500 },
      );
    }

    // Create new reply (dashboard already ensured latest_reply === null)
    const { data: insertedReply, error: insertError } = await serviceSupabase
      .from("review_replies")
      .insert({
        review_id: reviewId,
        user_id: user.id,
        reply_text: reply,
        tone_base: baseTone,
        tone_effective: effectiveTone,
        tone_adapted: effectiveTone !== baseTone,
        source: "ai",
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError) {
      logApiError({
        requestId,
        endpoint,
        userId: user.id,
        status: 500,
        message: "Failed creating AI reply",
        error: insertError.message,
        reviewId,
      });
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { error: pointerError } = await serviceSupabase
      .from("reviews")
      .update({ latest_reply_id: insertedReply.id })
      .eq("id", reviewId);

    if (pointerError) {
      logApiError({
        requestId,
        endpoint,
        userId: user.id,
        status: 500,
        message: "Failed updating review with latest reply id",
        error: pointerError.message,
        reviewId,
      });
      return NextResponse.json({ error: pointerError.message }, { status: 500 });
    }

    logApiRequest({
      requestId,
      endpoint,
      userId: user.id,
      reviewId,
      latestReplyId: insertedReply.id,
    });

    await trackUsageEvent({
      requestId,
      endpoint,
      eventType: "reply_generated",
      userId: user.id,
      reviewId,
      metadata: { rating, source: "ai", mode: "auto_generate_free", tone: effectiveTone },
    });

    // NOTE: Do NOT increment ai_reply_attempts for free auto-generation
    // This is intentionally skipped to provide one free attempt per review

    return NextResponse.json({
      reply,
      tone: {
        base: baseTone,
        effective: effectiveTone,
        adapted: effectiveTone !== baseTone,
      },
    });
  } catch (error) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      status: 500,
      message: "OpenAI error during auto-generate-reply",
      error: error instanceof Error ? error.message : String(error),
      reviewId,
    });

    return NextResponse.json(
      { error: "Failed to generate reply", reason: "openai_error" },
      { status: 500 },
    );
  }
}
