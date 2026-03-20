"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useSubscription } from "@/app/hooks/useSubscription"
import { getFeatureGateUpgradeHint, hasFeature } from "@/lib/subscription"
import EmptyState from "@/app/components/EmptyState"

type Bucket = { label: string; value: number }
type DateRangePreset = "7d" | "30d" | "90d" | "custom"

type AnalyticsPayload = {
  totals: {
    reviews: number
    totalReviewsAllTime: number
    replies: number
    avgRating: number
    businesses: number
    plan: string
    subscriptionStatus: string
  }
  premium: {
    autoReplyAttempted: number
    autoReplyPosted: number
    autoReplyFailed: number
    autoReplySuccessRate: number
  }
  charts: {
    ratings: Bucket[]
    replyStatuses: Bucket[]
    replySources: Bucket[]
    sentiment: Bucket[]
  }
  advanced: {
    enabled: boolean
    range: {
      preset: DateRangePreset
      startDate: string
      endDate: string
      label: string
    } | null
    trends: {
      reviewsByDay: Bucket[]
      postedRepliesByDay: Bucket[]
      negativeSentimentByDay: Bucket[]
    }
  }
}

type SentimentCache = {
  sentiment_positive: number
  sentiment_neutral: number
  sentiment_negative: number
  analyzed_review_count: number
  analyzed_at: string
  themes: Record<string, { count: number; mentions: string[] }>
  suggestions: { focus_areas: string[]; strengths: string[]; basis?: string }
  sentiment_trend_by_day: Record<string, { positive: number; neutral: number; negative: number }>
}

type SentimentTrendPoint = {
  dateKey: string
  label: string
  positive: number
  neutral: number
  negative: number
}

type ThemeSentimentContext = {
  emoji: string
  label: string
  toneColor: string
  bgColor: string
  borderColor: string
}

