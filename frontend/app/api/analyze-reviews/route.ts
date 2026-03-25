import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import OpenAI from "openai"
import { createServerClient } from "@/lib/supabaseServerClient"
import { hasFeature, normalizePlan } from "@/lib/subscription"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { requireTrialOrPaidAccess } from "@/lib/subscriptionAccess"
import { trackUsageEvent } from "@/lib/usageTracking"
import type { SupabaseClient } from "@supabase/supabase-js"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

type SentimentCount = { positive: number; neutral: number; negative: number }

type ReviewAnalysis = {
  sentiment: string
  priority: string
  topics: string[]
  summary: string
  suggested_tone: string
}

type Review = {
  id: string
  review_text: string | null
  rating: number | null
  review_time: string | null
  created_at: string
}

type Topics = Record<string, { count: number; mentions: string[] }>
type Suggestions = { focus_areas: string[]; strengths: string[]; basis?: string }
type SentimentTrend = Record<string, SentimentCount>

const SUGGESTIONS_WINDOW_DAYS = 90
const SUGGESTIONS_MIN_THRESHOLD = 1
const SUGGESTIONS_FALLBACK_COUNT = 10

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

async function ensureReviewAnalyzed(
  supabase: SupabaseClient,
  reviewId: string,
  reviewText: string,
  rating: number
): Promise<ReviewAnalysis> {
  // Check if already analyzed
  const { data: existing } = await supabase
    .from("review_analysis")
    .select("*")
    .eq("review_id", reviewId)
    .maybeSingle()

  if (existing) {
    return existing
  }

  // Analyze
  const prompt = `
Analyze this Google review.

Return JSON with:
sentiment (positive/neutral/negative)
priority (low/medium/high)
topics (array)
summary (short sentence)
suggested_tone

Review:
"${reviewText}"

Rating: ${rating}
`

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  })

  const analysis = JSON.parse(completion.choices[0].message.content ?? "{}")

  // Save
  await supabase.from("review_analysis").insert({
    review_id: reviewId,
    sentiment: analysis.sentiment,
    priority: analysis.priority,
    topics: analysis.topics,
    summary: analysis.summary,
    suggested_tone: analysis.suggested_tone
  })

  return analysis
}

function extractTopics(analyses: ReviewAnalysis[]): Topics {
  const topicMap = new Map<string, { count: number; mentions: string[] }>()

  for (const analysis of analyses) {
    const topics = Array.isArray(analysis.topics) ? analysis.topics : []
    for (const topic of topics) {
      const key = String(topic).toLowerCase()
      if (!topicMap.has(key)) {
        topicMap.set(key, { count: 0, mentions: [] })
      }
      const entry = topicMap.get(key)!
      entry.count += 1
      if (!entry.mentions.includes(topic)) {
        entry.mentions.push(topic)
      }
    }
  }

  // Return top 10 by count
  return Object.fromEntries(
    Array.from(topicMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
  )
}

async function generateSuggestions(
  supabase: SupabaseClient,
  businessCategory: string | null,
  additionalCategories: string[],
  reviews: Review[],
  analyses: ReviewAnalysis[],
  sentimentCounts: SentimentCount,
  basis: string
): Promise<Suggestions> {
  const negativeAnalyses = analyses.filter((a) => (a.sentiment || "").toLowerCase() === "negative")
  const positiveAnalyses = analyses.filter((a) => (a.sentiment || "").toLowerCase() === "positive")

  const negativeTopics = negativeAnalyses.flatMap((a) => Array.isArray(a.topics) ? a.topics : [])
  const positiveTopics = positiveAnalyses.flatMap((a) => Array.isArray(a.topics) ? a.topics : [])

  const topNegative = [...new Set(negativeTopics)].slice(0, 5)
  const topPositive = [...new Set(positiveTopics)].slice(0, 5)
  const categoryContext = businessCategory && businessCategory.length > 0
    ? businessCategory
    : "general business"
  const additionalCategoryContext = additionalCategories.length > 0
    ? additionalCategories.slice(0, 5).join(", ")
    : "none"

  const prompt = `
Based on this review analysis, provide business improvement suggestions.

Business category (primary): ${categoryContext}
Business categories (additional): ${additionalCategoryContext}

Review window used for suggestions: ${basis} (${reviews.length} reviews)
Negative mentions (top issues): ${topNegative.join(", ")}
Positive mentions (strengths): ${topPositive.join(", ")}
Sentiment breakdown: ${sentimentCounts.positive} positive, ${sentimentCounts.neutral} neutral, ${sentimentCounts.negative} negative

Return JSON with:
focus_areas (array of 3-5 specific areas to improve)
strengths (array of 3-5 strengths to highlight in marketing)

Be concise and actionable. Only flag an area as needing improvement if it appears in the recent reviews provided — do not surface issues from older data not in this window.

If business category data is available, use it to provide category-specific recommendations.
`

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  })

  const result = JSON.parse(completion.choices[0].message.content ?? '{"focus_areas":[],"strengths":[]}')
  return { ...result, basis }
}

