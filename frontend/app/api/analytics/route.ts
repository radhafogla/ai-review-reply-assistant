import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { hasFeature, normalizePlan } from "@/lib/subscription"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

type Bucket = { label: string; value: number }
type DateRangePreset = "7d" | "30d" | "90d" | "custom"

type ResolvedDateRange = {
  preset: DateRangePreset
  startIso: string
  endIso: string
  label: string
}

function toBuckets(record: Record<string, number>): Bucket[] {
  return Object.entries(record)
    .map(([label, value]) => ({ label, value }))
    .filter((b) => b.value > 0)
}

function formatYmd(date: Date) {
  return date.toISOString().slice(0, 10)
}

function buildDateRange(inputPreset: unknown, inputStart: unknown, inputEnd: unknown): ResolvedDateRange {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  const preset: DateRangePreset =
    inputPreset === "7d" || inputPreset === "30d" || inputPreset === "90d" || inputPreset === "custom"
      ? inputPreset
      : "30d"

  if (preset === "custom") {
    const parsedStart = typeof inputStart === "string" ? new Date(inputStart) : null
    const parsedEnd = typeof inputEnd === "string" ? new Date(inputEnd) : null
    if (parsedStart && parsedEnd && !Number.isNaN(parsedStart.getTime()) && !Number.isNaN(parsedEnd.getTime())) {
      parsedStart.setHours(0, 0, 0, 0)
      parsedEnd.setHours(23, 59, 59, 999)

      if (parsedStart <= parsedEnd) {
        return {
          preset,
          startIso: parsedStart.toISOString(),
          endIso: parsedEnd.toISOString(),
          label: `${formatYmd(parsedStart)} to ${formatYmd(parsedEnd)}`,
        }
      }
    }
  }

  const dayCount = preset === "7d" ? 7 : preset === "90d" ? 90 : 30
  const start = new Date(end)
  start.setDate(end.getDate() - (dayCount - 1))
  start.setHours(0, 0, 0, 0)

  return {
    preset: preset === "custom" ? "30d" : preset,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: `Last ${dayCount} days`,
  }
}

