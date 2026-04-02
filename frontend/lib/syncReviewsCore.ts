import OpenAI from "openai"
import { Resend } from "resend"
import { createServiceClient } from "@/lib/supabaseServerClient"
import { getValidAccessToken } from "@/lib/googleAuth"
import type { GoogleReview, GoogleReviewListResponse } from "@/app/types/googleReview"
import { createRequestId, logApiError } from "@/lib/apiLogger"
import { trackUsageEvent } from "@/lib/usageTracking"
import { PREMIUM_AUTO_REPLY_DEFAULT_MIN_RATING, hasFeature, normalizePlan } from "@/lib/subscription"
import { getReplyTonePromptGuidance, normalizeReplyTone, resolveAdaptiveReplyTone, buildReplyPrompt, type ReplyTone } from "@/lib/replyTone"

interface StoredReview {
  review_id: string
  author_name: string | null
  rating: number | null
  review_text: string | null
  review_time: string | null
  needs_ai_reply: boolean | null
  is_actionable: boolean | null
  ai_reply_attempts: number | null
}

interface FormattedReview {
  business_id: string
  review_id: string
  author_name: string
  rating: number
  review_text: string
  review_time: string
  needs_ai_reply: boolean
  is_actionable: boolean
  last_confirmed_at: string
  deleted_at: null
}

export interface NegativeReviewNotificationReview {
  author_name: string
  rating: number
  review_text: string
  review_time: string
}

const ACTIONABLE_REVIEW_WINDOW_DAYS = 30
const NEGATIVE_REVIEW_NOTIFICATION_THRESHOLD = 2
const MAX_GENERATIONS_PER_REVIEW = 5

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const STAR_RATING_TO_NUMBER: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

function normalizeStarRating(starRating: GoogleReview["starRating"]): number {
  if (typeof starRating === "number") {
    return starRating
  }

  const numericValue = Number(starRating)

  if (!Number.isNaN(numericValue)) {
    return numericValue
  }

  return STAR_RATING_TO_NUMBER[String(starRating).toUpperCase()] ?? 0
}

function toTimestamp(value?: string | null): number {
  if (!value) {
    return 0
  }

  const timestamp = Date.parse(value)

  return Number.isNaN(timestamp) ? 0 : timestamp
}

function isWithinActionWindow(reviewTime: string, nowIso: string): boolean {
  const reviewTimestamp = toTimestamp(reviewTime)

  if (reviewTimestamp === 0) {
    return true
  }

  const nowTimestamp = toTimestamp(nowIso)
  const maxAgeMs = ACTIONABLE_REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000

  return nowTimestamp - reviewTimestamp <= maxAgeMs
}

