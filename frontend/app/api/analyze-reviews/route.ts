import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import OpenAI from "openai"
import { createServerClient } from "@/lib/supabaseServerClient"
import { hasFeature } from "@/lib/subscription"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { trackUsageEvent } from "@/lib/usageTracking"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

type SentimentCount = { positive: number; neutral: number; negative: number }

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

async function ensureReviewAnalyzed(
  supabase: any,
  reviewId: string,
  reviewText: string,
  rating: number
): Promise<{ sentiment: string; priority: string; topics: string[]; summary: string; suggested_tone: string }> {
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

function extractTopics(analyses: any[]): Record<string, { count: number; mentions: string[] }> {
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
  supabase: any,
  reviews: any[],
  analyses: any[],
  sentimentCounts: SentimentCount
): Promise<{ focus_areas: string[]; strengths: string[] }> {
  const negativeAnalyses = analyses.filter((a) => (a.sentiment || "").toLowerCase() === "negative")
  const positiveAnalyses = analyses.filter((a) => (a.sentiment || "").toLowerCase() === "positive")

  const negativeTopics = negativeAnalyses.flatMap((a) => Array.isArray(a.topics) ? a.topics : [])
  const positiveTopics = positiveAnalyses.flatMap((a) => Array.isArray(a.topics) ? a.topics : [])

  const topNegative = [...new Set(negativeTopics)].slice(0, 5)
  const topPositive = [...new Set(positiveTopics)].slice(0, 5)

  const prompt = `
Based on this review analysis, provide business improvement suggestions.

Negative mentions (top issues): ${topNegative.join(", ")}
Positive mentions (strengths): ${topPositive.join(", ")}
Sentiment breakdown: ${sentimentCounts.positive} positive, ${sentimentCounts.neutral} neutral, ${sentimentCounts.negative} negative
Total reviews analyzed: ${reviews.length}

Return JSON with:
focus_areas (array of 3-5 specific areas to improve)
strengths (array of 3-5 strengths to highlight in marketing)

Be concise and actionable.
`

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  })

  return JSON.parse(completion.choices[0].message.content ?? '{"focus_areas":[],"strengths":[]}')
}

function compute30DaySentimentTrend(
  reviews: any[],
  analyses: any[]
): Record<string, { positive: number; neutral: number; negative: number }> {
  const analysisMap = new Map(analyses.map((a) => [a.review_id, a]))
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
    .select("id")
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

  const userPlan = userRow?.plan || "free"
  const canUsePremium = hasFeature(userPlan, "advancedAnalytics")

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

    // Analyze all reviews
    const analyses = []
    for (const review of reviews ?? []) {
      const analysis = await ensureReviewAnalyzed(
        supabase,
        review.id,
        review.review_text || "",
        review.rating || 0
      )
      analyses.push(analysis)
    }

    // Count sentiments
    const sentimentCounts: SentimentCount = { positive: 0, neutral: 0, negative: 0 }
    for (const analysis of analyses) {
      const sentiment = (analysis.sentiment || "").toLowerCase()
      if (sentiment in sentimentCounts) {
        sentimentCounts[sentiment as keyof SentimentCount] += 1
      }
    }

    let themes: any = {}
    let suggestions: any = {}
    let sentimentTrendByDay: any = {}

    // Premium features
    if (canUsePremium && analyses.length > 0) {
      themes = extractTopics(analyses)
      suggestions = await generateSuggestions(supabase, reviews ?? [], analyses, sentimentCounts)
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