function PieChart({ title, data, palette }: { title: string; data: Bucket[]; palette: string[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  const segments = useMemo(() => {
    if (total === 0) return []

    let start = 0
    return data.map((d, idx) => {
      const fraction = d.value / total
      const end = start + fraction

      const largeArc = end - start > 0.5 ? 1 : 0
      const a0 = 2 * Math.PI * start - Math.PI / 2
      const a1 = 2 * Math.PI * end - Math.PI / 2

      const x0 = 80 + 64 * Math.cos(a0)
      const y0 = 80 + 64 * Math.sin(a0)
      const x1 = 80 + 64 * Math.cos(a1)
      const y1 = 80 + 64 * Math.sin(a1)

      const path = `M 80 80 L ${x0} ${y0} A 64 64 0 ${largeArc} 1 ${x1} ${y1} Z`

      const current = {
        ...d,
        path,
        color: palette[idx % palette.length],
        percent: Math.round(fraction * 100),
      }

      start = end
      return current
    })
  }, [data, palette, total])

  return (
    <div style={{ borderRadius: 14, border: "1.5px solid #e2e8f0", backgroundColor: "#ffffff", padding: 16 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{title}</h3>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, alignItems: "center" }}>
        <svg width="160" height="160" viewBox="0 0 160 160" aria-label={title}>
          {segments.length === 0 ? (
            <circle cx="80" cy="80" r="64" fill="#f1f5f9" stroke="#e2e8f0" />
          ) : (
            segments.map((seg) => <path key={seg.label} d={seg.path} fill={seg.color} />)
          )}
          <circle cx="80" cy="80" r="30" fill="#ffffff" stroke="#e2e8f0" />
          <text x="80" y="84" textAnchor="middle" style={{ fontSize: 11, fill: "#334155", fontWeight: 700 }}>
            {total}
          </text>
        </svg>

        <div style={{ display: "grid", gap: 8 }}>
          {segments.length === 0 ? (
            <p style={{ margin: 0, fontSize: 15, color: "#475569" }}>No data yet</p>
          ) : (
            segments.map((seg) => (
              <div key={seg.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: seg.color, display: "inline-block" }} />
                  <span style={{ fontSize: 15, color: "#334155", fontWeight: 600 }}>{seg.label}</span>
                </div>
                <span style={{ fontSize: 14, color: "#475569", fontWeight: 700 }}>{seg.value} ({seg.percent}%)</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function TrendBars({ title, data, color }: { title: string; data: Bucket[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div style={{ borderRadius: 14, border: "1.5px solid #e2e8f0", backgroundColor: "#ffffff", padding: 16 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{title}</h3>

      {data.length === 0 ? (
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 15, color: "#475569" }}>No data in selected range</p>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`, gap: 6, alignItems: "end", height: 150 }}>
            {data.map((bucket) => {
              const heightPct = Math.max(6, Math.round((bucket.value / max) * 100))
              return (
                <div key={bucket.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "end", gap: 4 }}>
                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{bucket.value}</span>
                  <div
                    title={`${bucket.label}: ${bucket.value}`}
                    style={{
                      width: "100%",
                      minWidth: 6,
                      borderRadius: 6,
                      backgroundColor: color,
                      height: `${heightPct}%`,
                    }}
                  />
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", fontWeight: 700 }}>
            <span>{data[0]?.label ?? ""}</span>
            <span>{data[data.length - 1]?.label ?? ""}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function PremiumInsightCard({
  eyebrow,
  title,
  body
}: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid #dbe4ff",
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
        padding: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4f46e5" }}>
        {eyebrow}
      </div>
      <div style={{ marginTop: 8, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{title}</div>
      <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.6, color: "#475569" }}>{body}</p>
    </div>
  )
}

function StackedSentimentTrend({ title, data }: { title: string; data: SentimentTrendPoint[] }) {
  const max = Math.max(
    ...data.map((point) => point.positive + point.neutral + point.negative),
    1,
  )

  return (
    <div style={{ borderRadius: 16, border: "1px solid #e2e8f0", backgroundColor: "#ffffff", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#475569" }}>Daily sentiment mix across the most recent 30 days.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#475569", fontWeight: 700 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "#22c55e", display: "inline-block" }} />
            Positive
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#475569", fontWeight: 700 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "#f59e0b", display: "inline-block" }} />
            Neutral
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#475569", fontWeight: 700 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "#ef4444", display: "inline-block" }} />
            Negative
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <p style={{ margin: "16px 0 0", fontSize: 15, color: "#475569" }}>No trend data yet.</p>
      ) : (
        <>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`, gap: 8, alignItems: "end", height: 220 }}>
            {data.map((point) => {
              const total = point.positive + point.neutral + point.negative
              const stackHeight = Math.max(16, Math.round((total / max) * 100))
              const positivePct = total === 0 ? 0 : (point.positive / total) * 100
              const neutralPct = total === 0 ? 0 : (point.neutral / total) * 100
              const negativePct = total === 0 ? 0 : (point.negative / total) * 100

              return (
                <div key={point.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "end", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{total}</span>
                  <div
                    title={`${point.label}: ${point.positive} positive, ${point.neutral} neutral, ${point.negative} negative`}
                    style={{
                      width: "100%",
                      minWidth: 10,
                      height: `${stackHeight}%`,
                      borderRadius: 999,
                      overflow: "hidden",
                      backgroundColor: "#e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                    }}
                  >
                    {negativePct > 0 && <div style={{ height: `${negativePct}%`, backgroundColor: "#ef4444" }} />}
                    {neutralPct > 0 && <div style={{ height: `${neutralPct}%`, backgroundColor: "#f59e0b" }} />}
                    {positivePct > 0 && <div style={{ height: `${positivePct}%`, backgroundColor: "#22c55e" }} />}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", fontWeight: 700 }}>
            <span>{data[0]?.label ?? ""}</span>
            <span>{data[data.length - 1]?.label ?? ""}</span>
          </div>
        </>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  const { loading: subscriptionLoading, subscription } = useSubscription()
  const [hasBusiness, setHasBusiness] = useState(true)
  const [loading, setLoading] = useState(false)
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string | null }>>([])
  const [selectedBusinessId, setSelectedBusinessId] = useState("")
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null)
  const [rangePreset, setRangePreset] = useState<DateRangePreset>("30d")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [sentimentCache, setSentimentCache] = useState<SentimentCache | null>(null)
  const [sentimentLoading, setSentimentLoading] = useState(false)
  const [isStale, setIsStale] = useState(false)
  const skipNextBusinessFetchRef = useRef(false)

  const canUsePremiumInsights = hasFeature(subscription.plan, "advancedAnalytics")

  const loadAnalytics = useCallback(async (businessId?: string, range?: { preset: DateRangePreset; startDate?: string; endDate?: string }) => {
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (!accessToken) {
      setHasBusiness(false)
      setLoading(false)
      return
    }

    const res = await fetch("/api/analytics", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessId: businessId || undefined,
        rangePreset: range?.preset,
        startDate: range?.startDate,
        endDate: range?.endDate,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("analytics failed", data)
      setHasBusiness(false)
      setLoading(false)
      return
    }

    const nextBusinesses = Array.isArray(data?.businesses) ? data.businesses : []
    if (nextBusinesses.length === 0) {
      setHasBusiness(false)
      setLoading(false)
      return
    }

    setHasBusiness(true)
    setBusinesses(nextBusinesses)
    if (data?.selectedBusinessId) {
      setSelectedBusinessId((prev) => {
        if (prev === data.selectedBusinessId) {
          return prev
        }

        skipNextBusinessFetchRef.current = true
        return data.selectedBusinessId
      })
    }
    setAnalytics(data?.analytics ?? null)
    setLoading(false)
  }, [])

  const loadSentimentCache = useCallback(
    async (businessId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken || !businessId) return

      try {
        const res = await fetch(`/api/sentiment-cache?businessId=${businessId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })

        if (res.ok) {
          const cache = (await res.json()) as SentimentCache
          setSentimentCache(cache)

          // Check staleness against the unfiltered total so date-range filtering
          // on Premium doesn't suppress the re-analyze button.
          const totalForStaleness = analytics?.totals?.totalReviewsAllTime ?? analytics?.totals?.reviews
          if (totalForStaleness && cache.analyzed_review_count) {
            setIsStale(totalForStaleness > cache.analyzed_review_count)
          }
        }
      } catch (err) {
        console.error("Failed to load sentiment cache", err)
      }
    },
    [analytics?.totals?.reviews, analytics?.totals?.totalReviewsAllTime]
  )

  const handleAnalyzeSentiment = useCallback(async (forceRefresh = false) => {
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (!accessToken || !selectedBusinessId) return

    setSentimentLoading(true)

    try {
      const res = await fetch("/api/analyze-reviews", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          businessId: selectedBusinessId,
          forceRefresh
        })
      })

      if (res.ok) {
        const result = (await res.json()) as SentimentCache
        setSentimentCache(result)
        setIsStale(false)
      } else {
        console.error("Analysis failed", await res.json())
      }
    } catch (err) {
      console.error("Failed to analyze reviews", err)
    } finally {
      setSentimentLoading(false)
    }
  }, [selectedBusinessId])

  useEffect(() => {
    if (skipNextBusinessFetchRef.current) {
      skipNextBusinessFetchRef.current = false
      return
    }

    if (subscriptionLoading) return

    if (canUsePremiumInsights && rangePreset === "custom" && (!customStartDate || !customEndDate)) {
      return
    }

    const activeRange = canUsePremiumInsights
      ? {
          preset: rangePreset,
          startDate: rangePreset === "custom" ? customStartDate : undefined,
          endDate: rangePreset === "custom" ? customEndDate : undefined,
        }
      : undefined

    const run = async () => {
      await loadAnalytics(selectedBusinessId || undefined, activeRange)
    }
    run()
  }, [selectedBusinessId, loadAnalytics, subscriptionLoading, canUsePremiumInsights, rangePreset, customStartDate, customEndDate])

  useEffect(() => {
    if (selectedBusinessId && analytics?.totals?.reviews) {
      loadSentimentCache(selectedBusinessId)
    }
  }, [selectedBusinessId, analytics?.totals?.reviews, loadSentimentCache])

  if (!hasBusiness) return <EmptyState />

  const totals = analytics?.totals
  const premium = analytics?.premium
  const isPremiumPlan = (totals?.plan || subscription.plan).toLowerCase() === "premium"
  const advanced = analytics?.advanced
  const totalReviews = totals?.reviews ?? 0
  const totalReviewsAllTime = totals?.totalReviewsAllTime ?? totalReviews
  const analyzedReviewCount = sentimentCache?.analyzed_review_count ?? 0
  const hasSentimentCache = Boolean(sentimentCache)
  const newReviewsCount = Math.max(0, totalReviewsAllTime - analyzedReviewCount)
  const isReanalyzeDisabled = sentimentLoading || (hasSentimentCache && !isStale)
  const sortedTrendData: SentimentTrendPoint[] = Object.entries(sentimentCache?.sentiment_trend_by_day ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, counts]) => ({
      dateKey: date,
      label: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      positive: counts.positive ?? 0,
      neutral: counts.neutral ?? 0,
      negative: counts.negative ?? 0,
    }))
    .slice(-30)
  const topThemes = Object.entries(sentimentCache?.themes ?? {})
    .sort(([leftName, left], [rightName, right]) => {
      const diff = (right.count ?? 0) - (left.count ?? 0)
      return diff !== 0 ? diff : leftName.localeCompare(rightName)
    })
    .slice(0, 6)
  const focusAreas = sentimentCache?.suggestions?.focus_areas ?? []
  const strengths = sentimentCache?.suggestions?.strengths ?? []
  const normalizedFocusAreas = focusAreas.map((value) => value.toLowerCase())
  const normalizedStrengths = strengths.map((value) => value.toLowerCase())
  const primaryTheme = topThemes[0]
  // Prefer the cached focus_areas[0] (stable ordered array); fall back to top theme derivation
  const primaryFocusTitle = focusAreas[0]
    ?? (primaryTheme
      ? `Fix ${primaryTheme[0]} concerns (mentioned in ${Math.round((primaryTheme[1].count / Math.max(analyzedReviewCount, 1)) * 100)}% of analyzed reviews)`
      : "No primary focus detected yet")

  const getThemeSentimentContext = (theme: string): ThemeSentimentContext => {
    const normalizedTheme = theme.toLowerCase()
    const isNegativeTheme = normalizedFocusAreas.some((focus) => focus.includes(normalizedTheme) || normalizedTheme.includes(focus))
    const isPositiveTheme = normalizedStrengths.some((strength) => strength.includes(normalizedTheme) || normalizedTheme.includes(strength))

    if (isNegativeTheme) {
      return {
        emoji: "🔴",
        label: "Mostly negative",
        toneColor: "#991b1b",
        bgColor: "#fff1f2",
        borderColor: "#fecdd3",
      }
    }

    if (isPositiveTheme) {
      return {
        emoji: "🟢",
        label: "Mostly positive",
        toneColor: "#166534",
        bgColor: "#f0fdf4",
        borderColor: "#bbf7d0",
      }
    }

    return {
      emoji: "🟡",
      label: "Mixed sentiment",
      toneColor: "#92400e",
      bgColor: "#fffbeb",
      borderColor: "#fde68a",
    }
  }

  const reviewsByDay = advanced?.trends.reviewsByDay ?? []
  const repliesByDay = advanced?.trends.postedRepliesByDay ?? []
  const repliesByLabel = new Map(repliesByDay.map((bucket) => [bucket.label, bucket.value]))
  const replyCoverageByDay: Bucket[] = reviewsByDay.map((reviewBucket) => {
    const repliesForDay = repliesByLabel.get(reviewBucket.label) ?? 0
    const coverage = reviewBucket.value > 0 ? Math.round((repliesForDay / reviewBucket.value) * 100) : 0
    return {
      label: reviewBucket.label,
      value: coverage,
    }
  })

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <div style={{ maxWidth: 1680, margin: "0 auto", padding: "20px 24px 36px" }}>
        <section style={{
          marginBottom: 12,
          borderRadius: 20,
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        }}>
          <div style={{ backgroundColor: "#0f172a", padding: "20px 28px" }}>
            <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#fdba74", margin: 0 }}>
              Basic subscription analytics
            </p>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#ffffff", margin: "8px 0 0", letterSpacing: "-0.4px" }}>
              Review insights
            </h1>
            <p style={{ fontSize: 14, color: "#475569", marginTop: 6, maxWidth: 620 }}>
              Snapshot of your review activity: total reviews, replies, average rating, and subscription status.
            </p>
          </div>

          <div style={{ padding: "18px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label htmlFor="analytics-business-filter" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
                  Business scope
                </label>
                <select
                  id="analytics-business-filter"
                  value={selectedBusinessId}
                  onChange={(e) => setSelectedBusinessId(e.target.value)}
                  style={{ minWidth: 280, borderRadius: 10, border: "1.5px solid #cbd5e1", backgroundColor: "#fff", color: "#0f172a", fontSize: 15, fontWeight: 600, padding: "8px 12px", outline: "none" }}
                >
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name?.trim() || business.id}
                    </option>
                  ))}
                </select>
                {loading && <span style={{ fontSize: 14, color: "#475569", fontWeight: 600 }}>Loading...</span>}
              </div>

              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                backgroundColor: "#fff7ed", border: "1px solid #fdba74",
                borderRadius: 99, padding: "6px 14px",
              }}>
                <span style={{ fontSize: 14, color: "#9a3412", fontWeight: 700 }}>
                  Plan: {(totals?.plan || "free").toUpperCase()} ({totals?.subscriptionStatus || "active"})
                </span>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {canUsePremiumInsights ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Range</span>
                  <select
                    value={rangePreset}
                    onChange={(e) => setRangePreset(e.target.value as DateRangePreset)}
                    style={{ borderRadius: 10, border: "1.5px solid #cbd5e1", backgroundColor: "#fff", color: "#0f172a", fontSize: 13, fontWeight: 600, padding: "8px 12px", outline: "none" }}
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="custom">Custom range</option>
                  </select>

                  {rangePreset === "custom" && (
                    <>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        style={{ borderRadius: 10, border: "1.5px solid #cbd5e1", backgroundColor: "#fff", color: "#0f172a", fontSize: 13, fontWeight: 600, padding: "8px 12px", outline: "none" }}
                      />
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        style={{ borderRadius: 10, border: "1.5px solid #cbd5e1", backgroundColor: "#fff", color: "#0f172a", fontSize: 13, fontWeight: 600, padding: "8px 12px", outline: "none" }}
                      />
                    </>
                  )}

                  <span style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>
                    {advanced?.range?.label ?? ""}
                  </span>
                </div>
              ) : (
                <div style={{ marginTop: 6, borderRadius: 12, border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", padding: "10px 12px" }}>
                  <p style={{ margin: 0, fontSize: 14, color: "#334155", fontWeight: 700 }}>Advanced analytics preview</p>
                  <p style={{ marginTop: 4, marginBottom: 0, fontSize: 14, color: "#475569" }}>
                    {getFeatureGateUpgradeHint("advancedAnalytics")}
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div style={{ borderRadius: 14, backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", padding: "14px 18px" }}>
                <div style={{ fontSize: 14, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Reviews</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginTop: 8 }}>{totals?.reviews ?? 0}</div>
              </div>
              <div style={{ borderRadius: 14, backgroundColor: "#f0fdf4", border: "1.5px solid #bbf7d0", padding: "14px 18px" }}>
                <div style={{ fontSize: 14, color: "#065f46", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Replies</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#14532d", marginTop: 8 }}>{totals?.replies ?? 0}</div>
              </div>
              <div style={{ borderRadius: 14, backgroundColor: "#fdf4ff", border: "1.5px solid #e9d5ff", padding: "14px 18px" }}>
                <div style={{ fontSize: 14, color: "#7e22ce", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Avg. rating</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#581c87", marginTop: 8 }}>{totals?.avgRating != null ? `${totals.avgRating} ★` : "—"}</div>
              </div>
            </div>

            {isPremiumPlan && (
              <div style={{ marginTop: 16, borderRadius: 14, border: "1.5px solid #c7d2fe", backgroundColor: "#eef2ff", padding: "14px 16px" }}>
                <div style={{ fontSize: 13, color: "#3730a3", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Premium auto-reply metrics
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                  <div style={{ borderRadius: 10, backgroundColor: "#ffffff", border: "1px solid #e0e7ff", padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, color: "#4338ca", fontWeight: 700, textTransform: "uppercase" }}>Attempted</div>
                    <div style={{ fontSize: 24, color: "#1e1b4b", fontWeight: 800 }}>{premium?.autoReplyAttempted ?? 0}</div>
                  </div>

                  <div style={{ borderRadius: 10, backgroundColor: "#ffffff", border: "1px solid #dcfce7", padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>Posted</div>
                    <div style={{ fontSize: 24, color: "#14532d", fontWeight: 800 }}>{premium?.autoReplyPosted ?? 0}</div>
                  </div>

                  <div style={{ borderRadius: 10, backgroundColor: "#ffffff", border: "1px solid #fecaca", padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 700, textTransform: "uppercase" }}>Failed</div>
                    <div style={{ fontSize: 24, color: "#991b1b", fontWeight: 800 }}>{premium?.autoReplyFailed ?? 0}</div>
                  </div>

                  <div style={{ borderRadius: 10, backgroundColor: "#ffffff", border: "1px solid #bfdbfe", padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase" }}>Success rate</div>
                    <div style={{ fontSize: 24, color: "#1e3a8a", fontWeight: 800 }}>{premium?.autoReplySuccessRate ?? 0}%</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Sentiment Analysis Section */}
        <section style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a", fontWeight: 800 }}>Sentiment analysis</h2>
              <p style={{ marginTop: 6, marginBottom: 0, color: "#475569", fontSize: 15 }}>
                Manual analysis for Basic and Premium. Premium adds deeper AI insight cards and trend views.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {hasSentimentCache && !isStale && (
                <span style={{ fontSize: 14, color: "#475569", fontWeight: 700 }}>
                  Re-analyze unlocks when new reviews are synced.
                </span>
              )}
              <button
                onClick={() => handleAnalyzeSentiment(isStale)}
                disabled={isReanalyzeDisabled}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1.5px solid #e2e8f0",
                  backgroundColor: isReanalyzeDisabled ? "#e2e8f0" : "#ffffff",
                  color: isReanalyzeDisabled ? "#94a3b8" : "#0f172a",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: isReanalyzeDisabled ? "not-allowed" : "pointer",
                  transition: "all 0.2s"
                }}
              >
                {sentimentLoading ? "Analyzing..." : isStale ? "Re-analyze" : sentimentCache ? "Up to date" : "Analyze Reviews"}
              </button>
            </div>
          </div>

          {isStale && sentimentCache && (
            <div style={{
              backgroundColor: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: 12,
              padding: 12,
              marginBottom: 14
            }}>
              <p style={{ margin: 0, fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                ⚠️ Last analyzed: {new Date(sentimentCache.analyzed_at).toLocaleString()}
                <br />
                {sentimentCache.analyzed_review_count} reviews analyzed, {newReviewsCount} new reviews since then
              </p>
            </div>
          )}

          {!isStale && sentimentCache && (
            <div style={{
              backgroundColor: "#dcfce7",
              border: "1px solid #86efac",
              borderRadius: 12,
              padding: 12,
              marginBottom: 14,
              fontSize: 15,
              color: "#166534",
              fontWeight: 600
            }}>
              ✓ Last analyzed: {new Date(sentimentCache.analyzed_at).toLocaleString()} ({sentimentCache.analyzed_review_count} reviews)
            </div>
          )}

          {!sentimentCache && !sentimentLoading && (
            <div style={{
              backgroundColor: "#f0f9ff",
              border: "1px solid #bfdbfe",
              borderRadius: 12,
              padding: 12,
              marginBottom: 14,
              fontSize: 15,
              color: "#1e40af",
              fontWeight: 600
            }}>
              Click Analyze Reviews to compute sentiment insights
            </div>
          )}
        </section>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
          <PieChart
            title="Ratings distribution"
            data={analytics?.charts.ratings ?? []}
            palette={["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"]}
          />
          <PieChart
            title="Reply status mix"
            data={analytics?.charts.replyStatuses ?? []}
            palette={["#3b82f6", "#22c55e", "#059669", "#ef4444", "#94a3b8"]}
          />
          <PieChart
            title="Reply source mix"
            data={analytics?.charts.replySources ?? []}
            palette={["#6366f1", "#14b8a6", "#0ea5e9"]}
          />
          {sentimentCache && (
            <PieChart
              title="Sentiment breakdown"
              data={[
                { label: "Positive", value: sentimentCache.sentiment_positive },
                { label: "Neutral", value: sentimentCache.sentiment_neutral },
                { label: "Negative", value: sentimentCache.sentiment_negative }
              ]}
              palette={["#22c55e", "#f59e0b", "#ef4444"]}
            />
          )}
          {!sentimentCache && (
            <PieChart
              title="Sentiment breakdown"
              data={[]}
              palette={["#22c55e", "#f59e0b", "#ef4444"]}
            />
          )}
        </div>

        {/* Premium Sentiment Features */}
        {canUsePremiumInsights && sentimentCache && (
          <section style={{
            marginTop: 20,
            borderRadius: 20,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
          }}>
            <div style={{ backgroundColor: "#0f172a", padding: "24px 32px" }}>
              <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#a5b4fc", margin: 0 }}>
                Premium analytics
              </p>
              <h2 style={{ fontSize: 30, fontWeight: 800, color: "#ffffff", margin: "8px 0 0", letterSpacing: "-0.4px" }}>
                Premium Insight Layer
              </h2>
              <p style={{ fontSize: 15, color: "#64748b", marginTop: 6, maxWidth: 700 }}>
                Recurring themes, AI recommended actions, and sentiment movement context beyond the standard sentiment split.
              </p>
            </div>

            <div style={{ padding: "24px 32px" }}>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 16 }}>
                <PremiumInsightCard
                  eyebrow="Coverage"
                  title={`${analyzedReviewCount} reviews analyzed`}
                  body="Premium insights summarize the analyzed review set, so your theme and suggestion cards stay grounded in the same cached snapshot."
                />
                <PremiumInsightCard
                  eyebrow="Primary focus"
                  title={primaryFocusTitle}
                  body={`This is the top operational issue recurring in your latest analyzed review set.}`}
                />
                <PremiumInsightCard
                  eyebrow="Strongest signal"
                  title={topThemes[0] ? `${topThemes[0][0]} (${topThemes[0][1].count})` : "No recurring theme yet"}
                  body="Recurring topics help you separate one-off comments from repeated customer experience issues."
                />
              </div>

              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)" }}>
                <div style={{ display: "grid", gap: 16 }}>
                  {topThemes.length > 0 && (
                    <div style={{ borderRadius: 16, border: "1px solid #e2e8f0", backgroundColor: "#ffffff", padding: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Recurring themes</h3>
                          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#475569" }}>Most-mentioned topics found in the latest analysis snapshot.</p>
                        </div>
                      </div>
                      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                        {topThemes.map(([theme, data]) => {
                          const context = getThemeSentimentContext(theme)
                          return (
                            <div key={theme} style={{ display: "grid", gap: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 15, color: "#0f172a", fontWeight: 700, textTransform: "capitalize" }}>{theme}</span>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: context.toneColor }}>{context.emoji} {context.label}</span>
                                </span>
                                <span style={{ fontSize: 14, color: "#6366f1", fontWeight: 800, whiteSpace: "nowrap" }}>{data.count} mentions</span>
                              </div>
                              <div style={{ height: 8, borderRadius: 999, backgroundColor: "#e2e8f0", overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${Math.max(8, Math.round((data.count / Math.max(topThemes[0]?.[1].count ?? 1, 1)) * 100))}%`,
                                    borderRadius: 999,
                                    background: "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)",
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <StackedSentimentTrend title="Sentiment movement" data={sortedTrendData} />
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                  <div style={{ borderRadius: 16, border: "1px solid #e2e8f0", backgroundColor: "#ffffff", padding: 18 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>AI Recommended actions</h3>
                    <p style={{ margin: "6px 0 0", fontSize: 14, color: "#475569" }}>Use these cues to decide where to respond, retrain staff, or adjust operations.</p>
                    {sentimentCache.suggestions?.basis && (
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Based on {sentimentCache.suggestions.basis}</p>
                    )}

                    <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ef4444" }}>Focus areas</div>
                        {(sentimentCache.suggestions?.focus_areas?.length ?? 0) > 0 ? (
                          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                            {(sentimentCache.suggestions?.focus_areas ?? []).map((area, idx) => (
                              <div key={idx} style={{ borderRadius: 12, backgroundColor: "#fff7ed", border: "1px solid #fdba74", padding: "10px 12px", fontSize: 15, color: "#9a3412", fontWeight: 600 }}>
                                {area}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: "10px 0 0", fontSize: 15, color: "#475569" }}>No focus areas were surfaced in this analysis yet.</p>
                        )}
                      </div>

                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#16a34a" }}>Strengths</div>
                        {(sentimentCache.suggestions?.strengths?.length ?? 0) > 0 ? (
                          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                            {(sentimentCache.suggestions?.strengths ?? []).map((strength, idx) => (
                              <div key={idx} style={{ borderRadius: 12, backgroundColor: "#f0fdf4", border: "1px solid #86efac", padding: "10px 12px", fontSize: 15, color: "#166534", fontWeight: 600 }}>
                                {strength}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: "10px 0 0", fontSize: 15, color: "#475569" }}>No standout strengths were surfaced in this analysis yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {canUsePremiumInsights && (
          <section style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a", fontWeight: 800 }}>Premium trend views</h2>
              <p style={{ marginTop: 6, marginBottom: 0, color: "#475569", fontSize: 15 }}>
                Daily movement across reviews, posted replies, and negative sentiment.
              </p>
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              <TrendBars title="Reviews by day" data={advanced?.trends.reviewsByDay ?? []} color="#3b82f6" />
              <TrendBars title="Posted replies by day" data={advanced?.trends.postedRepliesByDay ?? []} color="#059669" />
              <TrendBars title="Negative sentiment by day" data={advanced?.trends.negativeSentimentByDay ?? []} color="#ef4444" />
              <TrendBars title="Reply coverage by day (%)" data={replyCoverageByDay} color="#8b5cf6" />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
