"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import ReviewCard from "./ReviewCard"
import { ReviewWithAnalysis } from "../types/review"

type Props = {
  reviews: ReviewWithAnalysis[]
}

export default function ReviewList({ reviews }: Props) {
  const [localReviews, setLocalReviews] = useState<ReviewWithAnalysis[]>(reviews)
  const [isNeedsAttentionOpen, setIsNeedsAttentionOpen] = useState(true)
  const [isPostedOpen, setIsPostedOpen] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [bulkPosting, setBulkPosting] = useState(false)
  const [sessionExpiredRedirecting, setSessionExpiredRedirecting] = useState(false)

  async function handleSessionExpired() {
    if (sessionExpiredRedirecting) return
    setSessionExpiredRedirecting(true)

    await supabase.auth.signOut()

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("auth_notice", "session_expired")
      window.location.href = "/login?reason=session-expired"
    }
  }

  function isTokenExpired(token: string) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1])) as { exp?: number }
      if (!payload.exp) return false
      return payload.exp <= Math.floor(Date.now() / 1000) + 30
    } catch {
      return true
    }
  }

  async function getAccessToken() {
    const { data: sessionData } = await supabase.auth.getSession()
    const current = sessionData.session?.access_token

    if (current && !isTokenExpired(current)) {
      return current
    }

    const { data: refreshedData, error } = await supabase.auth.refreshSession()
    if (error) {
      console.error("auth refresh failed", error.message)
      await handleSessionExpired()
      return null
    }

    const refreshedToken = refreshedData.session?.access_token ?? null
    if (!refreshedToken) {
      await handleSessionExpired()
      return null
    }

    return refreshedToken
  }

  useEffect(() => {
    setLocalReviews(reviews)
  }, [reviews])

  function priorityScore(review: ReviewWithAnalysis) {
    let score = 0
    const sentiment = review.review_analysis?.[0]?.sentiment
    const rating = Number(review.rating)
    const status = review.latest_reply?.status

    if (sentiment === "negative") score += 50
    if (rating <= 2) score += 40
    if (status === "draft" || status === "failed") score += 30

    return score
  }

  const sortedReviews = useMemo(() => {
    return [...localReviews].sort((a, b) => {
      const priorityDiff = priorityScore(b) - priorityScore(a)
      if (priorityDiff !== 0) return priorityDiff

      const aTime = new Date(a.created_at).getTime()
      const bTime = new Date(b.created_at).getTime()

      return bTime - aTime
    })
  }, [localReviews])

  const needsAttention = useMemo(() => {
    return sortedReviews.filter((review) => {
      const status = review.latest_reply?.status
      return status === "draft" || status === "failed"
    })
  }, [sortedReviews])

  const posted = useMemo(() => {
    return sortedReviews.filter((review) => review.latest_reply?.status === "posted")
  }, [sortedReviews])

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>()
      const validNeedsAttentionIds = new Set(needsAttention.map((review) => review.id))

      prev.forEach((id) => {
        if (validNeedsAttentionIds.has(id)) {
          next.add(id)
        }
      })

      return next
    })
  }, [needsAttention])

  // auto-expand newly arriving cards
  useEffect(() => {
    setExpandedIds((prev) => {
      const newIds = [...needsAttention, ...posted]
        .filter((r) => !prev.has(r.id))
        .map((r) => r.id)
      if (newIds.length === 0) return prev
      const next = new Set(prev)
      newIds.forEach((id) => next.add(id))
      return next
    })
  }, [needsAttention, posted])

  function handleMarkedPosted(reviewId: string, replyText: string) {
    setLocalReviews((prev) =>
      prev.map((review) => {
        if (review.id !== reviewId) return review

        const latestReplyId = review.latest_reply?.id ?? review.latest_reply_id ?? `${reviewId}-local-reply`

        return {
          ...review,
          latest_reply_id: latestReplyId,
          latest_reply: {
            id: latestReplyId,
            review_id: review.id,
            reply_text: replyText,
            source: review.latest_reply?.source ?? "user",
            status: "posted",
            created_at: new Date().toISOString()
          }
        }
      })
    )

    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(reviewId)
      return next
    })
  }

  const memoizedHandleMarkedPosted = useCallback(handleMarkedPosted, [])

  function handleReplyChanged(reviewId: string, replyText: string, status: "draft" | "posted") {
    console.log("handleReplyChanged called:", { reviewId, replyText, status })
    setLocalReviews((prev) =>
      prev.map((review) => {
        if (review.id !== reviewId) return review

        const latestReplyId = review.latest_reply?.id ?? review.latest_reply_id ?? `${reviewId}-local-reply`

        return {
          ...review,
          latest_reply_id: latestReplyId,
          latest_reply: {
            id: latestReplyId,
            review_id: review.id,
            reply_text: replyText,
            source: review.latest_reply?.source ?? "user",
            status,
            created_at: new Date().toISOString()
          }
        }
      })
    )
  }

  const memoizedHandleReplyChanged = useCallback(handleReplyChanged, [])

  function toggleSelected(reviewId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(reviewId)) {
        next.delete(reviewId)
      } else {
        next.add(reviewId)
      }
      return next
    })
  }

  const memoizedToggleSelected = useCallback(toggleSelected, [])

  const memoizedToggleExpand = useCallback((reviewId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(reviewId)) next.delete(reviewId)
      else next.add(reviewId)
      return next
    })
  }, [])

  function selectAllNeedsAttention() {
    setSelectedIds(new Set(needsAttention.map((review) => review.id)))
  }

  function clearSelected() {
    setSelectedIds(new Set())
  }

  function expandAllNA() {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      needsAttention.forEach((r) => next.add(r.id))
      return next
    })
  }

  function collapseAllNA() {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      needsAttention.forEach((r) => next.delete(r.id))
      return next
    })
  }

  function expandAllPosted() {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      posted.forEach((r) => next.add(r.id))
      return next
    })
  }

  function collapseAllPosted() {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      posted.forEach((r) => next.delete(r.id))
      return next
    })
  }

  async function generateForSelected() {
    if (selectedIds.size === 0) return

    setBulkGenerating(true)

    try {
      const token = await getAccessToken()
      if (!token) {
        console.error("bulk generate aborted: no valid access token")
        return
      }

      const selectedReviews = needsAttention.filter((review) => selectedIds.has(review.id))

      const results = await Promise.all(
        selectedReviews.map(async (review) => {
          const res = await fetch("/api/generate-reply", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              reviewId: review.id,
              review_text: review.review_text,
              rating: review.rating
            })
          })

          if (!res.ok) {
            let errorBody: unknown = null
            try {
              errorBody = await res.json()
            } catch {
              errorBody = await res.text()
            }
            console.error("bulk generate-reply failed", { reviewId: review.id, status: res.status, body: errorBody })
            return {
              reviewId: review.id,
              replyText: undefined,
            }
          }

          const data = await res.json()

          return {
            reviewId: review.id,
            replyText: data.reply as string | undefined
          }
        })
      )

      results.forEach((result) => {
        if (result.replyText) {
          handleReplyChanged(result.reviewId, result.replyText, "draft")
        }
      })
    } finally {
      setBulkGenerating(false)
    }
  }

  async function saveAndPostSelected() {
    if (selectedIds.size === 0) return

    setBulkPosting(true)

    try {
      const token = await getAccessToken()
      if (!token) {
        console.error("bulk post aborted: no valid access token")
        return
      }

      const selectedReviews = needsAttention.filter((review) => selectedIds.has(review.id))

      await Promise.all(
        selectedReviews.map(async (review) => {
          const replyText = (review.latest_reply?.reply_text ?? "").trim()
          if (!replyText) return

          const res = await fetch("/api/post-reply", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              reviewId: review.id,
              replyText
            })
          })

          if (res.ok) {
            handleMarkedPosted(review.id, replyText)
          }
        })
      )
    } finally {
      setBulkPosting(false)
    }
  }

  function renderNeedsAttention() {
    if (needsAttention.length === 0) {
      return (
        <div style={{
          borderRadius: 12, border: "1.5px dashed #fcd34d",
          backgroundColor: "#fffbeb", padding: 32,
          textAlign: "center", fontSize: 14, color: "#92400e",
        }}>
          No reviews need attention.
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {needsAttention.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            mode="needs-attention"
            showCheckbox
            isChecked={selectedIds.has(review.id)}
            isExpanded={expandedIds.has(review.id)}
            onToggleCheck={memoizedToggleSelected}
            onToggleExpand={memoizedToggleExpand}
            onMarkedPosted={memoizedHandleMarkedPosted}
            onReplyChanged={memoizedHandleReplyChanged}
          />
        ))}
      </div>
    )
  }

  function renderPosted() {
    if (posted.length === 0) {
      return (
        <div style={{
          borderRadius: 12, border: "1.5px dashed #6ee7b7",
          backgroundColor: "#f0fdf4", padding: 32,
          textAlign: "center", fontSize: 14, color: "#065f46",
        }}>
          No replies have been posted yet.
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {posted.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            mode="posted"
            isExpanded={expandedIds.has(review.id)}
            onToggleExpand={memoizedToggleExpand}
            onMarkedPosted={memoizedHandleMarkedPosted}
          />
        ))}
      </div>
    )
  }

  return (
    <div style={{ borderRadius: 24, border: "1px solid #e2e8f0", backgroundColor: "#ffffff", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
      {/* ── toolbar ─────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: "#ffffff", padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>Reviews</h2>
        </div>
      </div>

      {/* ── sections ────────────────────────────────────────────────────── */}
      <div style={{ padding: 24 }}>

        {/* Needs attention section */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setIsNeedsAttentionOpen((prev) => !prev)}
              style={{
                flex: 1, display: "flex", alignItems: "center",
                justifyContent: "space-between", padding: "12px 16px",
                borderRadius: 12, cursor: "pointer", textAlign: "left",
                backgroundColor: "#fffbeb", border: "2px solid #f59e0b",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  backgroundColor: "#f59e0b", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, color: "#ffffff",
                }}>
                  !
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#78350f" }}>
                  Needs attention ({needsAttention.length})
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#b45309" }}>
                {isNeedsAttentionOpen ? "▼ Hide" : "▶ Show"}
              </span>
            </button>

            {isNeedsAttentionOpen && needsAttention.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: "7px 10px", borderRadius: 8,
                  backgroundColor: "#fef3c7", border: "1px solid #fde68a", color: "#78350f",
                  whiteSpace: "nowrap",
                }}>
                  {selectedIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={selectAllNeedsAttention}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", backgroundColor: "#ffffff",
                    border: "1px solid #f59e0b", color: "#b45309", whiteSpace: "nowrap",
                  }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearSelected}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", backgroundColor: "#ffffff",
                    border: "1px solid #f59e0b", color: "#b45309", whiteSpace: "nowrap",
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={generateForSelected}
                  disabled={selectedIds.size === 0 || bulkGenerating}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: selectedIds.size === 0 || bulkGenerating ? "not-allowed" : "pointer",
                    backgroundColor: selectedIds.size === 0 || bulkGenerating ? "#e2e8f0" : "#2563eb",
                    border: `1px solid ${selectedIds.size === 0 || bulkGenerating ? "#cbd5e1" : "#1d4ed8"}`,
                    color: selectedIds.size === 0 || bulkGenerating ? "#94a3b8" : "#ffffff",
                    whiteSpace: "nowrap",
                  }}
                >
                  {bulkGenerating ? "Generating…" : `Generate (${selectedIds.size})`}
                </button>
                <button
                  type="button"
                  onClick={saveAndPostSelected}
                  disabled={selectedIds.size === 0 || bulkPosting}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: selectedIds.size === 0 || bulkPosting ? "not-allowed" : "pointer",
                    backgroundColor: selectedIds.size === 0 || bulkPosting ? "#e2e8f0" : "#059669",
                    border: `1px solid ${selectedIds.size === 0 || bulkPosting ? "#cbd5e1" : "#047857"}`,
                    color: selectedIds.size === 0 || bulkPosting ? "#94a3b8" : "#ffffff",
                    whiteSpace: "nowrap",
                  }}
                >
                  {bulkPosting ? "Posting…" : `Save & Post (${selectedIds.size})`}
                </button>
                <button
                  type="button"
                  onClick={expandAllNA}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", backgroundColor: "#ffffff",
                    border: "1px solid #f59e0b", color: "#b45309", whiteSpace: "nowrap",
                  }}
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={collapseAllNA}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", backgroundColor: "#ffffff",
                    border: "1px solid #f59e0b", color: "#b45309", whiteSpace: "nowrap",
                  }}
                >
                  Collapse all
                </button>
              </div>
            )}
          </div>

          {isNeedsAttentionOpen && renderNeedsAttention()}
        </section>

        {/* Posted section */}
        <section style={{ borderTop: "2px solid #f1f5f9", paddingTop: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setIsPostedOpen((prev) => !prev)}
              style={{
                flex: 1, display: "flex", alignItems: "center",
                justifyContent: "space-between", padding: "12px 16px",
                borderRadius: 12, cursor: "pointer", textAlign: "left",
                backgroundColor: "#f0fdf4", border: "2px solid #10b981",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  backgroundColor: "#10b981", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, color: "#ffffff",
                }}>
                  ✓
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#14532d" }}>
                  Posted ({posted.length})
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#059669" }}>
                {isPostedOpen ? "▼ Hide" : "▶ Show"}
              </span>
            </button>

            {isPostedOpen && posted.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={expandAllPosted}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", backgroundColor: "#ffffff",
                    border: "1px solid #10b981", color: "#065f46", whiteSpace: "nowrap",
                  }}
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={collapseAllPosted}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", backgroundColor: "#ffffff",
                    border: "1px solid #10b981", color: "#065f46", whiteSpace: "nowrap",
                  }}
                >
                  Collapse all
                </button>
              </div>
            )}
          </div>

          {isPostedOpen && renderPosted()}
        </section>
      </div>
    </div>
  )
}