function normalizeReview(
  review: GoogleReview,
  businessId: string,
  syncedAt: string
): FormattedReview {
  const hasAdminReply = review.reply && review.reply.comment
  const reviewTime = review.updateTime ?? review.createTime
  const needsAiReply = !hasAdminReply
  const isActionable = needsAiReply && isWithinActionWindow(reviewTime, syncedAt)

  return {
    business_id: businessId,
    review_id: review.reviewId,
    author_name: review.reviewer?.displayName ?? "Anonymous",
    rating: normalizeStarRating(review.starRating),
    review_text: review.comment ?? "",
    review_time: reviewTime,
    needs_ai_reply: needsAiReply,
    is_actionable: isActionable,
    last_confirmed_at: syncedAt,
    deleted_at: null,
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }

  return text.replace(/[&<>"']/g, (match) => map[match])
}

function trimReviewText(reviewText: string, maxLength = 180): string {
  const normalized = reviewText.trim()

  if (!normalized) {
    return "(No written comment)"
  }

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`
}

export async function sendNegativeReviewNotificationEmail({
  toEmail,
  userId,
  businessName,
  reviews,
}: {
  toEmail: string
  userId: string
  businessName: string
  reviews: NegativeReviewNotificationReview[]
}): Promise<{ sent: boolean; error?: string }> {
  if (!resend) {
    return { sent: false, error: "RESEND_API_KEY is not configured" }
  }

  const fromEmail = process.env.REVIEW_ALERT_FROM_EMAIL || "Revidew <noreply@mail.revidew.com>"

  const reviewsHtml = reviews
    .map((review) => {
      const safeAuthor = escapeHtml(review.author_name || "Anonymous")
      const safeExcerpt = escapeHtml(trimReviewText(review.review_text))
      const safeWhen = escapeHtml(new Date(review.review_time).toLocaleString())

      return `
        <li style="margin-bottom: 14px;">
          <p style="margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #0f172a;">
            ${review.rating}★ from ${safeAuthor}
          </p>
          <p style="margin: 0 0 4px; font-size: 13px; color: #475569;">${safeExcerpt}</p>
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">${safeWhen}</p>
        </li>
      `
    })
    .join("")

  const subject =
    reviews.length === 1
      ? `New negative review for ${businessName}`
      : `${reviews.length} new negative reviews for ${businessName}`

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  const dashboardUrl = `${siteUrl}/dashboard`
  const unsubscribeUrl = `${siteUrl}/api/unsubscribe?uid=${encodeURIComponent(userId)}&type=negative_alerts`

  const result = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color: #0f172a; margin-bottom: 8px;">Negative review alert</h2>
        <p style="color: #475569; font-size: 14px; margin: 0 0 16px;">
          You have ${reviews.length} new negative review${reviews.length === 1 ? "" : "s"} for <strong>${escapeHtml(businessName)}</strong>.
          Responding quickly can reduce churn risk and improve trust.
        </p>
        <ul style="padding-left: 18px; margin: 0 0 18px;">${reviewsHtml}</ul>
        ${siteUrl ? `<a href="${dashboardUrl}" style="display: inline-block; margin-bottom: 16px; padding: 10px 20px; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px;">Open Revidew to draft and post a response.</a>` : ""}
        <p style="color: #64748b; font-size: 13px; margin: 0 0 16px;">Open Revidew to draft and post a response.</p>
        <p style="color: #94a3b8; font-size: 12px; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          You're receiving this because you have a Revidew account.
          <a href="${unsubscribeUrl}" style="color: #94a3b8;">Unsubscribe from negative review alerts</a>
        </p>
      </div>
    `,
  })

  if (result.error) {
    return { sent: false, error: result.error.message }
  }

  return { sent: true }
}

async function generateAutoReply(review: FormattedReview, tone: ReplyTone): Promise<string> {
  const toneInstruction = getReplyTonePromptGuidance(tone)
  const prompt = buildReplyPrompt({
    rating: review.rating,
    reviewText: review.review_text,
    toneInstruction,
  })

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  })

  return String(completion.choices[0]?.message?.content ?? "").trim()
}