function buildDailyBuckets(startIso: string, endIso: string, counts: Map<string, number>) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const buckets: Bucket[] = []

  const cursor = new Date(start)
  while (cursor <= end) {
    const key = formatYmd(cursor)
    buckets.push({ label: key, value: counts.get(key) ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  return buckets
}

export async function POST(req: NextRequest) {
  const endpoint = "/api/analytics"
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
  } = await supabase.auth.getUser()

  if (userError || !user) {
    logApiError({ requestId, endpoint, status: 401, message: "Invalid or missing user", error: userError?.message ?? "no_user" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  logApiRequest({ requestId, endpoint, userId: user.id })
  const body = await req.json().catch(() => ({}))
  const requestedBusinessId = typeof body?.businessId === "string" ? body.businessId : null
  const requestedRangePreset = body?.rangePreset
  const requestedStartDate = body?.startDate
  const requestedEndDate = body?.endDate

  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", user.id)
    .order("id", { ascending: true })

  if (businessesError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load businesses", error: businessesError.message })
    return NextResponse.json({ error: "Failed to load businesses", detail: businessesError.message }, { status: 500 })
  }

  if (!businesses || businesses.length === 0) {
    return NextResponse.json({ businesses: [], selectedBusinessId: null, analytics: null })
  }

  const selectedBusiness = requestedBusinessId
    ? businesses.find((b) => b.id === requestedBusinessId) ?? businesses[0]
    : businesses[0]

  const { data: userRow } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle()

  const resolvedPlan = normalizePlan(userRow?.plan)
  const canUseAdvancedAnalytics = hasFeature(resolvedPlan, "advancedAnalytics")
  const appliedRange = canUseAdvancedAnalytics
    ? buildDateRange(requestedRangePreset, requestedStartDate, requestedEndDate)
    : null

  const selectedBusinessId = selectedBusiness.id

  let reviewsQuery = supabase
    .from("reviews")
    .select("id, rating, latest_reply_id, review_time, created_at")
    .eq("business_id", selectedBusinessId)

  // Fetch unfiltered all-time counts so the stat cards always show totals, not range-scoped numbers.
  // These are only needed when a date range is applied (Premium); Basic users get full data anyway.
  const businessReviewIds = appliedRange
    ? await supabase
        .from("reviews")
        .select("id")
        .eq("business_id", selectedBusinessId)
        .then(({ data }) => (data ?? []).map((r) => r.id))
    : []

  const [totalReviewsAllTime, postedRepliesAllTime, pendingRepliesAllTime] = appliedRange
    ? await Promise.all([
        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("business_id", selectedBusinessId)
          .then(({ count }) => count ?? 0),
        businessReviewIds.length
          ? supabase
              .from("review_replies")
              .select("id", { count: "exact", head: true })
              .in("review_id", businessReviewIds)
              .eq("status", "posted")
              .then(({ count }) => count ?? 0)
          : Promise.resolve(0),
        businessReviewIds.length
          ? supabase
              .from("review_replies")
              .select("id", { count: "exact", head: true })
              .in("review_id", businessReviewIds)
              .in("status", ["draft", "approved"])
              .then(({ count }) => count ?? 0)
          : Promise.resolve(0),
      ])
    : [null, null, null]

  if (appliedRange) {
    reviewsQuery = reviewsQuery
      .gte("review_time", appliedRange.startIso)
      .lte("review_time", appliedRange.endIso)
  }

  const { data: reviews, error: reviewsError } = await reviewsQuery

  if (reviewsError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load reviews", error: reviewsError.message })
    return NextResponse.json({ error: "Failed to load reviews", detail: reviewsError.message }, { status: 500 })
  }

  const reviewIds = (reviews ?? []).map((r) => r.id)

  const { data: replies, error: repliesError } = reviewIds.length
    ? await supabase
        .from("review_replies")
        .select("id, review_id, status, source, created_at")
        .in("review_id", reviewIds)
    : { data: [], error: null }

  if (repliesError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load replies", error: repliesError.message })
    return NextResponse.json({ error: "Failed to load replies", detail: repliesError.message }, { status: 500 })
  }

  const { data: analyses, error: analysisError } = reviewIds.length
    ? await supabase
        .from("review_analysis")
        .select("review_id, sentiment, created_at")
        .in("review_id", reviewIds)
    : { data: [], error: null }

  if (analysisError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load analysis", error: analysisError.message })
    return NextResponse.json({ error: "Failed to load analysis", detail: analysisError.message }, { status: 500 })
  }

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)

  const { data: autoReplyEvents, error: autoReplyEventsError } = await supabase
    .from("usage_events")
    .select("event_type")
    .eq("user_id", user.id)
    .eq("business_id", selectedBusinessId)
    .in("event_type", ["auto_reply_attempted", "auto_reply_posted", "auto_reply_failed", "negative_review_notification_sent", "negative_review_notification_failed"])

  if (autoReplyEventsError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load auto-reply usage events", error: autoReplyEventsError.message })
    return NextResponse.json({ error: "Failed to load auto-reply usage events", detail: autoReplyEventsError.message }, { status: 500 })
  }

  let autoReplyAttempted = 0
  let autoReplyPosted = 0
  let autoReplyFailed = 0
  let negativeAlertsSent = 0
  let negativeAlertsFailed = 0

  for (const event of autoReplyEvents ?? []) {
    if (event.event_type === "auto_reply_attempted") autoReplyAttempted += 1
    else if (event.event_type === "auto_reply_posted") autoReplyPosted += 1
    else if (event.event_type === "auto_reply_failed") autoReplyFailed += 1
    else if (event.event_type === "negative_review_notification_sent") negativeAlertsSent += 1
    else if (event.event_type === "negative_review_notification_failed") negativeAlertsFailed += 1
  }

  const autoReplySuccessRate = autoReplyAttempted > 0
    ? Math.round((autoReplyPosted / autoReplyAttempted) * 100)
    : 0

  const ratingCount = { "1★": 0, "2★": 0, "3★": 0, "4★": 0, "5★": 0 }
  let ratingSum = 0
  let ratingValidCount = 0
  for (const review of reviews ?? []) {
    const rating = Number(review.rating)
    if (rating >= 1 && rating <= 5) {
      ratingCount[`${rating}★` as keyof typeof ratingCount] += 1
      ratingSum += rating
      ratingValidCount += 1
    }
  }
  const avgRating = ratingValidCount > 0 ? Math.round((ratingSum / ratingValidCount) * 10) / 10 : 0

  const statusCount = { draft: 0, approved: 0, posted: 0, failed: 0, deleted: 0, none: 0 }
  const replyById = new Map((replies ?? []).map((r) => [r.id, r]))

  for (const review of reviews ?? []) {
    const latest = review.latest_reply_id ? replyById.get(review.latest_reply_id) : undefined
    if (!latest) statusCount.none += 1
    else if (latest.status in statusCount) statusCount[latest.status as keyof typeof statusCount] += 1
  }

  const postedReplies = postedRepliesAllTime ?? statusCount.posted
  const pendingReplies = pendingRepliesAllTime ?? (statusCount.draft + statusCount.approved)

  const sourceCount = { ai: 0, user: 0, system: 0 }
  for (const reply of replies ?? []) {
    if (reply.source in sourceCount) {
      sourceCount[reply.source as keyof typeof sourceCount] += 1
    }
  }

  const sentimentCount = { positive: 0, neutral: 0, negative: 0 }
  for (const item of analyses ?? []) {
    const key = (item.sentiment || "").toLowerCase()
    if (key in sentimentCount) {
      sentimentCount[key as keyof typeof sentimentCount] += 1
    }
  }

  const reviewTrendCount = new Map<string, number>()
  for (const review of reviews ?? []) {
    const key = formatYmd(new Date(review.review_time ?? review.created_at))
    reviewTrendCount.set(key, (reviewTrendCount.get(key) ?? 0) + 1)
  }

  const postedReplyTrendCount = new Map<string, number>()
  for (const reply of replies ?? []) {
    if (reply.status !== "posted") continue
    const key = formatYmd(new Date(reply.created_at))
    postedReplyTrendCount.set(key, (postedReplyTrendCount.get(key) ?? 0) + 1)
  }

  const negativeSentimentTrendCount = new Map<string, number>()
  for (const analysis of analyses ?? []) {
    if ((analysis.sentiment || "").toLowerCase() !== "negative") continue
    const key = formatYmd(new Date(analysis.created_at))
    negativeSentimentTrendCount.set(key, (negativeSentimentTrendCount.get(key) ?? 0) + 1)
  }

  const analytics = {
    totals: {
      reviews: totalReviewsAllTime ?? reviews?.length ?? 0,
      totalReviewsAllTime: totalReviewsAllTime ?? reviews?.length ?? 0,
      replies: postedReplies + pendingReplies,
      postedReplies,
      pendingReplies,
      avgRating,
      negativeAlertsSent,
      negativeAlertsFailed,
      businesses: businesses.length,
      plan: subscriptions?.[0]?.plan ?? resolvedPlan,
      subscriptionStatus: subscriptions?.[0]?.status ?? "active",
    },
    premium: {
      autoReplyAttempted,
      autoReplyPosted,
      autoReplyFailed,
      autoReplySuccessRate,
    },
    charts: {
      ratings: toBuckets(ratingCount),
      replyStatuses: toBuckets(statusCount),
      replySources: toBuckets(sourceCount),
      sentiment: toBuckets(sentimentCount),
    },
    advanced: {
      enabled: canUseAdvancedAnalytics,
      range: appliedRange
        ? {
            preset: appliedRange.preset,
            startDate: appliedRange.startIso,
            endDate: appliedRange.endIso,
            label: appliedRange.label,
          }
        : null,
      trends: appliedRange
        ? {
            reviewsByDay: buildDailyBuckets(appliedRange.startIso, appliedRange.endIso, reviewTrendCount),
            postedRepliesByDay: buildDailyBuckets(appliedRange.startIso, appliedRange.endIso, postedReplyTrendCount),
            negativeSentimentByDay: buildDailyBuckets(appliedRange.startIso, appliedRange.endIso, negativeSentimentTrendCount),
          }
        : {
            reviewsByDay: [],
            postedRepliesByDay: [],
            negativeSentimentByDay: [],
          },
    },
  }

  return NextResponse.json({ businesses, selectedBusinessId, analytics })
}
