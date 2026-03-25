"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { ReviewWithAnalysis } from "../types/review"
import { REPLY_TONE_LABELS, type ReplyTone } from "@/lib/replyTone"

const MAX_GENERATIONS_PER_REVIEW = 5

interface Props {
  review: ReviewWithAnalysis
  mode: "needs-attention" | "posted" | "deleted"
  canReplyActions?: boolean
  showCheckbox?: boolean
  isChecked?: boolean
  isExpanded?: boolean
  onToggleCheck?: (reviewId: string) => void
  onToggleExpand?: (reviewId: string) => void
  onMarkedPosted: (reviewId: string, replyText: string, source: "ai" | "user" | "system") => void
  onMarkedDeleted?: (reviewId: string, replyText: string) => void
  onReplyChanged?: (reviewId: string, replyText: string, status: "draft" | "posted" | "deleted") => void
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "R"
  )
}

const BTN_BLUE   = { bg: "#2563eb", border: "#1d4ed8", text: "#ffffff" }
const BTN_SLATE  = { bg: "#f8fafc", border: "#94a3b8", text: "#1e293b" }
const BTN_GREEN  = { bg: "#059669", border: "#047857", text: "#ffffff" }
const BTN_OFF    = { bg: "#e2e8f0", border: "#cbd5e1", text: "#94a3b8" }

