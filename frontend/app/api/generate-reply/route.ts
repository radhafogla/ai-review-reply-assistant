import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { createServerClient, createServiceClient } from "@/lib/supabaseServerClient";
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger";
import { trackUsageEvent } from "@/lib/usageTracking";
import { getReplyTonePromptGuidance, normalizeReplyTone, resolveAdaptiveReplyTone } from "@/lib/replyTone";
import { assertBusinessRole } from "@/lib/businessAccess";

const MAX_GENERATIONS_PER_REVIEW = 5;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  const endpoint = "/api/generate-reply";
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

  const { reviewId, review_text, rating } = await req.json();
  logApiRequest({ requestId, endpoint, userId: user.id, reviewId });

  const { data: reviewRow, error: reviewError } = await supabase
    .from("reviews")
    .select("id, business_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewError || !reviewRow?.business_id) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      status: 404,
      message: "Review not found before generate-reply",
      error: reviewError?.message ?? "review_not_found",
      reviewId,
    });
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const access = await assertBusinessRole(user.id, reviewRow.business_id, supabase, "responder")
  if (access.error) {
    logApiError({ requestId, endpoint, userId: user.id, status: 403, message: "Insufficient business role for generate-reply", error: access.error, reviewId, businessId: reviewRow.business_id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const serviceSupabase = createServiceClient();

  const { data: reviewForLimit } = await supabase
    .from("reviews")
    .select("ai_reply_attempts")
    .eq("id", reviewId)
    .single();

  const usedGenerationsForReview = reviewForLimit?.ai_reply_attempts ?? 0;

  if (usedGenerationsForReview >= MAX_GENERATIONS_PER_REVIEW) {
    await trackUsageEvent({
      requestId,
      endpoint,
      eventType: "limit_warning_shown",
      userId: user.id,
      reviewId,
      metadata: {
        limitKey: "perReviewAiGenerations",
        used: usedGenerationsForReview,
        limit: MAX_GENERATIONS_PER_REVIEW,
        percentUsed: 100,
        severity: "warning",
        blocked: true,
      },
    });

    return NextResponse.json(
      {
        error: "Per-review AI generation limit reached",
        reason: "per_review_generation_limit_reached",
        used: usedGenerationsForReview,
        limit: MAX_GENERATIONS_PER_REVIEW,
      },
      { status: 429 },
    );
  }

  let baseTone = normalizeReplyTone(null);
  let effectiveTone = baseTone;
  let toneInstruction = getReplyTonePromptGuidance(effectiveTone);

  if (reviewRow?.business_id) {
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

    baseTone = normalizeReplyTone(businessRow?.reply_tone);
    effectiveTone = resolveAdaptiveReplyTone({
      baseTone,
      sentiment: latestAnalysis?.sentiment,
      rating: Number(rating),
    });
    toneInstruction = getReplyTonePromptGuidance(effectiveTone);
  }

  const prompt = `
You are replying to a Google review as a business owner.

Rating: ${rating} stars
Review: "${review_text}"
${toneInstruction}

Write a professional and friendly reply under 80 words. You dont need to address/greet the user or add regards at the end. Just the message itself is good.
Make it sound human and conversational, not robotic or overly formal. Use natural everyday wording, avoid generic corporate phrases, and acknowledge one concrete detail from the review when possible.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const reply = completion.choices[0].message.content;

  const { data: existingDrafts, error: existingDraftsError } = await supabase
    .from("review_replies")
    .select("id")
    .eq("review_id", reviewId)
    .eq("source", "ai")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingDraftsError) {
    return NextResponse.json({ error: existingDraftsError.message }, { status: 500 });
  }

  const latestDraftId = existingDrafts?.[0]?.id;

  if (latestDraftId) {
    const { data: updatedReply, error: updateError } = await supabase
      .from("review_replies")
      .update({
        reply_text: reply,
        tone_base: baseTone,
        tone_effective: effectiveTone,
        tone_adapted: effectiveTone !== baseTone,
      })
      .eq("id", latestDraftId)
      .select("id")
      .single();

    if (updateError) {
      logApiError({
        requestId,
        endpoint,
        userId: user.id,
        status: 500,
        message: "Failed updating existing AI draft",
        error: updateError,
        reviewId,
      });
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: pointerError } = await serviceSupabase
      .from("reviews")
      .update({ latest_reply_id: updatedReply.id })
      .eq("id", reviewId);

    if (pointerError) {
      logApiError({
        requestId,
        endpoint,
        userId: user.id,
        status: 500,
        message: "Failed to update latest_reply_id pointer after AI draft update (non-blocking)",
        error: pointerError,
        reviewId,
        latestReplyId: updatedReply.id,
      })
    }

    await trackUsageEvent({
      requestId,
      endpoint,
      eventType: "reply_generated",
      userId: user.id,
      reviewId,
      metadata: { rating, source: "ai", mode: "update_existing_draft", tone: effectiveTone },
    })

    await serviceSupabase
      .from("reviews")
      .update({
        ai_reply_attempts: usedGenerationsForReview + 1,
        last_ai_attempt_at: new Date().toISOString(),
      })
      .eq("id", reviewId)

    return NextResponse.json({
      reply,
      tone: {
        base: baseTone,
        effective: effectiveTone,
        adapted: effectiveTone !== baseTone,
      },
    });
  }

  const { data: insertedReply, error: insertError } = await supabase
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
      message: "Failed inserting AI draft",
      error: insertError,
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
      message: "Failed to update latest_reply_id pointer after AI draft insert (non-blocking)",
      error: pointerError,
      reviewId,
      latestReplyId: insertedReply.id,
    })
  }

  await trackUsageEvent({
    requestId,
    endpoint,
    eventType: "reply_generated",
    userId: user.id,
    reviewId,
    metadata: { rating, source: "ai", mode: "create_draft", tone: effectiveTone },
  })

  await serviceSupabase
    .from("reviews")
    .update({
      ai_reply_attempts: usedGenerationsForReview + 1,
      last_ai_attempt_at: new Date().toISOString(),
    })
    .eq("id", reviewId)

  return NextResponse.json({
    reply,
    tone: {
      base: baseTone,
      effective: effectiveTone,
      adapted: effectiveTone !== baseTone,
    },
  });
}
