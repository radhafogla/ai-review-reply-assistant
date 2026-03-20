"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import ReviewCard from "./ReviewCard"
import { ReviewWithAnalysis } from "../types/review"

type Props = {
  reviews: ReviewWithAnalysis[]
  canBulkActions?: boolean
  canReplyActions?: boolean
  historicalBacklogCount?: number
  historicalBacklogLoaded?: boolean
  loadingHistoricalBacklog?: boolean
  onLoadHistoricalBacklog?: () => Promise<void> | void
}

export default function ReviewList({
  reviews,
  canBulkActions = true,
  canReplyActions = true,
  historicalBacklogCount = 0,
  historicalBacklogLoaded = false,
  loadingHistoricalBacklog = false,
  onLoadHistoricalBacklog,
}: Props) {
  const [localReviews, setLocalReviews] = useState<ReviewWithAnalysis[]>(reviews)
  const [isNeedsAttentionOpen, setIsNeedsAttentionOpen] = useState(true)
  const [isBacklogOpen, setIsBacklogOpen] = useState(false)
  const [isDeletedOpen, setIsDeletedOpen] = useState(false)
  const [isPostedOpen, setIsPostedOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [bulkPosting, setBulkPosting] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [sessionExpiredRedirecting, setSessionExpiredRedirecting] = useState(false)

  useEffect(() => {
    if (!bulkMessage) return
    const timer = setTimeout(() => setBulkMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [bulkMessage])

  function showBulkMessage(type: "success" | "error", text: string) {
    setBulkMessage({ type, text })
  }

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

  const sortedReviews = useMemo(() => {
    return [...localReviews].sort((a, b) => {
      const aTime = new Date(a.review_time ?? a.review_date ?? a.created_at).getTime()
      const bTime = new Date(b.review_time ?? b.review_date ?? b.created_at).getTime()
      return bTime - aTime
    })
  }, [localReviews])

  const needsAttention = useMemo(() => {
    return sortedReviews.filter((review) => {
      const status = review.latest_reply?.status
      return review.needs_ai_reply && review.is_actionable && (!status || status === "draft" || status === "failed")
    })
  }, [sortedReviews])

  const backlog = useMemo(() => {
    return sortedReviews.filter((review) => review.needs_ai_reply && !review.is_actionable)
  }, [sortedReviews])

  const visibleBacklogCount = historicalBacklogLoaded ? backlog.length : historicalBacklogCount

  const deletedReplies = useMemo(() => {
    return sortedReviews.filter((review) => review.latest_reply?.status === "deleted")
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
      const newIds = [...needsAttention, ...backlog, ...deletedReplies, ...posted]
        .filter((r) => !prev.has(r.id))
        .map((r) => r.id)
      if (newIds.length === 0) return prev
      const next = new Set(prev)
      newIds.forEach((id) => next.add(id))
      return next
    })
  }, [needsAttention, backlog, deletedReplies, posted])

  function handleMarkedPosted(reviewId: string, replyText: string, source: "ai" | "user" | "system") {
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
            source,
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

  function handleMarkedDeleted(reviewId: string, replyText: string) {
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
            status: "deleted",
            created_at: new Date().toISOString(),
          },
        }
      }),
    )
  }

  const memoizedHandleMarkedDeleted = useCallback(handleMarkedDeleted, [])

  function handleReplyChanged(reviewId: string, replyText: string, status: "draft" | "posted" | "deleted") {
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

  function expandAllDeleted() {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      deletedReplies.forEach((r) => next.add(r.id))
      return next
    })
  }

  function collapseAllDeleted() {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      deletedReplies.forEach((r) => next.delete(r.id))
      return next
    })
  }

  async function generateForSelected() {
    if (!canBulkActions || !canReplyActions) return
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

      const successCount = results.filter((result) => Boolean(result.replyText)).length
      const failureCount = results.length - successCount

      if (successCount > 0 && failureCount === 0) {
        showBulkMessage("success", `Generated ${successCount} replies.`)
      } else if (successCount > 0 && failureCount > 0) {
        showBulkMessage("error", `Generated ${successCount} replies. ${failureCount} failed.`)
      } else {
        showBulkMessage("error", "Could not generate replies. Please try again.")
      }
    } catch (error) {
      console.error("bulk generate failed", error)
      showBulkMessage("error", "Could not generate replies. Please try again.")
    } finally {
      setBulkGenerating(false)
    }
  }

  async function saveAndPostSelected() {
    if (!canBulkActions || !canReplyActions) return
    if (selectedIds.size === 0) return

    setBulkPosting(true)

    try {
      const token = await getAccessToken()
      if (!token) {
        console.error("bulk post aborted: no valid access token")
        return
      }

      const selectedReviews = needsAttention.filter((review) => selectedIds.has(review.id))

      const results = await Promise.all(
        selectedReviews.map(async (review) => {
          const replyText = (review.latest_reply?.reply_text ?? "").trim()
          if (!replyText) {
            return { reviewId: review.id, posted: false }
          }

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
            const data = await res.json()
            handleMarkedPosted(review.id, replyText, data?.reply?.source ?? "user")
            return { reviewId: review.id, posted: true }
          }

          let errorBody: unknown = null
          try {
            errorBody = await res.json()
          } catch {
            errorBody = await res.text()
          }
          console.error("bulk post-reply failed", { reviewId: review.id, status: res.status, body: errorBody })
          return { reviewId: review.id, posted: false }
        })
      )

      const successCount = results.filter((result) => result.posted).length
      const failureCount = results.length - successCount

      if (successCount > 0 && failureCount === 0) {
        showBulkMessage("success", `Posted ${successCount} replies.`)
      } else if (successCount > 0 && failureCount > 0) {
        showBulkMessage("error", `Posted ${successCount} replies. ${failureCount} failed.`)
      } else {
        showBulkMessage("error", "Could not post replies. Please try again.")
      }
    } catch (error) {
      console.error("bulk post failed", error)
      showBulkMessage("error", "Could not post replies. Please try again.")
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
      <div className="flex flex-col gap-5">
        {needsAttention.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            mode="needs-attention"
            canReplyActions={canReplyActions}
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
      <div className="flex flex-col gap-5">
        {posted.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            mode="posted"
            canReplyActions={canReplyActions}
            isExpanded={expandedIds.has(review.id)}
            onToggleExpand={memoizedToggleExpand}
            onMarkedPosted={memoizedHandleMarkedPosted}
            onMarkedDeleted={memoizedHandleMarkedDeleted}
          />
        ))}
      </div>
    )
  }

  function renderDeleted() {
    if (deletedReplies.length === 0) {
      return (
        <div style={{
          borderRadius: 12, border: "1.5px dashed #fda4af",
          backgroundColor: "#fff1f2", padding: 32,
          textAlign: "center", fontSize: 14, color: "#9f1239",
        }}>
          No deleted replies.
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-5">
        {deletedReplies.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            mode="deleted"
            canReplyActions={canReplyActions}
            isExpanded={expandedIds.has(review.id)}
            onToggleExpand={memoizedToggleExpand}
            onMarkedPosted={memoizedHandleMarkedPosted}
            onReplyChanged={memoizedHandleReplyChanged}
          />
        ))}
      </div>
    )
  }

  function renderBacklog() {
    if (!historicalBacklogLoaded) {
      return (
        <div style={{
          borderRadius: 12, border: "1.5px dashed #c4b5fd",
          backgroundColor: "#f5f3ff", padding: 32,
          textAlign: "center", fontSize: 14, color: "#6d28d9",
        }}>
          {loadingHistoricalBacklog
            ? "Loading historical backlog..."
            : "Expand this section to load historical backlog reviews."}
        </div>
      )
    }

    if (backlog.length === 0) {
      return (
        <div style={{
          borderRadius: 12, border: "1.5px dashed #c4b5fd",
          backgroundColor: "#f5f3ff", padding: 32,
          textAlign: "center", fontSize: 14, color: "#6d28d9",
        }}>
          No historical backlog reviews.
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-5">
        {backlog.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            mode="needs-attention"
            canReplyActions={canReplyActions}
            isExpanded={expandedIds.has(review.id)}
            onToggleExpand={memoizedToggleExpand}
            onMarkedPosted={memoizedHandleMarkedPosted}
            onReplyChanged={memoizedHandleReplyChanged}
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
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b", fontWeight: 600 }}>
          Generate AI replies, then edit and save/post when ready. You can also post directly when the draft looks good.
        </p>
      </div>

      {/* ── sections ────────────────────────────────────────────────────── */}
      <div style={{ padding: 24 }}>

        {bulkMessage && (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: bulkMessage.type === "success" ? "#dcfce7" : "#fee2e2",
              border: `1px solid ${bulkMessage.type === "success" ? "#86efac" : "#fca5a5"}`,
              color: bulkMessage.type === "success" ? "#14532d" : "#991b1b",
            }}
          >
            {bulkMessage.text}
          </div>
        )}

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
                  disabled={!canBulkActions}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: canBulkActions ? "pointer" : "not-allowed",
                    backgroundColor: canBulkActions ? "#ffffff" : "#e2e8f0",
                    border: `1px solid ${canBulkActions ? "#f59e0b" : "#cbd5e1"}`,
                    color: canBulkActions ? "#b45309" : "#94a3b8", whiteSpace: "nowrap",
                  }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearSelected}
                  disabled={!canBulkActions}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: canBulkActions ? "pointer" : "not-allowed",
                    backgroundColor: canBulkActions ? "#ffffff" : "#e2e8f0",
                    border: `1px solid ${canBulkActions ? "#f59e0b" : "#cbd5e1"}`,
                    color: canBulkActions ? "#b45309" : "#94a3b8", whiteSpace: "nowrap",
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={generateForSelected}
                  disabled={!canBulkActions || !canReplyActions || selectedIds.size === 0 || bulkGenerating}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: !canBulkActions || !canReplyActions || selectedIds.size === 0 || bulkGenerating ? "not-allowed" : "pointer",
                    backgroundColor: !canBulkActions || !canReplyActions || selectedIds.size === 0 || bulkGenerating ? "#e2e8f0" : "#2563eb",
                    border: `1px solid ${!canBulkActions || !canReplyActions || selectedIds.size === 0 || bulkGenerating ? "#cbd5e1" : "#1d4ed8"}`,
                    color: !canBulkActions || !canReplyActions || selectedIds.size === 0 || bulkGenerating ? "#94a3b8" : "#ffffff",
                    whiteSpace: "nowrap",
                  }}
                >
                  {bulkGenerating ? "Generating…" : `Generate (${selectedIds.size})`}
                </button>
                <button
                  type="button"
                  onClick={saveAndPostSelected}
                  disabled={!canBulkActions || !canReplyActions || selectedIds.size === 0 || bulkPosting}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: !canBulkActions || !canReplyActions || selectedIds.size === 0 || bulkPosting ? "not-allowed" : "pointer",
                    backgroundColor: !canBulkActions || !canReplyActions || selectedIds.size === 0 || bulkPosting ? "#e2e8f0" : "#059669",
                    border: `1px solid ${!canBulkActions || !canReplyActions || selectedIds.size === 0 || bulkPosting ? "#cbd5e1" : "#047857"}`,
                    color: !canBulkActions || !canReplyActions || selectedIds.size === 0 || bulkPosting ? "#94a3b8" : "#ffffff",
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
        <section style={{ borderTop: "2px solid #f1f5f9", paddingTop: 32, marginBottom: 32 }}>
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

        <section style={{ borderTop: "2px solid #f1f5f9", paddingTop: 32, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => {
                const nextOpen = !isBacklogOpen
                setIsBacklogOpen(nextOpen)

                if (nextOpen && !historicalBacklogLoaded && visibleBacklogCount > 0) {
                  onLoadHistoricalBacklog?.()
                }
              }}
              style={{
                flex: 1, display: "flex", alignItems: "center",
                justifyContent: "space-between", padding: "12px 16px",
                borderRadius: 12, cursor: "pointer", textAlign: "left",
                backgroundColor: "#f5f3ff", border: "2px solid #8b5cf6",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  backgroundColor: "#8b5cf6", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, color: "#ffffff",
                }}>
                  H
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#5b21b6" }}>
                  Historical backlog ({visibleBacklogCount})
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed" }}>
                {isBacklogOpen ? "▼ Hide" : "▶ Show"}
              </span>
            </button>
          </div>

          {isBacklogOpen && renderBacklog()}
        </section>

        {/* Deleted section */}
        <section style={{ borderTop: "2px solid #f1f5f9", paddingTop: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setIsDeletedOpen((prev) => !prev)}
              style={{
                flex: 1, display: "flex", alignItems: "center",
                justifyContent: "space-between", padding: "12px 16px",
                borderRadius: 12, cursor: "pointer", textAlign: "left",
                backgroundColor: "#fff1f2", border: "2px solid #fb7185",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  backgroundColor: "#e11d48", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, color: "#ffffff",
                }}>
                  ×
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#9f1239" }}>
                  Deleted from Google ({deletedReplies.length})
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#be123c" }}>
                {isDeletedOpen ? "▼ Hide" : "▶ Show"}
              </span>
            </button>

            {isDeletedOpen && deletedReplies.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={expandAllDeleted}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", backgroundColor: "#ffffff",
                    border: "1px solid #fb7185", color: "#9f1239", whiteSpace: "nowrap",
                  }}
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={collapseAllDeleted}
                  style={{
                    padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", backgroundColor: "#ffffff",
                    border: "1px solid #fb7185", color: "#9f1239", whiteSpace: "nowrap",
                  }}
                >
                  Collapse all
                </button>
              </div>
            )}
          </div>

          {isDeletedOpen && renderDeleted()}
        </section>
      </div>
    </div>
  )
}