function formatReviewDate(value?: string) {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

function resolveSentimentMeta(review: ReviewWithAnalysis) {
  const firstAnalysis = review.review_analysis?.[0]
  const analysisSentiment = typeof firstAnalysis?.sentiment === "string"
    ? firstAnalysis.sentiment.toLowerCase()
    : ""

  const rating = Number(review.rating)
  const sentiment = analysisSentiment === "positive" || analysisSentiment === "neutral" || analysisSentiment === "negative"
    ? analysisSentiment
    : (rating >= 4 ? "positive" : rating <= 2 ? "negative" : "neutral")

  if (sentiment === "positive") {
    return { emoji: "😊", label: "Positive", bg: "#dcfce7", border: "#86efac", color: "#166534" }
  }

  if (sentiment === "negative") {
    return { emoji: "☹️", label: "Negative", bg: "#fee2e2", border: "#fecaca", color: "#991b1b" }
  }

  return { emoji: "😐", label: "Neutral", bg: "#fef9c3", border: "#fde68a", color: "#854d0e" }
}

export default function ReviewCard({
  review,
  mode,
  canReplyActions = true,
  showCheckbox,
  isChecked,
  isExpanded,
  onToggleCheck,
  onToggleExpand,
  onMarkedPosted,
  onMarkedDeleted,
  onReplyChanged,
}: Props) {
  const [latestTone, setLatestTone] = useState<{ base: ReplyTone; effective: ReplyTone; adapted: boolean } | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null)
  const [replyText, setReplyText] = useState(review.latest_reply?.reply_text ?? "")
  const [savedText, setSavedText] = useState(review.latest_reply?.reply_text ?? "")
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sessionExpiredRedirecting, setSessionExpiredRedirecting] = useState(false)
  const [currentAttempts, setCurrentAttempts] = useState(review.ai_reply_attempts ?? 0)

  useEffect(() => {
    if (!actionMessage) return
    const timer = setTimeout(() => setActionMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [actionMessage])

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
      // Refresh a little early to avoid race conditions at request time.
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
    const text = review.latest_reply?.reply_text ?? ""
    setReplyText(text)
    setSavedText(text)
    setCurrentAttempts(review.ai_reply_attempts ?? 0)
  }, [review.id, review.latest_reply?.reply_text, review.ai_reply_attempts])

  function showActionMessage(type: "success" | "error", text: string) {
    setActionMessage({ type, text })
  }

  async function generateReply() {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      console.error("generate-reply aborted: no valid access token")
      return
    }
    setGenerating(true)
    try {
      const res = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, review_text: review.review_text, rating: review.rating }),
      })
      if (!res.ok) {
        let errorBody: unknown = null
        try {
          errorBody = await res.json()
        } catch {
          errorBody = await res.text()
        }
        console.error("generate-reply failed", { status: res.status, body: errorBody })
        showActionMessage("error", "Could not generate reply. Please try again.")
        return
      }

      const data = await res.json()

      if (data?.reply) {
        setReplyText(data.reply)
        if (data?.tone?.base && data?.tone?.effective) {
          setLatestTone({
            base: data.tone.base,
            effective: data.tone.effective,
            adapted: Boolean(data.tone.adapted),
          })
        } else {
          setLatestTone(null)
        }
        onReplyChanged?.(review.id, data.reply, "draft")
        showActionMessage("success", "Reply generated.")
        
        // Refetch the review to get the updated ai_reply_attempts from server
        try {
          const refreshRes = await fetch("/api/get-reviews", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ businessId: review.business_id }),
          })
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json()
            const updatedReview = refreshData.reviews?.find((r: ReviewWithAnalysis) => r.id === review.id)
            if (updatedReview) {
              setCurrentAttempts(updatedReview.ai_reply_attempts ?? 0)
            }
          }
        } catch (err) {
          console.error("Failed to refresh review data", err)
        }
      }
    } catch (error) {
      console.error("generate-reply request failed", error)
      showActionMessage("error", "Could not generate reply. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  async function saveDraft() {
    if (!replyText.trim()) return
    const accessToken = await getAccessToken()
    if (!accessToken) {
      console.error("save-reply aborted: no valid access token")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/save-reply", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, replyText }),
      })

      if (!res.ok) {
        let errorBody: unknown = null
        try {
          errorBody = await res.json()
        } catch {
          errorBody = await res.text()
        }
        console.error("save-reply failed", { status: res.status, body: errorBody })
        showActionMessage("error", "Could not save draft. Please try again.")
        return
      }

      onReplyChanged?.(review.id, replyText, "draft")
      setSavedText(replyText)
      showActionMessage("success", "Draft saved.")
    } catch (error) {
      console.error("save-reply request failed", error)
      showActionMessage("error", "Could not save draft. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function saveAndPostReply() {
    if (!replyText.trim()) return
    const accessToken = await getAccessToken()
    if (!accessToken) {
      console.error("post-reply aborted: no valid access token")
      return
    }
    setPosting(true)
    try {
      const res = await fetch("/api/post-reply", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, replyText }),
      })

      if (!res.ok) {
        let errorBody: unknown = null
        try {
          errorBody = await res.json()
        } catch {
          errorBody = await res.text()
        }
        console.error("post-reply failed", { status: res.status, body: errorBody })
        showActionMessage("error", "Could not post reply. Please try again.")
        return
      }

      const data = await res.json()
      onMarkedPosted(review.id, replyText, data?.reply?.source ?? "user")
      showActionMessage("success", "Reply posted successfully.")
    } catch (error) {
      console.error("post-reply request failed", error)
      showActionMessage("error", "Could not post reply. Please try again.")
    } finally {
      setPosting(false)
    }
  }

  async function deletePostedReply() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("This will remove the posted reply from Google Reviews. Do you want to continue?")
      if (!confirmed) {
        return
      }
    }

    const accessToken = await getAccessToken()
    if (!accessToken) {
      console.error("delete-reply aborted: no valid access token")
      return
    }

    setDeleting(true)
    try {
      const res = await fetch("/api/delete-reply", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id }),
      })

      if (!res.ok) {
        let errorBody: unknown = null
        try {
          errorBody = await res.json()
        } catch {
          errorBody = await res.text()
        }
        console.error("delete-reply failed", { status: res.status, body: errorBody })
        return
      }

      onMarkedDeleted?.(review.id, replyText)
      onReplyChanged?.(review.id, replyText, "deleted")
    } finally {
      setDeleting(false)
    }
  }

  const isNA = mode === "needs-attention"
  const isDeleted = mode === "deleted"
  const expanded = isExpanded ?? true
  const isDirty = replyText !== savedText
  const remainingAttempts = Math.max(0, MAX_GENERATIONS_PER_REVIEW - currentAttempts)
  const genOff  = !canReplyActions || generating || remainingAttempts === 0
  const saveOff = !canReplyActions || saving || !isDirty
  const postOff = !canReplyActions || posting || !replyText.trim()
  const attemptsReached = remainingAttempts === 0

  const cardBackground = isDeleted ? "#fff1f2" : isNA ? "#fffbeb" : "#f0fdf4"
  const cardBorder = isDeleted ? "#fda4af" : isNA ? "#fcd34d" : "#6ee7b7"
  const dividerBorder = isDeleted ? "#fecdd3" : isNA ? "#fde68a" : "#a7f3d0"
  const badgeBackground = isDeleted ? "#ffe4e6" : isNA ? "#fef3c7" : "#dcfce7"
  const badgeBorder = isDeleted ? "#fecdd3" : isNA ? "#fde68a" : "#bbf7d0"
  const badgeColor = isDeleted ? "#9f1239" : isNA ? "#78350f" : "#14532d"
  const chevronColor = isDeleted ? "#e11d48" : isNA ? "#b45309" : "#059669"
  const statusLabel = isDeleted ? "Deleted" : isNA ? "Needs attention" : "Posted"
  const sentimentMeta = resolveSentimentMeta(review)

  const persistedTone =
    review.latest_reply?.tone_base && review.latest_reply?.tone_effective
      ? {
          base: review.latest_reply.tone_base as ReplyTone,
          effective: review.latest_reply.tone_effective as ReplyTone,
          adapted: Boolean(review.latest_reply.tone_adapted),
        }
      : null

  const displayedTone = latestTone ?? persistedTone

  return (
    <div style={{
      backgroundColor: cardBackground,
      border: `1.5px solid ${cardBorder}`,
      borderRadius: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
      overflow: "hidden",
    }}>

      {/* ── header row (always visible, click to expand/collapse) ─────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>
        {showCheckbox && isNA && (
          <input
            type="checkbox"
            checked={Boolean(isChecked)}
            onChange={() => onToggleCheck?.(review.id)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 16, height: 16, accentColor: "#2563eb", flexShrink: 0, cursor: "pointer" }}
          />
        )}

        {/* avatar */}
        <div style={{
          fontSize: 14, fontWeight: 700, color: "#ffffff",
        }}>
          {initials(review.author_name)}
        </div>

        {/* name/rating + review preview — clicking expands/collapses */}
        <div
          onClick={() => onToggleExpand?.(review.id)}
          style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minWidth: 0 }}
        >
          <div style={{ minWidth: 0, flexShrink: 0 }}>
            <p style={{ fontWeight: 600, color: "#0f172a", margin: 0, minWidth: 0 }}>{review.author_name}</p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "1px 0 0" }}>Customer review</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
              <p style={{ fontSize: 14, margin: 0, color: "#b45309", fontWeight: 800, letterSpacing: "0.02em" }}>
              {"★".repeat(Math.min(5, Number(review.rating) || 0))}
              {"☆".repeat(Math.max(0, 5 - (Number(review.rating) || 0)))}
              </p>
              <span
                title={`Sentiment: ${sentimentMeta.label}`}
                aria-label={`Sentiment: ${sentimentMeta.label}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  border: `1.5px solid ${sentimentMeta.border}`,
                  backgroundColor: sentimentMeta.bg,
                  color: sentimentMeta.color,
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {sentimentMeta.emoji}
              </span>
            </div>
          </div>

          <div style={{ minWidth: 0, flex: 1, borderLeft: "1px solid #cbd5e1", paddingLeft: 12 }}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: "#334155",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
              }}
              title={review.review_text || ""}
            >
              &ldquo;{(review.review_text ?? "").trim() || "No review text"}&rdquo;
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              {formatReviewDate(review.review_time || review.created_at)}
            </p>
          </div>
        </div>

        {/* status badge + chevron */}
        <div
          onClick={() => onToggleExpand?.(review.id)}
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
        >
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
            backgroundColor: badgeBackground,
            border: `1px solid ${badgeBorder}`,
            color: badgeColor,
            whiteSpace: "nowrap",
          }}>
            {statusLabel}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: chevronColor }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* ── collapsible body ─────────────────────────────────────────── */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${dividerBorder}` }}>

          {isNA || isDeleted ? (
            <>
              {/* textarea */}
              <textarea
                rows={4}
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value)
                }}
                readOnly={!canReplyActions}
                style={{
                  marginTop: 10, width: "100%", boxSizing: "border-box", resize: "vertical",
                  borderRadius: 10, border: `1.5px solid ${isDeleted ? "#fda4af" : "#fcd34d"}`,
                  backgroundColor: "#ffffff", padding: "10px 12px",
                  fontSize: 14, color: "#1e293b", outline: "none", fontFamily: "inherit",
                }}
              />

              {/* buttons row */}
              <div style={{
                marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8,
                borderTop: `1px solid ${isDeleted ? "#fecdd3" : "#fcd34d"}`,
                paddingTop: 10,
              }}>
                <button
                  onClick={generateReply}
                  disabled={genOff}
                  title={attemptsReached ? "All 5 attempts used. You can edit or post your reply." : undefined}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: genOff ? "not-allowed" : "pointer",
                    backgroundColor: genOff ? BTN_OFF.bg : BTN_BLUE.bg,
                    border: `1px solid ${genOff ? BTN_OFF.border : BTN_BLUE.border}`,
                    color: genOff ? BTN_OFF.text : BTN_BLUE.text,
                  }}
                >
                  {generating ? "Generating\u2026" : attemptsReached ? "All attempts used" : "Generate Reply"}
                </button>

                <button
                  onClick={saveDraft}
                  disabled={saveOff}
                  title={saveOff && !saving ? "Edit the reply first to enable Save" : undefined}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: saveOff ? "not-allowed" : "pointer",
                    backgroundColor: saveOff ? BTN_OFF.bg : BTN_SLATE.bg,
                    border: `1px solid ${saveOff ? BTN_OFF.border : BTN_SLATE.border}`,
                    color: saveOff ? BTN_OFF.text : BTN_SLATE.text,
                  }}
                >
                  {saving ? "Saving\u2026" : "Save"}
                </button>

                <button
                  onClick={saveAndPostReply}
                  disabled={postOff}
                  style={{
                    padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: postOff ? "not-allowed" : "pointer",
                    backgroundColor: postOff ? BTN_OFF.bg : BTN_GREEN.bg,
                    border: `1px solid ${postOff ? BTN_OFF.border : BTN_GREEN.border}`,
                    color: postOff ? BTN_OFF.text : BTN_GREEN.text,
                  }}
                >
                  {posting ? "Posting\u2026" : "Save and Post"}
                </button>

                {displayedTone && !isDeleted && (
                  <span
                    style={{
                      marginLeft: 4,
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      alignSelf: "center",
                      backgroundColor: "#ecfdf5",
                      border: "1px solid #bbf7d0",
                      color: "#14532d",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Tone: {REPLY_TONE_LABELS[displayedTone.effective]}
                    {displayedTone.adapted ? ` (from ${REPLY_TONE_LABELS[displayedTone.base]})` : ""}
                  </span>
                )}

                {!isDeleted && (
                  <span
                    style={{
                      marginLeft: 4,
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      alignSelf: "center",
                      backgroundColor: remainingAttempts === 0 ? "#fee2e2" : remainingAttempts === 1 ? "#fef3c7" : "#dbeafe",
                      border: remainingAttempts === 0 ? "1px solid #fca5a5" : remainingAttempts === 1 ? "1px solid #fcd34d" : "1px solid #93c5fd",
                      color: remainingAttempts === 0 ? "#991b1b" : remainingAttempts === 1 ? "#78350f" : "#1e3a8a",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {remainingAttempts} {remainingAttempts === 1 ? "attempt" : "attempts"} left
                  </span>
                )}

                {actionMessage && (
                  <span
                    style={{
                      marginLeft: 4,
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      alignSelf: "center",
                      backgroundColor: actionMessage.type === "success" ? "#dcfce7" : actionMessage.type === "warning" ? "#fef3c7" : "#fee2e2",
                      border: `1px solid ${actionMessage.type === "success" ? "#86efac" : actionMessage.type === "warning" ? "#fcd34d" : "#fca5a5"}`,
                      color: actionMessage.type === "success" ? "#14532d" : actionMessage.type === "warning" ? "#78350f" : "#991b1b",
                    }}
                  >
                    {actionMessage.text}
                  </span>
                )}

                {!canReplyActions && (
                  <span
                    style={{
                      marginLeft: 4,
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      alignSelf: "center",
                      backgroundColor: "#fee2e2",
                      border: "1px solid #fca5a5",
                      color: "#991b1b",
                    }}
                  >
                    Your role can view reviews but cannot edit or post replies.
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{
                marginTop: 10, borderRadius: 10, padding: "10px 14px",
                fontSize: 13, lineHeight: 1.7, color: "#1e293b",
                backgroundColor: "#ffffff", border: "1px solid #a7f3d0",
              }}>
                {replyText || <span style={{ color: "#94a3b8" }}>No reply text</span>}
              </div>

              <div style={{
                marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8,
                borderTop: "1px solid #a7f3d0", paddingTop: 10,
              }}>
                <button
                  onClick={deletePostedReply}
                  disabled={deleting || !canReplyActions}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: deleting || !canReplyActions ? "not-allowed" : "pointer",
                    backgroundColor: deleting || !canReplyActions ? BTN_OFF.bg : "#dc2626",
                    border: `1px solid ${deleting || !canReplyActions ? BTN_OFF.border : "#b91c1c"}`,
                    color: deleting || !canReplyActions ? BTN_OFF.text : "#ffffff",
                  }}
                >
                  {deleting ? "Deleting..." : "Delete Post"}
                </button>

                {displayedTone && (
                  <span
                    style={{
                      marginLeft: 4,
                      borderRadius: 999,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      alignSelf: "center",
                      backgroundColor: "#ecfdf5",
                      border: "1px solid #bbf7d0",
                      color: "#14532d",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Tone: {REPLY_TONE_LABELS[displayedTone.effective]}
                    {displayedTone.adapted ? ` (from ${REPLY_TONE_LABELS[displayedTone.base]})` : ""}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
