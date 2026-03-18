"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import { useSubscription } from "@/app/hooks/useSubscription"
import { getFeatureGateTitle, getFeatureGateUpgradeHint, hasFeature } from "@/lib/subscription"
import EmptyState from "@/app/components/EmptyState"

type Bucket = { label: string; value: number }

type AnalyticsPayload = {
  totals: {
    reviews: number
    replies: number
    analyses: number
    businesses: number
    integrations: number
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
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>No data yet</p>
          ) : (
            segments.map((seg) => (
              <div key={seg.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: seg.color, display: "inline-block" }} />
                  <span style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{seg.label}</span>
                </div>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{seg.value} ({seg.percent}%)</span>
              </div>
            ))
          )}
        </div>
      </div>
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

  const loadAnalytics = useCallback(async (businessId?: string) => {
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
      body: JSON.stringify({ businessId: businessId || undefined }),
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
      setSelectedBusinessId((prev) => (prev === data.selectedBusinessId ? prev : data.selectedBusinessId))
    }
    setAnalytics(data?.analytics ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (subscriptionLoading || !hasFeature(subscription.plan, "analytics")) return

    const run = async () => {
      await loadAnalytics(selectedBusinessId || undefined)
    }
    run()
  }, [selectedBusinessId, loadAnalytics, subscription.plan, subscriptionLoading])

  if (!subscriptionLoading && !hasFeature(subscription.plan, "analytics")) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", padding: "32px 24px 40px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <section style={{ borderRadius: 16, border: "1px solid #bfdbfe", backgroundColor: "#eff6ff", padding: 24 }}>
            <h1 style={{ margin: 0, fontSize: 26, color: "#1e3a8a", fontWeight: 800 }}>{getFeatureGateTitle("analytics")}</h1>
            <p style={{ marginTop: 8, marginBottom: 0, color: "#334155", fontSize: 14, lineHeight: 1.7 }}>
              {getFeatureGateUpgradeHint("analytics")}
            </p>
            <Link
              href="/subscriptions"
              style={{
                marginTop: 14,
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 10,
                border: "1px solid #1d4ed8",
                backgroundColor: "#2563eb",
                color: "#fff",
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              View Subscriptions
            </Link>
          </section>
        </div>
      </div>
    )
  }

  if (!hasBusiness) return <EmptyState />

  const totals = analytics?.totals
  const premium = analytics?.premium
  const isPremiumPlan = (totals?.plan || subscription.plan).toLowerCase() === "premium"

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <div style={{ maxWidth: 1680, margin: "0 auto", padding: "32px 24px 40px" }}>
        <section style={{
          marginBottom: 24,
          borderRadius: 20,
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        }}>
          <div style={{ backgroundColor: "#0f172a", padding: "24px 32px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#fdba74", margin: 0 }}>
              Basic subscription analytics
            </p>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#ffffff", margin: "8px 0 0", letterSpacing: "-0.4px" }}>
              Review insights
            </h1>
            <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, maxWidth: 620 }}>
              Snapshot across schema tables: reviews, replies, analysis, integrations, and subscription status.
            </p>
          </div>

          <div style={{ padding: "24px 32px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label htmlFor="analytics-business-filter" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                  Business scope
                </label>
                <select
                  id="analytics-business-filter"
                  value={selectedBusinessId}
                  onChange={(e) => setSelectedBusinessId(e.target.value)}
                  style={{ minWidth: 280, borderRadius: 10, border: "1.5px solid #cbd5e1", backgroundColor: "#fff", color: "#0f172a", fontSize: 13, fontWeight: 600, padding: "8px 12px", outline: "none" }}
                >
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name?.trim() || business.id}
                    </option>
                  ))}
                </select>
                {loading && <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Loading...</span>}
              </div>

              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                backgroundColor: "#fff7ed", border: "1px solid #fdba74",
                borderRadius: 99, padding: "6px 14px",
              }}>
                <span style={{ fontSize: 12, color: "#9a3412", fontWeight: 700 }}>
                  Plan: {(totals?.plan || "free").toUpperCase()} ({totals?.subscriptionStatus || "active"})
                </span>
              </div>
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div style={{ borderRadius: 12, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Reviews</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{totals?.reviews ?? 0}</div>
              </div>
              <div style={{ borderRadius: 12, backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#065f46", fontWeight: 700, textTransform: "uppercase" }}>Replies</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#14532d", marginTop: 4 }}>{totals?.replies ?? 0}</div>
              </div>
              <div style={{ borderRadius: 12, backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase" }}>Analysis rows</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#1e3a8a", marginTop: 4 }}>{totals?.analyses ?? 0}</div>
              </div>
              <div style={{ borderRadius: 12, backgroundColor: "#fefce8", border: "1px solid #fde68a", padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#854d0e", fontWeight: 700, textTransform: "uppercase" }}>Integrations</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#78350f", marginTop: 4 }}>{totals?.integrations ?? 0}</div>
              </div>
            </div>

            {isPremiumPlan && (
              <div style={{ marginTop: 16, borderRadius: 14, border: "1.5px solid #c7d2fe", backgroundColor: "#eef2ff", padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#3730a3", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Premium auto-reply metrics
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                  <div style={{ borderRadius: 10, backgroundColor: "#ffffff", border: "1px solid #e0e7ff", padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#4338ca", fontWeight: 700, textTransform: "uppercase" }}>Attempted</div>
                    <div style={{ fontSize: 24, color: "#1e1b4b", fontWeight: 800 }}>{premium?.autoReplyAttempted ?? 0}</div>
                  </div>

                  <div style={{ borderRadius: 10, backgroundColor: "#ffffff", border: "1px solid #dcfce7", padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>Posted</div>
                    <div style={{ fontSize: 24, color: "#14532d", fontWeight: 800 }}>{premium?.autoReplyPosted ?? 0}</div>
                  </div>

                  <div style={{ borderRadius: 10, backgroundColor: "#ffffff", border: "1px solid #fecaca", padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#b91c1c", fontWeight: 700, textTransform: "uppercase" }}>Failed</div>
                    <div style={{ fontSize: 24, color: "#991b1b", fontWeight: 800 }}>{premium?.autoReplyFailed ?? 0}</div>
                  </div>

                  <div style={{ borderRadius: 10, backgroundColor: "#ffffff", border: "1px solid #bfdbfe", padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700, textTransform: "uppercase" }}>Success rate</div>
                    <div style={{ fontSize: 24, color: "#1e3a8a", fontWeight: 800 }}>{premium?.autoReplySuccessRate ?? 0}%</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
          <PieChart title="Ratings distribution" data={analytics?.charts.ratings ?? []} palette={["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"]} />
          <PieChart title="Reply status mix" data={analytics?.charts.replyStatuses ?? []} palette={["#3b82f6", "#22c55e", "#059669", "#ef4444", "#94a3b8"]} />
          <PieChart title="Reply source mix" data={analytics?.charts.replySources ?? []} palette={["#6366f1", "#14b8a6", "#0ea5e9"]} />
          <PieChart title="Sentiment breakdown" data={analytics?.charts.sentiment ?? []} palette={["#22c55e", "#f59e0b", "#ef4444"]} />
        </div>
      </div>
    </div>
  )
}