async function fetchGoogleReviews(
  accessToken: string,
  accountId: string,
  locationId: string,
  latestKnownTimestamp: number,
  existingByReviewId: Map<string, StoredReview>
): Promise<GoogleReview[]> {
  const collectedReviews: GoogleReview[] = []
  let nextPageToken: string | undefined
  let canStopEarly = false

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`
    )

    url.searchParams.set("pageSize", "100")

    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken)
    }

    const googleRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!googleRes.ok) {
      const errorBody = await googleRes.text()
      throw new Error(`Google reviews fetch failed: ${googleRes.status} ${errorBody}`)
    }

    const googleData: GoogleReviewListResponse = await googleRes.json()
    const pageReviews = googleData.reviews ?? []

    collectedReviews.push(...pageReviews)
    nextPageToken = googleData.nextPageToken

    if (latestKnownTimestamp > 0 && pageReviews.length > 0) {
      canStopEarly = pageReviews.every((review) => {
        const existingReview = existingByReviewId.get(review.reviewId)

        if (!existingReview) {
          return false
        }

        return toTimestamp(review.updateTime ?? review.createTime) <= latestKnownTimestamp
      })
    }
  } while (nextPageToken && !canStopEarly)

  return collectedReviews
}

export interface SyncResult {
  fetchedCount: number
  upsertedCount: number
  skippedCount: number
  actionableCount: number
  backlogCount: number
  syncMode: "initial" | "incremental"
  autoReply: {
    available: boolean
    enabled: boolean
    minRating: number
    candidateCount: number
    skippedDueToLimit: number
    perReviewGenerationLimit: number
    attempted: number
    posted: number
    failed: number
  }
  negativeReviewNotification: {
    attempted: boolean
    sent: boolean
    count: number
    maxRating: number
    error: string | null
  }
}

/**
 * Core sync logic for a single Google Business location.
 * Uses the service client — safe to call from Inngest background jobs.
 * Throws on unrecoverable errors so that Inngest can apply retry/backoff.
 */
export async function performBusinessSync(
  businessId: string,
  userId: string
): Promise<SyncResult> {
  const endpoint = "/inngest/sync-reviews"
  const requestId = createRequestId()
  const serviceSupabase = createServiceClient()

  // Fetch business record
  const { data: business, error: businessError } = await serviceSupabase
    .from("businesses")
    .select("id, account_id, external_business_id, name, reply_tone, platform")
    .eq("id", businessId)
    .eq("platform", "google")
    .single()

  if (businessError || !business) {
    throw new Error(`Business not found or not a Google business (id=${businessId})`)
  }

  // Fetch user settings — includes email for negative-review notifications
  const { data: userRow } = await serviceSupabase
    .from("users")
    .select("plan, premium_auto_reply_enabled, premium_auto_reply_min_rating, email, email_negative_review_alerts")
    .eq("id", userId)
    .maybeSingle()

  const userPlan = normalizePlan(userRow?.plan)
  const userEmail: string | null = userRow?.email ?? null
  const negativeAlertsEnabled: boolean = userRow?.email_negative_review_alerts ?? true
  const replyTone = normalizeReplyTone(business.reply_tone)
  const autoReplyAvailable = hasFeature(userPlan, "premiumAutoReply")
  const autoReplyEnabled = autoReplyAvailable && Boolean(userRow?.premium_auto_reply_enabled)
  const autoReplyMinRating = Math.min(
    5,
    Math.max(1, Number(userRow?.premium_auto_reply_min_rating ?? PREMIUM_AUTO_REPLY_DEFAULT_MIN_RATING))
  )

  // Fetch existing reviews for dedup / incremental sync
  const { data: existingReviews, error: existingReviewsError } = await serviceSupabase
    .from("reviews")
    .select("review_id, author_name, rating, review_text, review_time, needs_ai_reply, is_actionable, ai_reply_attempts")
    .eq("business_id", business.id)
    .is("deleted_at", null)

  if (existingReviewsError) {
    logApiError({
      requestId,
      endpoint,
      userId,
      status: 500,
      message: "Failed to load existing reviews",
      error: existingReviewsError,
      businessId: business.id,
    })
    throw new Error("Failed to load existing reviews")
  }

  const existingByReviewId = new Map<string, StoredReview>(
    (existingReviews ?? []).map((review) => [review.review_id, review])
  )

  const latestKnownTimestamp = Math.max(
    0,
    ...(existingReviews ?? []).map((review) => toTimestamp(review.review_time))
  )

  try {
    const accessToken = await getValidAccessToken(userId, serviceSupabase)
    const googleReviews = await fetchGoogleReviews(
      accessToken,
      business.account_id ?? "-",
      business.external_business_id,
      latestKnownTimestamp,
      existingByReviewId
    )

    const dedupedReviews = Array.from(
      new Map(googleReviews.map((review) => [review.reviewId, review])).values()
    )

    const syncedAt = new Date().toISOString()
    const formattedReviews = dedupedReviews.map((review) =>
      normalizeReview(review, business.id, syncedAt)
    )

    // Always upsert every review Google returned so last_confirmed_at is refreshed
    // (Google API ToS: cached data must be refreshed within 30 days)
    const reviewsToUpsert = formattedReviews

    const newNegativeReviews = formattedReviews.filter(
      (review) =>
        !existingByReviewId.has(review.review_id) &&
        review.rating > 0 &&
        review.rating <= NEGATIVE_REVIEW_NOTIFICATION_THRESHOLD
    )

    const autoReplyCandidates = autoReplyEnabled
      ? formattedReviews.filter((review) => {
          if (!review.needs_ai_reply || !review.is_actionable || review.rating < autoReplyMinRating) {
            return false
          }

          const attempts = existingByReviewId.get(review.review_id)?.ai_reply_attempts ?? 0
          return attempts < MAX_GENERATIONS_PER_REVIEW
        })
      : []

    const autoReplySkippedDueToLimit = autoReplyEnabled
      ? formattedReviews.filter((review) => {
          if (!review.needs_ai_reply || !review.is_actionable || review.rating < autoReplyMinRating) {
            return false
          }

          const attempts = existingByReviewId.get(review.review_id)?.ai_reply_attempts ?? 0
          return attempts >= MAX_GENERATIONS_PER_REVIEW
        }).length
      : 0

    let negativeReviewNotificationAttempted = false
    let negativeReviewNotificationSent = false
    let negativeReviewNotificationError: string | null = null

    if (reviewsToUpsert.length > 0) {
      const { error: insertError } = await serviceSupabase
        .from("reviews")
        .upsert(reviewsToUpsert, { onConflict: "review_id" })

      if (insertError) {
        logApiError({
          requestId,
          endpoint,
          userId,
          status: 500,
          message: "Failed to upsert synced reviews",
          error: insertError,
          businessId: business.id,
        })

        await serviceSupabase
          .from("businesses")
          .update({ sync_status: "failed", sync_error: insertError.message })
          .eq("id", business.id)

        throw new Error("Failed to save reviews")
      }
    }

    // Soft-delete reviews that Google no longer returns
    const returnedReviewIds = new Set(dedupedReviews.map((r) => r.reviewId))
    const missingReviewIds = [...existingByReviewId.keys()].filter(
      (reviewId) => !returnedReviewIds.has(reviewId)
    )

    if (missingReviewIds.length > 0) {
      const { error: softDeleteError } = await serviceSupabase
        .from("reviews")
        .update({ deleted_at: new Date().toISOString() })
        .in("review_id", missingReviewIds)
        .is("deleted_at", null)

      if (softDeleteError) {
        logApiError({
          requestId,
          endpoint,
          userId,
          status: 500,
          message: "Failed to soft-delete missing reviews",
          error: softDeleteError,
          businessId: business.id,
        })
      }
    }

    // Mark sync complete
    await serviceSupabase
      .from("businesses")
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: "success",
        sync_error: null,
      })
      .eq("id", business.id)

    await trackUsageEvent({
      requestId,
      endpoint,
      eventType: "reviews_synced",
      userId,
      businessId: business.id,
      metadata: {
        fetchedCount: dedupedReviews.length,
        upsertedCount: reviewsToUpsert.length,
        skippedCount: formattedReviews.length - reviewsToUpsert.length,
        actionableCount: formattedReviews.filter((review) => review.is_actionable).length,
        backlogCount: formattedReviews.filter((review) => review.needs_ai_reply && !review.is_actionable).length,
        syncMode: latestKnownTimestamp > 0 ? "incremental" : "initial",
      },
    })

    if (newNegativeReviews.length > 0 && userEmail && negativeAlertsEnabled) {
      negativeReviewNotificationAttempted = true

      const notifyResult = await sendNegativeReviewNotificationEmail({
        toEmail: userEmail,
        userId,
        businessName: business.name,
        reviews: newNegativeReviews,
      })

      negativeReviewNotificationSent = notifyResult.sent
      negativeReviewNotificationError = notifyResult.error ?? null

      if (notifyResult.sent) {
        await trackUsageEvent({
          requestId,
          endpoint,
          eventType: "negative_review_notification_sent",
          userId,
          businessId: business.id,
          metadata: { count: newNegativeReviews.length, maxRating: NEGATIVE_REVIEW_NOTIFICATION_THRESHOLD },
        })
      } else {
        logApiError({
          requestId,
          endpoint,
          userId,
          status: 500,
          message: "Failed sending negative review notification email",
          error: notifyResult.error,
          businessId: business.id,
        })

        await trackUsageEvent({
          requestId,
          endpoint,
          eventType: "negative_review_notification_failed",
          userId,
          businessId: business.id,
          metadata: {
            count: newNegativeReviews.length,
            maxRating: NEGATIVE_REVIEW_NOTIFICATION_THRESHOLD,
            reason: notifyResult.error,
          },
        })
      }
    }

    let autoReplyAttempted = 0
    let autoReplyPosted = 0
    let autoReplyFailed = 0

    if (autoReplyCandidates.length > 0) {
      const reviewIdsForCandidates = autoReplyCandidates.map((review) => review.review_id)

      const { data: reviewRows } = await serviceSupabase
        .from("reviews")
        .select("id, review_id")
        .eq("business_id", business.id)
        .in("review_id", reviewIdsForCandidates)

      const reviewIdByExternalId = new Map((reviewRows ?? []).map((row) => [row.review_id, row.id]))
      const localReviewIds = (reviewRows ?? []).map((row) => row.id)

      const { data: analysisRows, error: analysisLookupError } = localReviewIds.length
        ? await serviceSupabase
            .from("review_analysis")
            .select("review_id, sentiment, created_at")
            .in("review_id", localReviewIds)
        : { data: [], error: null }

      if (analysisLookupError) {
        logApiError({
          requestId,
          endpoint,
          userId,
          status: 500,
          message: "Failed to load review sentiment for adaptive tone",
          error: analysisLookupError,
          businessId: business.id,
        })
      }

      const latestSentimentByReviewId = new Map<string, { sentiment: string | null; createdAt: number }>()

      for (const analysis of analysisRows ?? []) {
        const timestamp = analysis.created_at ? Date.parse(analysis.created_at) : 0
        const current = latestSentimentByReviewId.get(analysis.review_id)

        if (!current || timestamp >= current.createdAt) {
          latestSentimentByReviewId.set(analysis.review_id, {
            sentiment: analysis.sentiment,
            createdAt: Number.isNaN(timestamp) ? 0 : timestamp,
          })
        }
      }

      for (const candidate of autoReplyCandidates) {
        const localReviewId = reviewIdByExternalId.get(candidate.review_id)

        if (!localReviewId) {
          continue
        }

        const currentAttempts = existingByReviewId.get(candidate.review_id)?.ai_reply_attempts ?? 0

        if (currentAttempts >= MAX_GENERATIONS_PER_REVIEW) {
          continue
        }

        const effectiveTone = resolveAdaptiveReplyTone({
          baseTone: replyTone,
          sentiment: latestSentimentByReviewId.get(localReviewId)?.sentiment,
          rating: candidate.rating,
        })

        autoReplyAttempted += 1

        await trackUsageEvent({
          requestId,
          endpoint,
          eventType: "auto_reply_attempted",
          userId,
          businessId: business.id,
          reviewId: localReviewId,
          metadata: { rating: candidate.rating, minRating: autoReplyMinRating },
        })

        try {
          const replyText = await generateAutoReply(candidate, effectiveTone)

          if (!replyText) {
            throw new Error("Generated auto-reply was empty")
          }

          await serviceSupabase
            .from("reviews")
            .update({
              ai_reply_attempts: currentAttempts + 1,
              last_ai_attempt_at: new Date().toISOString(),
            })
            .eq("id", localReviewId)

          existingByReviewId.set(candidate.review_id, {
            ...(existingByReviewId.get(candidate.review_id) ?? {
              review_id: candidate.review_id,
              author_name: candidate.author_name,
              rating: candidate.rating,
              review_text: candidate.review_text,
              review_time: candidate.review_time,
              needs_ai_reply: candidate.needs_ai_reply,
              is_actionable: candidate.is_actionable,
              ai_reply_attempts: 0,
            }),
            ai_reply_attempts: currentAttempts + 1,
          })

          const googleReplyUrl = `https://mybusiness.googleapis.com/v4/accounts/${business.account_id}/locations/${business.external_business_id}/reviews/${candidate.review_id}/reply`

          const postRes = await fetch(googleReplyUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ comment: replyText }),
          })

          if (!postRes.ok) {
            const detail = await postRes.text()
            throw new Error(`Google post failed: ${postRes.status} ${detail}`)
          }

          const { data: insertedReply, error: insertReplyError } = await serviceSupabase
            .from("review_replies")
            .insert({
              review_id: localReviewId,
              user_id: userId,
              reply_text: replyText,
              tone_base: replyTone,
              tone_effective: effectiveTone,
              tone_adapted: effectiveTone !== replyTone,
              source: "system",
              status: "posted",
              posted_at: new Date().toISOString(),
            })
            .select("id")
            .single()

          if (insertReplyError || !insertedReply) {
            throw new Error(insertReplyError?.message || "Failed to persist auto-posted reply")
          }

          await serviceSupabase
            .from("reviews")
            .update({ latest_reply_id: insertedReply.id, needs_ai_reply: false, is_actionable: false })
            .eq("id", localReviewId)

          autoReplyPosted += 1

          await trackUsageEvent({
            requestId,
            endpoint,
            eventType: "reply_generated",
            userId,
            reviewId: localReviewId,
            metadata: { rating: candidate.rating, source: "system", mode: "premium_auto_reply", tone: effectiveTone },
          })

          await trackUsageEvent({
            requestId,
            endpoint,
            eventType: "auto_reply_posted",
            userId,
            businessId: business.id,
            reviewId: localReviewId,
            metadata: { rating: candidate.rating, minRating: autoReplyMinRating },
          })
        } catch (error) {
          autoReplyFailed += 1

          logApiError({
            requestId,
            endpoint,
            userId,
            status: 500,
            message: "Premium auto-reply failed for review",
            error,
            reviewId: localReviewId,
            businessId: business.id,
          })

          await trackUsageEvent({
            requestId,
            endpoint,
            eventType: "auto_reply_failed",
            userId,
            businessId: business.id,
            reviewId: localReviewId,
            metadata: {
              rating: candidate.rating,
              minRating: autoReplyMinRating,
              reason: error instanceof Error ? error.message : String(error),
            },
          })
        }
      }
    }

    return {
      fetchedCount: dedupedReviews.length,
      upsertedCount: reviewsToUpsert.length,
      skippedCount: formattedReviews.length - reviewsToUpsert.length,
      actionableCount: formattedReviews.filter((review) => review.is_actionable).length,
      backlogCount: formattedReviews.filter((review) => review.needs_ai_reply && !review.is_actionable).length,
      syncMode: latestKnownTimestamp > 0 ? "incremental" : "initial",
      autoReply: {
        available: autoReplyAvailable,
        enabled: autoReplyEnabled,
        minRating: autoReplyMinRating,
        candidateCount: autoReplyCandidates.length,
        skippedDueToLimit: autoReplySkippedDueToLimit,
        perReviewGenerationLimit: MAX_GENERATIONS_PER_REVIEW,
        attempted: autoReplyAttempted,
        posted: autoReplyPosted,
        failed: autoReplyFailed,
      },
      negativeReviewNotification: {
        attempted: negativeReviewNotificationAttempted,
        sent: negativeReviewNotificationSent,
        count: newNegativeReviews.length,
        maxRating: NEGATIVE_REVIEW_NOTIFICATION_THRESHOLD,
        error: negativeReviewNotificationError,
      },
    }
  } catch (error) {
    logApiError({
      requestId,
      endpoint,
      userId,
      status: 500,
      message: "Failed to sync Google reviews",
      error,
      businessId: business.id,
    })

    await serviceSupabase
      .from("businesses")
      .update({
        sync_status: "failed",
        sync_error: error instanceof Error ? error.message : String(error),
      })
      .eq("id", business.id)

    throw error
  }
}