function compute30DaySentimentTrend(
  reviews: Review[],
  analyses: ReviewAnalysis[]
): SentimentTrend {
  const analysisMap = new Map(analyses.map((a, idx) => [reviews[idx]?.id || idx.toString(), a]))
  const trendMap = new Map<string, SentimentCount>()

  // Last 30 days
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  for (const review of reviews) {
    const reviewDate = new Date(review.review_time || review.created_at)
    if (reviewDate < thirtyDaysAgo) continue

    const analysis = analysisMap.get(review.id)
    if (!analysis) continue

    const key = formatYmd(reviewDate)
    if (!trendMap.has(key)) {
      trendMap.set(key, { positive: 0, neutral: 0, negative: 0 })
    }

    const sentiment = (analysis.sentiment || "").toLowerCase()
    const sentiments: (keyof SentimentCount)[] = ["positive", "neutral", "negative"]
    if (sentiments.includes(sentiment as keyof SentimentCount)) {
      trendMap.get(key)![sentiment as keyof SentimentCount] += 1
    }
  }

  // Fill in missing dates
  const result: Record<string, SentimentCount> = {}
  const cursor = new Date(thirtyDaysAgo)
  while (cursor <= now) {
    const key = formatYmd(cursor)
    result[key] = trendMap.get(key) || { positive: 0, neutral: 0, negative: 0 }
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
}

export async function POST(req: NextRequest) {
  const endpoint = "/api/analyze-reviews"
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
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    logApiError({
      requestId,
      endpoint,
      status: 401,
      message: "Invalid token",
      error: userError?.message ?? "no_user"
    })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessCheck = await requireTrialOrPaidAccess(user.id, supabase)
  if (accessCheck.response) {
    return accessCheck.response
  }

  const body = await req.json().catch(() => ({}))
  const businessId = typeof body.businessId === "string" ? body.businessId : null
  const forceRefresh = body.forceRefresh === true

  if (!businessId) {
    logApiError({ requestId, endpoint, userId: user.id, status: 400, message: "Missing businessId", error: "missing_businessId" })
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
  }

  // Verify business ownership
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, primary_category, additional_categories")
    .eq("id", businessId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (businessError || !business) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      status: 403,
      message: "Business not found or not owned by user",
      error: businessError?.message ?? "not_found"
    })
    return NextResponse.json({ error: "Not found" }, { status: 403 })
  }

  // Get user subscription
  const { data: userRow } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle()

  const userPlan = normalizePlan(userRow?.plan)
  const canUsePremium = hasFeature(userPlan, "advancedAnalytics")
  const businessPrimaryCategory = typeof business?.primary_category === "string"
    ? business.primary_category
    : null
  const businessAdditionalCategories = Array.isArray(business?.additional_categories)
    ? business.additional_categories.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : []

  logApiRequest({ requestId, endpoint, userId: user.id, businessId })

  try {
    // Get all reviews for business
    const { data: reviews, error: reviewsError } = await supabase
      .from("reviews")
      .select("id, review_text, rating, review_time, created_at")
      .eq("business_id", businessId)

    if (reviewsError) {
      throw new Error(`Failed to load reviews: ${reviewsError.message}`)
    }

    const currentReviewCount = reviews?.length ?? 0

    // Check for existing cache
    if (!forceRefresh) {
      const { data: existingCache } = await supabase
        .from("sentiment_cache")
        .select("*")
        .eq("business_id", businessId)
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (
        existingCache &&
        existingCache.analyzed_review_count === currentReviewCount
      ) {
        // Return cached data
        return NextResponse.json({
          cached: true,
          cached_at: existingCache.analyzed_at,
          sentiment_positive: existingCache.sentiment_positive,
          sentiment_neutral: existingCache.sentiment_neutral,
          sentiment_negative: existingCache.sentiment_negative,
          analyzed_review_count: existingCache.analyzed_review_count,
          analyzed_at: existingCache.analyzed_at,
          themes: canUsePremium ? existingCache.themes : {},
          suggestions: canUsePremium ? existingCache.suggestions : {},
          sentiment_trend_by_day: canUsePremium ? existingCache.sentiment_trend_by_day : {}
        })
      }
    }

    // Analyze all reviews (all-time, for accurate sentiment counts)
    const analyses: ReviewAnalysis[] = []
    for (const review of reviews ?? []) {
      const analysis = await ensureReviewAnalyzed(
        supabase,
        review.id,
        review.review_text || "",
        review.rating || 0
      )
      analyses.push(analysis)
    }

    // Build a map for efficient review → analysis lookups
    const analysisMap = new Map<string, ReviewAnalysis>()
    for (let i = 0; i < (reviews ?? []).length; i++) {
      if (reviews![i]) analysisMap.set(reviews![i].id, analyses[i])
    }

    // Count sentiments across ALL reviews (the all-time score)
    const sentimentCounts: SentimentCount = { positive: 0, neutral: 0, negative: 0 }
    for (const analysis of analyses) {
      const sentiment = (analysis.sentiment || "").toLowerCase()
      if (sentiment in sentimentCounts) {
        sentimentCounts[sentiment as keyof SentimentCount] += 1
      }
    }

    // Select the review window for AI suggestions:
    // Prefer last SUGGESTIONS_WINDOW_DAYS days; fall back to most recent SUGGESTIONS_FALLBACK_COUNT if too few.
    const windowCutoff = new Date()
    windowCutoff.setDate(windowCutoff.getDate() - SUGGESTIONS_WINDOW_DAYS)

    const recentReviews = (reviews ?? []).filter(
      (r) => new Date(r.review_time || r.created_at) >= windowCutoff
    )

    let suggestionReviews: Review[]
    let suggestionsBasis: string
    if (recentReviews.length >= SUGGESTIONS_MIN_THRESHOLD) {
      suggestionReviews = recentReviews
      suggestionsBasis = `last ${SUGGESTIONS_WINDOW_DAYS} days`
    } else {
      const sorted = [...(reviews ?? [])].sort(
        (a, b) => new Date(b.review_time || b.created_at).getTime() - new Date(a.review_time || a.created_at).getTime()
      )
      suggestionReviews = sorted.slice(0, SUGGESTIONS_FALLBACK_COUNT)
      suggestionsBasis = `most recent ${suggestionReviews.length} reviews`
    }

    const suggestionAnalyses = suggestionReviews
      .map((r) => analysisMap.get(r.id))
      .filter((a): a is ReviewAnalysis => a !== undefined)

    // Sentiment counts scoped to the suggestion window (for accurate prompt context)
    const recentSentimentCounts: SentimentCount = { positive: 0, neutral: 0, negative: 0 }
    for (const a of suggestionAnalyses) {
      const s = (a.sentiment || "").toLowerCase()
      if (s in recentSentimentCounts) recentSentimentCounts[s as keyof SentimentCount] += 1
    }

    let themes: Topics = {}
    let suggestions: Suggestions = { focus_areas: [], strengths: [] }
    let sentimentTrendByDay: SentimentTrend = {}

    // Premium features
    if (canUsePremium && analyses.length > 0) {
      themes = extractTopics(analyses)
      suggestions = await generateSuggestions(
        supabase,
        businessPrimaryCategory,
        businessAdditionalCategories,
        suggestionReviews,
        suggestionAnalyses,
        recentSentimentCounts,
        suggestionsBasis
      )
      sentimentTrendByDay = compute30DaySentimentTrend(reviews ?? [], analyses)
    }

    const now = new Date()

    // Store in cache
    const { error: cacheError } = await supabase.from("sentiment_cache").insert({
      business_id: businessId,
      analyzed_review_count: currentReviewCount,
      analyzed_at: now.toISOString(),
      sentiment_positive: sentimentCounts.positive,
      sentiment_neutral: sentimentCounts.neutral,
      sentiment_negative: sentimentCounts.negative,
      themes: canUsePremium ? themes : {},
      suggestions: canUsePremium ? suggestions : {},
      sentiment_trend_by_day: canUsePremium ? sentimentTrendByDay : {}
    })

    if (cacheError) {
      logApiError({
        requestId,
        endpoint,
        userId: user.id,
        businessId,
        status: 500,
        message: "Failed to store cache",
        error: cacheError.message
      })
      // Still return the computed data even if cache fails
    }

    // Track usage
    await trackUsageEvent({
      requestId,
      endpoint,
      userId: user.id,
      eventType: "sentiment_analysis_performed",
      businessId,
      metadata: { reviewCount: currentReviewCount, isPremium: canUsePremium }
    })

    return NextResponse.json({
      cached: false,
      sentiment_positive: sentimentCounts.positive,
      sentiment_neutral: sentimentCounts.neutral,
      sentiment_negative: sentimentCounts.negative,
      analyzed_review_count: currentReviewCount,
      analyzed_at: now.toISOString(),
      themes: canUsePremium ? themes : {},
      suggestions: canUsePremium ? suggestions : {},
      sentiment_trend_by_day: canUsePremium ? sentimentTrendByDay : {}
    })
  } catch (err) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      businessId,
      status: 500,
      message: "Analysis generation failed",
      error: err instanceof Error ? err.message : String(err)
    })
    return NextResponse.json({ error: "Failed to analyze reviews" }, { status: 500 })
  }
}
