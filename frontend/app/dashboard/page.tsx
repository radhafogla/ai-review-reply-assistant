"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

import ReviewList from "../components/ReviewList"
import EmptyState from "../components/EmptyState"

import { ReviewWithAnalysis } from "../types/review"

export default function Dashboard() {

  const [reviews, setReviews] = useState<ReviewWithAnalysis[]>([])
  const [hasBusiness, setHasBusiness] = useState(true)
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string | null }>>([])
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const reviewsNeedingAttention =
    reviews.filter((review) => {
      const status = review.latest_reply?.status
      return status === "draft" || status === "failed"
    }).length

  const postedReviews =
    reviews.filter((review) => review.latest_reply?.status === "posted").length

  const noReplyReviews =
    reviews.filter((review) => !review.latest_reply).length

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, review) => sum + Number(review.rating), 0) /
          reviews.length
        ).toFixed(1)
      : "—"

  const replyCoverage =
    reviews.length > 0
      ? Math.round(((reviews.length - noReplyReviews) / reviews.length) * 100)
      : 0

  const loadReviews = useCallback(async (businessId?: string) => {

    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()

    const accessToken = session?.access_token

    if (!accessToken) {
      setHasBusiness(false)
      return
    }

    await fetch("/api/ensure-user", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    })

    const res = await fetch("/api/get-reviews", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ businessId: businessId || undefined })
    })

    const data = await res.json()

    if (!Array.isArray(data?.reviews)) {
      setHasBusiness(false)
      setLoading(false)
      return
    }

    const nextBusinesses = Array.isArray(data?.businesses) ? data.businesses : []

    if (nextBusinesses.length === 0) {
      setHasBusiness(false)
      setBusinesses([])
      setReviews([])
      setLoading(false)
      return
    }

    setHasBusiness(true)
    setBusinesses(nextBusinesses)
    if (data?.selectedBusinessId) {
      setSelectedBusinessId((prev) => (prev === data.selectedBusinessId ? prev : data.selectedBusinessId))
    }
    setReviews(data.reviews)
    setLoading(false)
  }, [])

  useEffect(() => {
    const run = async () => {
      await loadReviews(selectedBusinessId || undefined)
    }

    run()
  }, [selectedBusinessId, loadReviews])

  if (!hasBusiness) return <EmptyState />

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <div style={{ maxWidth: 1680, margin: "0 auto", padding: "32px 24px 40px" }}>
        {/* ── HEADER CARD ─────────────────────────────────────────────────── */}
        <section style={{
          marginBottom: 24, borderRadius: 20, overflow: "hidden",
          border: "1px solid #e2e8f0", backgroundColor: "#ffffff",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        }}>

          {/* dark banner */}
          <div style={{ backgroundColor: "#0f172a", padding: "24px 32px" }}>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.16em",
              textTransform: "uppercase", color: "#fcd34d", margin: 0,
            }}>
              Review command center
            </p>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#ffffff", margin: "8px 0 0", letterSpacing: "-0.5px" }}>
              Customer reply desk
            </h1>
            <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, maxWidth: 560 }}>
              Two-lane workflow — act on reviews that need attention, track what&#39;s already posted.
            </p>
          </div>

          {/* stats row */}
          <div style={{ padding: "24px 32px" }}>

            {/* business selector + avg rating */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <label htmlFor="business-filter" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                  Business scope
                </label>
                <select
                  id="business-filter"
                  value={selectedBusinessId}
                  onChange={(e) => setSelectedBusinessId(e.target.value)}
                  style={{
                    minWidth: 280,
                    borderRadius: 10,
                    border: "1.5px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "8px 12px",
                    outline: "none",
                  }}
                >
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name?.trim() || business.id}
                    </option>
                  ))}
                </select>
                {loading && (
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                    Loading...
                  </span>
                )}
              </div>

              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                backgroundColor: "#fffbeb", border: "1px solid #fde68a",
                borderRadius: 99, padding: "6px 16px",
              }}>
                <span style={{ fontSize: 18, color: "#f59e0b" }}>★</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#78350f" }}>
                  {averageRating} avg rating
                </span>
              </div>
            </div>

            {/* 4 stat cards */}
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>

              {/* Total */}
              <div style={{
                borderRadius: 14, border: "1.5px solid #e2e8f0",
                backgroundColor: "#f8fafc", padding: "16px 20px",
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", margin: 0 }}>
                  Total reviews
                </p>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "8px 0 0" }}>
                  {reviews.length}
                </p>
              </div>

              {/* Needs attention */}
              <div style={{
                borderRadius: 14, border: "1.5px solid #fcd34d",
                backgroundColor: "#fffbeb", padding: "16px 20px",
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#b45309", margin: 0 }}>
                  Needs attention
                </p>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#78350f", margin: "8px 0 0" }}>
                  {reviewsNeedingAttention}
                </p>
              </div>

              {/* Posted */}
              <div style={{
                borderRadius: 14, border: "1.5px solid #6ee7b7",
                backgroundColor: "#f0fdf4", padding: "16px 20px",
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#065f46", margin: 0 }}>
                  Posted replies
                </p>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#14532d", margin: "8px 0 0" }}>
                  {postedReviews}
                </p>
              </div>

              {/* Reply coverage */}
              <div style={{
                borderRadius: 14, border: "1.5px solid #93c5fd",
                backgroundColor: "#eff6ff", padding: "16px 20px",
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1d4ed8", margin: 0 }}>
                  Reply coverage
                </p>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#1e3a8a", margin: "8px 0 0" }}>
                  {replyCoverage}%
                </p>
                {/* progress bar */}
                <div style={{ marginTop: 10, height: 6, borderRadius: 99, backgroundColor: "#bfdbfe" }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    backgroundColor: "#2563eb",
                    width: `${replyCoverage}%`,
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>

            </div>
          </div>
        </section>

        <ReviewList reviews={reviews} />

      </div>
    </div>
  )
}