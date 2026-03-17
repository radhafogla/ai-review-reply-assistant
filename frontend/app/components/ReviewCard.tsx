"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { ReviewWithAnalysis } from "../types/review"

interface Props {
  review: ReviewWithAnalysis
  mode: "needs-attention" | "posted"
  showCheckbox?: boolean
  isChecked?: boolean
  isExpanded?: boolean
  onToggleCheck?: (reviewId: string) => void
  onToggleExpand?: (reviewId: string) => void
  onMarkedPosted: (reviewId: string, replyText: string) => void
  onReplyChanged?: (reviewId: string, replyText: string, status: "draft" | "posted") => void
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

export default function ReviewCard({
  review,
  mode,
  showCheckbox,
  isChecked,
  isExpanded,
  onToggleCheck,
  onToggleExpand,
  onMarkedPosted,
  onReplyChanged,
}: Props) {
  const [replyText, setReplyText] = useState(review.latest_reply?.reply_text ?? "")
  const [savedText, setSavedText] = useState(review.latest_reply?.reply_text ?? "")
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
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
  }, [review.id, review.latest_reply?.reply_text])

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
        return
      }
      const data = await res.json()
      if (data?.reply) {
        setReplyText(data.reply)
        onReplyChanged?.(review.id, data.reply, "draft")
      }
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
      await fetch("/api/save-reply", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, replyText }),
      })
      onReplyChanged?.(review.id, replyText, "draft")
      setSavedText(replyText)
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
      if (!res.ok) throw new Error("Failed to post reply")
      onMarkedPosted(review.id, replyText)
    } finally {
      setPosting(false)
    }
  }

  const isNA = mode === "needs-attention"
  const expanded = isExpanded ?? true
  const isDirty = replyText !== savedText
  const genOff  = generating
  const saveOff = saving || !isDirty
  const postOff = posting || !replyText.trim()

  return (
    <div style={{
      backgroundColor: isNA ? "#fffbeb" : "#f0fdf4",
      border: `1.5px solid ${isNA ? "#fcd34d" : "#6ee7b7"}`,
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
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          backgroundColor: "#2563eb", display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, color: "#ffffff",
        }}>
          {initials(review.author_name)}
        </div>

        {/* name + stars — clicking expands/collapses */}
        <div
          onClick={() => onToggleExpand?.(review.id)}
          style={{ flex: 1, cursor: "pointer" }}
        >
          <p style={{ fontWeight: 600, color: "#0f172a", margin: 0 }}>{review.author_name}</p>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "1px 0 0" }}>Customer review</p>
          <p style={{ fontSize: 12, margin: "2px 0 0", color: "#f59e0b" }}>
            {"★".repeat(Math.min(5, Number(review.rating) || 0))}
            {"☆".repeat(Math.max(0, 5 - (Number(review.rating) || 0)))}
          </p>
        </div>

        {/* status badge + chevron */}
        <div
          onClick={() => onToggleExpand?.(review.id)}
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
        >
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
            backgroundColor: isNA ? "#fef3c7" : "#dcfce7",
            border: `1px solid ${isNA ? "#fde68a" : "#bbf7d0"}`,
            color: isNA ? "#78350f" : "#14532d",
            whiteSpace: "nowrap",
          }}>
            {isNA ? "Needs attention" : "Posted"}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: isNA ? "#b45309" : "#059669" }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* ── collapsible body ─────────────────────────────────────────── */}
      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${isNA ? "#fde68a" : "#a7f3d0"}` }}>

          {/* review text */}
          <p style={{
            marginTop: 12, backgroundColor: "#f8fafc", borderRadius: 10,
            padding: "10px 14px", fontSize: 13, lineHeight: 1.7, color: "#475569",
          }}>
            &ldquo;{review.review_text}&rdquo;
          </p>

          {isNA ? (
            <>
              {/* action note */}
              <div style={{
                marginTop: 10, borderRadius: 8, padding: "8px 12px",
                fontSize: 12, fontWeight: 600,
                backgroundColor: "#fef9c3", border: "1px solid #fde047", color: "#713f12",
              }}>
                Edit the reply below, then click Save and Post.
              </div>

              {/* textarea */}
              <textarea
                rows={4}
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value)
                  onReplyChanged?.(review.id, e.target.value, "draft")
                }}
                style={{
                  marginTop: 10, width: "100%", boxSizing: "border-box", resize: "vertical",
                  borderRadius: 10, border: "1.5px solid #fcd34d",
                  backgroundColor: "#ffffff", padding: "10px 12px",
                  fontSize: 13, color: "#1e293b", outline: "none", fontFamily: "inherit",
                }}
              />

              {/* buttons row */}
              <div style={{
                marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8,
                borderTop: "1px solid #fcd34d", paddingTop: 10,
              }}>
                <button
                  onClick={generateReply}
                  disabled={genOff}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: genOff ? "not-allowed" : "pointer",
                    backgroundColor: genOff ? BTN_OFF.bg : BTN_BLUE.bg,
                    border: `1px solid ${genOff ? BTN_OFF.border : BTN_BLUE.border}`,
                    color: genOff ? BTN_OFF.text : BTN_BLUE.text,
                  }}
                >
                  {generating ? "Generating\u2026" : "Generate Reply"}
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
              </div>
            </>
          ) : (
            <div style={{
              marginTop: 10, borderRadius: 10, padding: "10px 14px",
              fontSize: 13, lineHeight: 1.7, color: "#1e293b",
              backgroundColor: "#ffffff", border: "1px solid #a7f3d0",
            }}>
              {replyText || <span style={{ color: "#94a3b8" }}>No reply text</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
