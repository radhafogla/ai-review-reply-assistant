"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import { useSubscription } from "@/app/hooks/useSubscription"
import { getTrialEndedUpgradeMessage, hasFeature } from "@/lib/subscription"
import { BUSINESS_ROLES, hasAnyRole, type BusinessMemberRole } from "@/lib/businessRoles"

import ReviewList from "../components/ReviewList"
import EmptyState from "../components/EmptyState"

import { ReviewWithAnalysis } from "../types/review"

export default function Dashboard() {
  const { subscription } = useSubscription()

  const [reviews, setReviews] = useState<ReviewWithAnalysis[]>([])
  const [hasBusiness, setHasBusiness] = useState(true)
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string | null }>>([])
  const [selectedBusinessRole, setSelectedBusinessRole] = useState<BusinessMemberRole | null>(null)
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("")
  const [allReviewsAverageRating, setAllReviewsAverageRating] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [historicalBacklogCount, setHistoricalBacklogCount] = useState(0)
  const [historicalBacklogLoaded, setHistoricalBacklogLoaded] = useState(false)
  const [loadingHistoricalBacklog, setLoadingHistoricalBacklog] = useState(false)
  const hasEnsuredUserRef = useRef(false)
  const skipNextBusinessFetchRef = useRef(false)

  const reviewsNeedingAttention =
    reviews.filter((review) => {
      const status = review.latest_reply?.status
      return review.needs_ai_reply && review.is_actionable && (!status || status === "draft" || status === "failed" || status === "deleted")
    }).length

  const backlogReviews = historicalBacklogCount
  const totalReviews = reviews.length + backlogReviews

  const postedReviews =
    reviews.filter((review) => review.latest_reply?.status === "posted").length

  const noReplyReviews =
    reviews.filter((review) => review.is_actionable && !review.latest_reply).length

  const activeReviewBase =
    reviews.filter((review) => review.is_actionable || Boolean(review.latest_reply)).length

  const averageRating =
    allReviewsAverageRating !== null
      ? allReviewsAverageRating.toFixed(1)
      : reviews.length > 0
        ? (
            reviews.reduce((sum, review) => sum + Number(review.rating), 0) /
            reviews.length
          ).toFixed(1)
        : "—"

  const replyCoverage =
    activeReviewBase > 0
      ? Math.round(((activeReviewBase - noReplyReviews) / activeReviewBase) * 100)
      : 0

  const canBulkActions = hasFeature(subscription.plan, "bulkActions")
  const canReplyActions = selectedBusinessRole ? hasAnyRole(selectedBusinessRole, ["responder"]) : false

  const ensureUserRecord = useCallback(async (accessToken: string) => {
    if (hasEnsuredUserRef.current) {
      return
    }

    await fetch("/api/ensure-user", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    })

    hasEnsuredUserRef.current = true
  }, [])

  const loadReviews = useCallback(async (businessId?: string, includeHistoricalBacklog = false) => {

    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()

    const accessToken = session?.access_token

    if (!accessToken) {
      setHasBusiness(false)
      setLoading(false)
      return
    }

    await ensureUserRecord(accessToken)

    const res = await fetch("/api/get-reviews", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        businessId: businessId || undefined,
        includeHistoricalBacklog,
      })
    })

    const data = await res.json()

    if (!Array.isArray(data?.reviews)) {
      setHasBusiness(false)
      setAllReviewsAverageRating(null)
      setLoading(false)
      return
    }

    const nextBusinesses = Array.isArray(data?.businesses) ? data.businesses : []
    const roleFromResponse = BUSINESS_ROLES.includes(data?.selectedBusinessRole as BusinessMemberRole)
      ? (data.selectedBusinessRole as BusinessMemberRole)
      : null

    if (nextBusinesses.length === 0) {
      setHasBusiness(false)
      setBusinesses([])
      setSelectedBusinessRole(null)
      setReviews([])
      setAllReviewsAverageRating(null)
      setHistoricalBacklogCount(0)
      setHistoricalBacklogLoaded(false)
      setLoading(false)
      return
    }

    setHasBusiness(true)
    setBusinesses(nextBusinesses)
    setSelectedBusinessRole(roleFromResponse)
    setAllReviewsAverageRating(
      typeof data?.allReviewsAverageRating === "number" && Number.isFinite(data.allReviewsAverageRating)
        ? data.allReviewsAverageRating
        : null,
    )
    setHistoricalBacklogCount(Number(data?.historicalBacklogCount ?? 0))
    if (!includeHistoricalBacklog) {
      setHistoricalBacklogLoaded(false)
    } else {
      setHistoricalBacklogLoaded(true)
    }
    if (data?.selectedBusinessId) {
      setSelectedBusinessId((prev) => {
        if (prev === data.selectedBusinessId) {
          return prev
        }

        skipNextBusinessFetchRef.current = true
        return data.selectedBusinessId
      })
    }
    setReviews(data.reviews)
    setLoading(false)
  }, [ensureUserRecord])

  const loadHistoricalBacklog = useCallback(async () => {
    if (historicalBacklogLoaded || loadingHistoricalBacklog) {
      return
    }

    setLoadingHistoricalBacklog(true)
    try {
      await loadReviews(selectedBusinessId || undefined, true)
    } finally {
      setLoadingHistoricalBacklog(false)
    }
  }, [historicalBacklogLoaded, loadingHistoricalBacklog, loadReviews, selectedBusinessId])

  useEffect(() => {
    if (skipNextBusinessFetchRef.current) {
      skipNextBusinessFetchRef.current = false
      return
    }

    const run = async () => {
      await loadReviews(selectedBusinessId || undefined, false)
    }

    run()
  }, [selectedBusinessId, loadReviews])

  if (!hasBusiness) return <EmptyState />

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <div style={{ maxWidth: 1680, margin: "0 auto", padding: "20px 24px 36px" }}>
        {/* ── HEADER CARD ─────────────────────────────────────────────────── */}
        <section style={{
          marginBottom: 12, borderRadius: 20, overflow: "hidden",
          border: "1px solid #e2e8f0", backgroundColor: "#ffffff",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        }}>

          {/* dark banner */}
          <div style={{ backgroundColor: "#0f172a", padding: "20px 28px" }}>
            <p style={{
              fontSize: 14, fontWeight: 700, letterSpacing: "0.16em",
              textTransform: "uppercase", color: "#fcd34d", margin: 0,
            }}>
              Review command center
            </p>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "#ffffff", margin: "6px 0 0", letterSpacing: "-0.5px" }}>
              Customer reply desk
            </h1>
            <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 5, maxWidth: 560 }}>
              Two-lane workflow — act on reviews that need attention, track what&#39;s already posted.
            </p>
          </div>

          {/* stats row */}
          <div style={{ padding: "18px 24px" }}>

            {/* business selector + avg rating */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
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

                {subscription.warnings.length > 0 && (
                  <span
                    style={{
                      borderRadius: 999,
                      border: "1px solid #fde68a",
                      backgroundColor: "#fffbeb",
                      padding: "6px 10px",
                      color: "#92400e",
                      fontSize: 14,
                      fontWeight: 700,
                      maxWidth: 520,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={subscription.warnings.map((warning) => `${warning.label} ${warning.used}/${warning.limit} (${warning.percentUsed}%)`).join(" • ")}
                  >
                    Usage: {subscription.warnings.map((warning) => `${warning.label} ${warning.used}/${warning.limit} (${warning.percentUsed}%)`).join(" • ")}
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
                  {averageRating} Avg Rating
                </span>
              </div>
            </div>

            {/* stat cards */}
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>

              {/* Total */}
              <div style={{
                borderRadius: 14, border: "1.5px solid #e2e8f0",
                backgroundColor: "#f8fafc", padding: "14px 18px",
              }}>
                <p style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", margin: 0 }}>
                  Total reviews
                </p>
                <p style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "8px 0 0" }}>
                  {totalReviews}
                </p>
              </div>

              {/* Needs attention */}
              <div style={{
                borderRadius: 14, border: "1.5px solid #fcd34d",
                backgroundColor: "#fffbeb", padding: "14px 18px",
              }}>
                <p style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#b45309", margin: 0 }}>
                  Needs attention
                </p>
                <p style={{ fontSize: 26, fontWeight: 800, color: "#78350f", margin: "8px 0 0" }}>
                  {reviewsNeedingAttention}
                </p>
              </div>

              <div style={{
                borderRadius: 14, border: "1.5px solid #c4b5fd",
                backgroundColor: "#f5f3ff", padding: "14px 18px",
              }}>
                <p style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6d28d9", margin: 0 }}>
                  Historical backlog
                </p>
                <p style={{ fontSize: 26, fontWeight: 800, color: "#5b21b6", margin: "8px 0 0" }}>
                  {backlogReviews}
                </p>
              </div>

              {/* Posted */}
              <div style={{
                borderRadius: 14, border: "1.5px solid #6ee7b7",
                backgroundColor: "#f0fdf4", padding: "14px 18px",
              }}>
                <p style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#065f46", margin: 0 }}>
                  Posted replies
                </p>
                <p style={{ fontSize: 26, fontWeight: 800, color: "#14532d", margin: "8px 0 0" }}>
                  {postedReviews}
                </p>
              </div>

              {/* Reply coverage */}
              <div style={{
                borderRadius: 14, border: "1.5px solid #93c5fd",
                backgroundColor: "#eff6ff", padding: "14px 18px",
              }}>
                <p style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1d4ed8", margin: 0 }}>
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

        {subscription.plan === "free" && subscription.trialExpired && (
          <div style={{
            marginTop: 16,
            borderRadius: 12,
            border: "1px solid #fecaca",
            backgroundColor: "#fef2f2",
            padding: "12px 14px",
            color: "#991b1b",
            fontSize: 13,
            fontWeight: 700,
          }}>
            {getTrialEndedUpgradeMessage()}
            <Link href="/subscriptions" style={{ marginLeft: 8, color: "#b91c1c", textDecoration: "underline" }}>
              View plans
            </Link>
          </div>
        )}

        {!canBulkActions && subscription.plan !== "free" && (
          <div style={{
            marginTop: 16,
            borderRadius: 12,
            border: "1px solid #bfdbfe",
            backgroundColor: "#eff6ff",
            padding: "12px 14px",
            color: "#1e3a8a",
            fontSize: 13,
            fontWeight: 600,
          }}>
            Your current plan limits bulk actions. Upgrade in Subscriptions to unlock bulk generate and bulk post.
          </div>
        )}

        <ReviewList
          reviews={reviews}
          canBulkActions={canBulkActions}
          canReplyActions={canReplyActions}
          historicalBacklogCount={historicalBacklogCount}
          historicalBacklogLoaded={historicalBacklogLoaded}
          loadingHistoricalBacklog={loadingHistoricalBacklog}
          onLoadHistoricalBacklog={loadHistoricalBacklog}
        />

      </div>
    </div>
  )
}