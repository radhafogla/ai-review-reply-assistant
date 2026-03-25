"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { BUSINESS_ROLES, type BusinessMemberRole } from "@/lib/businessRoles"
import {
  DEFAULT_REPLY_TONE,
  REPLY_TONE_DESCRIPTIONS,
  REPLY_TONE_LABELS,
  REPLY_TONE_VALUES,
  type ReplyTone,
} from "@/lib/replyTone"

type DeleteActionType = "data" | "account" | null
type DeleteStepType = "initial" | "email" | "final"
type SettingsTab = "account" | "team" | "danger"

type TeamBusiness = {
  id: string
  name: string | null
  role: BusinessMemberRole
}

type TeamMember = {
  id: string
  userId: string
  email: string
  name: string | null
  role: BusinessMemberRole
  status: string
  createdAt: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const sentryEnvironment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.toLowerCase() || "development"
  const showTestEmailControls = sentryEnvironment !== "production"
  const [activeTab, setActiveTab] = useState<SettingsTab>("account")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("")
  const [deleteStep, setDeleteStep] = useState<DeleteStepType>("initial")
  const [deletingType, setDeletingType] = useState<DeleteActionType>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [replyTone, setReplyTone] = useState<ReplyTone>(DEFAULT_REPLY_TONE)
  const [toneLoading, setToneLoading] = useState(false)
  const [toneSaving, setToneSaving] = useState(false)
  const [toneSaveMessage, setToneSaveMessage] = useState<string | null>(null)
  const [testEmailSending, setTestEmailSending] = useState(false)
  const [testEmailMessage, setTestEmailMessage] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [hasConnectedBusiness, setHasConnectedBusiness] = useState(true)
  const [teamBusinesses, setTeamBusinesses] = useState<TeamBusiness[]>([])
  const [selectedTeamBusinessId, setSelectedTeamBusinessId] = useState("")
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamSubmitting, setTeamSubmitting] = useState(false)
  const [teamMessage, setTeamMessage] = useState<string | null>(null)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [canManageTeam, setCanManageTeam] = useState(false)
  const [teamCurrentUserId, setTeamCurrentUserId] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<BusinessMemberRole>("viewer")
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, BusinessMemberRole>>({})
  const [memberActionUserId, setMemberActionUserId] = useState<string | null>(null)

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }, [])

  const loadReplyTone = useCallback(async () => {
    setToneLoading(true)
    setToneSaveMessage(null)

    try {
      const token = await getAccessToken()

      if (!token) {
        return
      }

      const res = await fetch("/api/reply-tone", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.status === 404) {
        setHasConnectedBusiness(false)
        return
      }

      if (!res.ok) {
        setToneSaveMessage("Failed to load brand voice settings.")
        return
      }

      const data = (await res.json()) as { tone?: string }
      const resolvedTone = REPLY_TONE_VALUES.includes(data.tone as ReplyTone)
        ? (data.tone as ReplyTone)
        : DEFAULT_REPLY_TONE

      setHasConnectedBusiness(true)
      setReplyTone(resolvedTone)
    } catch (error) {
      console.error("Load reply tone error:", error)
      setToneSaveMessage("Failed to load brand voice settings.")
    } finally {
      setToneLoading(false)
    }
  }, [getAccessToken])

  const loadTeamMembers = useCallback(async (businessId?: string) => {
    setTeamLoading(true)
    setTeamError(null)

    try {
      const token = await getAccessToken()

      if (!token) {
        return
      }

      const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""
      const res = await fetch(`/api/team-members${query}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = (await res.json().catch(() => null)) as {
        error?: string
        businesses?: TeamBusiness[]
        selectedBusinessId?: string | null
        currentUserId?: string
        canManageTeam?: boolean
        members?: TeamMember[]
      } | null

      if (!res.ok) {
        setTeamError(data?.error || "Failed to load team members.")
        return
      }

      const nextBusinesses = data?.businesses ?? []
      const nextMembers = data?.members ?? []
      const nextSelectedBusinessId = data?.selectedBusinessId ?? ""

      setTeamBusinesses(nextBusinesses)
      setSelectedTeamBusinessId(nextSelectedBusinessId)
      setTeamCurrentUserId(data?.currentUserId ?? "")
      setCanManageTeam(Boolean(data?.canManageTeam))
      setTeamMembers(nextMembers)
      setHasConnectedBusiness(nextBusinesses.length > 0)
      setMemberRoleDrafts(Object.fromEntries(nextMembers.map((member) => [member.userId, member.role])))
    } catch (error) {
      console.error("Load team members error:", error)
      setTeamError("Failed to load team members.")
    } finally {
      setTeamLoading(false)
    }
  }, [getAccessToken])

  async function addTeamMember() {
    if (!selectedTeamBusinessId || !inviteEmail.trim()) {
      setTeamError("Enter an email and select a business first.")
      return
    }

    setTeamSubmitting(true)
    setTeamError(null)
    setTeamMessage(null)

    try {
      const token = await getAccessToken()

      if (!token) {
        setTeamError("Session expired. Please sign in again.")
        return
      }

      const res = await fetch("/api/team-members", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: selectedTeamBusinessId,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })

      const data = (await res.json().catch(() => null)) as { error?: string } | null

      if (!res.ok) {
        setTeamError(data?.error || "Failed to add team member.")
        return
      }

      setInviteEmail("")
      setInviteRole("viewer")
      setTeamMessage("Team member added.")
      await loadTeamMembers(selectedTeamBusinessId)
    } catch (error) {
      console.error("Add team member error:", error)
      setTeamError("Failed to add team member.")
    } finally {
      setTeamSubmitting(false)
    }
  }

  async function updateMemberRole(memberUserId: string) {
    const nextRole = memberRoleDrafts[memberUserId]

    if (!selectedTeamBusinessId || !nextRole) {
      return
    }

    setMemberActionUserId(memberUserId)
    setTeamError(null)
    setTeamMessage(null)

    try {
      const token = await getAccessToken()

      if (!token) {
        setTeamError("Session expired. Please sign in again.")
        return
      }

      const res = await fetch("/api/team-members", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: selectedTeamBusinessId,
          memberUserId,
          role: nextRole,
        }),
      })

      const data = (await res.json().catch(() => null)) as { error?: string } | null

      if (!res.ok) {
        setTeamError(data?.error || "Failed to update role.")
        return
      }

      setTeamMessage("Role updated.")
      await loadTeamMembers(selectedTeamBusinessId)
    } catch (error) {
      console.error("Update member role error:", error)
      setTeamError("Failed to update role.")
    } finally {
      setMemberActionUserId(null)
    }
  }

  async function removeMember(memberUserId: string) {
    if (!selectedTeamBusinessId) {
      return
    }

    setMemberActionUserId(memberUserId)
    setTeamError(null)
    setTeamMessage(null)

    try {
      const token = await getAccessToken()

      if (!token) {
        setTeamError("Session expired. Please sign in again.")
        return
      }

      const res = await fetch("/api/team-members", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: selectedTeamBusinessId,
          memberUserId,
        }),
      })

      const data = (await res.json().catch(() => null)) as { error?: string } | null

      if (!res.ok) {
        setTeamError(data?.error || "Failed to remove team member.")
        return
      }

      setTeamMessage("Team member removed.")
      await loadTeamMembers(selectedTeamBusinessId)
    } catch (error) {
      console.error("Remove team member error:", error)
      setTeamError("Failed to remove team member.")
    } finally {
      setMemberActionUserId(null)
    }
  }

  async function saveReplyTone() {
    setToneSaving(true)
    setToneSaveMessage(null)

    try {
      const token = await getAccessToken()

      if (!token) {
        setToneSaveMessage("Session expired. Please sign in again.")
        return
      }

      const res = await fetch("/api/reply-tone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tone: replyTone }),
      })

      if (res.status === 404) {
        setHasConnectedBusiness(false)
        setToneSaveMessage("Connect a business first to set brand voice.")
        return
      }

      if (!res.ok) {
        setToneSaveMessage("Could not save brand voice. Please try again.")
        return
      }

      setHasConnectedBusiness(true)
      setToneSaveMessage("Brand voice saved. New AI replies will follow this style.")
    } catch (error) {
      console.error("Save reply tone error:", error)
      setToneSaveMessage("Could not save brand voice. Please try again.")
    } finally {
      setToneSaving(false)
    }
  }

  async function sendTestNegativeReviewEmail() {
    setTestEmailSending(true)
    setTestEmailMessage(null)

    try {
      const token = await getAccessToken()

      if (!token) {
        setTestEmailMessage("Session expired. Please sign in again.")
        return
      }

      const res = await fetch("/api/test-negative-review-email", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })

      const data = (await res.json().catch(() => null)) as {
        error?: string
        detail?: string | null
        sentTo?: string
      } | null

      if (!res.ok) {
        setTestEmailMessage(data?.detail || data?.error || "Failed to send test email.")
        return
      }

      setTestEmailMessage(`Test email sent to ${data?.sentTo || userEmail}.`)
    } catch (error) {
      console.error("Test negative review email error:", error)
      setTestEmailMessage("Failed to send test email.")
    } finally {
      setTestEmailSending(false)
    }
  }

  async function exportMyData() {
    setExportLoading(true)
    setExportMessage(null)

    try {
      const token = await getAccessToken()

      if (!token) {
        setExportMessage("Session expired. Please sign in again.")
        return
      }

      const res = await fetch("/api/export-data", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        setExportMessage("Failed to export data. Please try again.")
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `revidew-data-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)

      setExportMessage("Export downloaded.")
    } catch (error) {
      console.error("Export data error:", error)
      setExportMessage("Failed to export data. Please try again.")
    } finally {
      setExportLoading(false)
    }
  }

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user?.email) {
        setUserEmail(data.session.user.email)
        setIsAuthenticated(true)
        await loadReplyTone()
        await loadTeamMembers()
      } else {
        router.push("/login")
      }
    }

    loadSession()
  }, [router, loadReplyTone, loadTeamMembers])

  const handleDeleteData = async () => {
    setIsDeleting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        alert("Session expired. Please sign in again.")
        return
      }

      const res = await fetch("/api/delete-data", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })

      if (!res.ok) {
        alert("Failed to delete data. Please try again.")
        return
      }

      alert("All your data has been deleted successfully. You will be logged out.")
      setDeleteStep("initial")
      setDeleteConfirmEmail("")
      setDeletingType(null)

      await supabase.auth.signOut()
      router.push("/")
    } catch (error) {
      console.error("Delete data error:", error)
      alert("An error occurred. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        alert("Session expired. Please sign in again.")
        return
      }

      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })

      if (!res.ok) {
        alert("Failed to delete account. Please try again.")
        return
      }

      alert("Your account has been permanently deleted.")
      setDeleteStep("initial")
      setDeleteConfirmEmail("")
      setDeletingType(null)

      await supabase.auth.signOut()
      router.push("/")
    } catch (error) {
      console.error("Delete account error:", error)
      alert("An error occurred. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const canProceedDelete = deleteConfirmEmail === userEmail

  if (!isAuthenticated) {
    return null
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <div style={{ maxWidth: 1680, margin: "0 auto", padding: "32px 24px 40px" }}>
        {/* Header Card */}
        <section style={{
          marginBottom: 24, borderRadius: 20, overflow: "hidden",
          border: "1px solid #e2e8f0", backgroundColor: "#ffffff",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        }}>
          {/* Dark banner */}
          <div style={{ backgroundColor: "#0f172a", padding: "24px 32px" }}>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.16em",
              textTransform: "uppercase", color: "#fcd34d", margin: 0,
            }}>
              Account management
            </p>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#ffffff", margin: "8px 0 0", letterSpacing: "-0.5px" }}>
              Settings
            </h1>
            <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, maxWidth: 560 }}>
              Manage your account preferences and data.
            </p>
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: "1px solid #e2e8f0", padding: "0 32px", display: "flex", gap: 32 }}>
            <button
              onClick={() => {
                setActiveTab("account")
                setDeleteStep("initial")
                setDeleteConfirmEmail("")
                setDeletingType(null)
              }}
              style={{
                padding: "16px 0",
                fontSize: 14,
                fontWeight: 600,
                borderTop: "2px solid transparent",
                borderRight: "2px solid transparent",
                borderLeft: "2px solid transparent",
                borderBottom: activeTab === "account" ? "2px solid #2563eb" : "2px solid transparent",
                color: activeTab === "account" ? "#2563eb" : "#64748b",
                cursor: "pointer",
                background: "none",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== "account") {
                  (e.target as HTMLButtonElement).style.color = "#0f172a"
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== "account") {
                  (e.target as HTMLButtonElement).style.color = "#64748b"
                }
              }}
            >
              Account Info
            </button>
            <button
              onClick={() => {
                setActiveTab("team")
                setDeleteStep("initial")
                setDeleteConfirmEmail("")
                setDeletingType(null)
                setTeamMessage(null)
                setTeamError(null)
              }}
              style={{
                padding: "16px 0",
                fontSize: 14,
                fontWeight: 600,
                borderTop: "2px solid transparent",
                borderRight: "2px solid transparent",
                borderLeft: "2px solid transparent",
                borderBottom: activeTab === "team" ? "2px solid #0f766e" : "2px solid transparent",
                color: activeTab === "team" ? "#0f766e" : "#64748b",
                cursor: "pointer",
                background: "none",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== "team") {
                  (e.target as HTMLButtonElement).style.color = "#0f172a"
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== "team") {
                  (e.target as HTMLButtonElement).style.color = "#64748b"
                }
              }}
            >
              Team
            </button>
            <button
              onClick={() => {
                setActiveTab("danger")
                setDeleteStep("initial")
                setDeleteConfirmEmail("")
                setDeletingType(null)
              }}
              style={{
                padding: "16px 0",
                fontSize: 14,
                fontWeight: 600,
                borderTop: "2px solid transparent",
                borderRight: "2px solid transparent",
                borderLeft: "2px solid transparent",
                borderBottom: activeTab === "danger" ? "2px solid #dc2626" : "2px solid transparent",
                color: activeTab === "danger" ? "#dc2626" : "#64748b",
                cursor: "pointer",
                background: "none",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== "danger") {
                  (e.target as HTMLButtonElement).style.color = "#0f172a"
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== "danger") {
                  (e.target as HTMLButtonElement).style.color = "#64748b"
                }
              }}
            >
              Danger Zone
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: "32px" }}>
            {activeTab === "account" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", margin: "0 0 12px" }}>
                    Email Address
                  </p>
                  <div style={{
                    borderRadius: 14, border: "1.5px solid #e2e8f0",
                    backgroundColor: "#f8fafc", padding: "16px 20px",
                  }}>
                    <p style={{ fontSize: 14, color: "#0f172a", margin: 0, wordBreak: "break-all" }}>
                      {userEmail || "Not available"}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    border: "1.5px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    padding: "18px 20px",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#64748b",
                      margin: "0 0 10px",
                    }}
                  >
                    Brand Voice
                  </p>
                  <p style={{ fontSize: 13, color: "#334155", margin: "0 0 14px" }}>
                    Choose the default tone for generated replies. This applies to manual and auto-generated AI drafts.
                  </p>

                  {!hasConnectedBusiness && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "#b45309",
                        backgroundColor: "#fffbeb",
                        border: "1px solid #fcd34d",
                        borderRadius: 10,
                        padding: "10px 12px",
                        margin: "0 0 12px",
                      }}
                    >
                      Connect a business first to enable brand voice templates.
                    </p>
                  )}

                  <div style={{ display: "grid", gap: 10 }}>
                    {REPLY_TONE_VALUES.map((toneOption) => {
                      const selected = replyTone === toneOption
                      return (
                        <label
                          key={toneOption}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            border: selected ? "1.5px solid #2563eb" : "1.5px solid #e2e8f0",
                            backgroundColor: selected ? "#eff6ff" : "#f8fafc",
                            borderRadius: 12,
                            padding: "10px 12px",
                            cursor: hasConnectedBusiness ? "pointer" : "not-allowed",
                            opacity: hasConnectedBusiness ? 1 : 0.65,
                          }}
                        >
                          <input
                            type="radio"
                            name="reply-tone"
                            value={toneOption}
                            checked={selected}
                            disabled={!hasConnectedBusiness || toneLoading || toneSaving}
                            onChange={() => setReplyTone(toneOption)}
                            style={{ marginTop: 2 }}
                          />
                          <span>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                              {REPLY_TONE_LABELS[toneOption]}
                            </span>
                            <span style={{ display: "block", fontSize: 12, color: "#64748b", marginTop: 3 }}>
                              {REPLY_TONE_DESCRIPTIONS[toneOption]}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      onClick={saveReplyTone}
                      disabled={!hasConnectedBusiness || toneLoading || toneSaving}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        backgroundColor: !hasConnectedBusiness || toneLoading || toneSaving ? "#cbd5e1" : "#2563eb",
                        color: "#ffffff",
                        fontSize: 13,
                        fontWeight: 600,
                        border: "none",
                        cursor: !hasConnectedBusiness || toneLoading || toneSaving ? "not-allowed" : "pointer",
                      }}
                    >
                      {toneSaving ? "Saving..." : toneLoading ? "Loading..." : "Save voice"}
                    </button>
                    {toneSaveMessage && (
                      <p style={{ margin: 0, fontSize: 12, color: toneSaveMessage.includes("saved") ? "#166534" : "#b45309" }}>
                        {toneSaveMessage}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{
                  borderRadius: 14,
                  border: "1.5px solid #dbeafe",
                  backgroundColor: "#eff6ff",
                  padding: "18px 20px",
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1d4ed8", margin: "0 0 10px" }}>
                    Need Help?
                  </p>
                  <p style={{ fontSize: 13, color: "#1e3a8a", margin: "0 0 14px" }}>
                    Reach our team for account, billing, or integration support.
                  </p>
                  <Link
                    href="/contact"
                    style={{
                      display: "inline-block",
                      padding: "8px 14px",
                      borderRadius: 10,
                      backgroundColor: "#2563eb",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Contact Us
                  </Link>
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    border: "1.5px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    padding: "18px 20px",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#64748b",
                      margin: "0 0 10px",
                    }}
                  >
                    Data Portability
                  </p>
                  <p style={{ fontSize: 13, color: "#334155", margin: "0 0 14px" }}>
                    Download a JSON file containing all your account data, businesses, reviews, replies, and analytics. This is your right under GDPR Article 20.
                  </p>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      onClick={exportMyData}
                      disabled={exportLoading}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        backgroundColor: exportLoading ? "#cbd5e1" : "#0f172a",
                        color: "#ffffff",
                        fontSize: 13,
                        fontWeight: 600,
                        border: "none",
                        cursor: exportLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {exportLoading ? "Exporting..." : "Export my data"}
                    </button>
                    {exportMessage && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: exportMessage.includes("downloaded") ? "#166534" : "#b45309",
                        }}
                      >
                        {exportMessage}
                      </p>
                    )}
                  </div>
                </div>

                {showTestEmailControls && (
                  <div
                    style={{
                      borderRadius: 14,
                      border: "1.5px solid #e2e8f0",
                      backgroundColor: "#ffffff",
                      padding: "18px 20px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#64748b",
                        margin: "0 0 10px",
                      }}
                    >
                      Email Testing
                    </p>
                    <p style={{ fontSize: 13, color: "#334155", margin: "0 0 14px" }}>
                      Send yourself a sample negative review notification email. This works in local and preview environments, and is blocked in production.
                    </p>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={sendTestNegativeReviewEmail}
                        disabled={testEmailSending}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 10,
                          backgroundColor: testEmailSending ? "#cbd5e1" : "#0f766e",
                          color: "#ffffff",
                          fontSize: 13,
                          fontWeight: 600,
                          border: "none",
                          cursor: testEmailSending ? "not-allowed" : "pointer",
                        }}
                      >
                        {testEmailSending ? "Sending..." : "Send test negative review email"}
                      </button>
                      {testEmailMessage && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            color: testEmailMessage.includes("sent") ? "#166534" : "#b45309",
                          }}
                        >
                          {testEmailMessage}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "team" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div
                  style={{
                    borderRadius: 14,
                    border: "1.5px solid #ccfbf1",
                    backgroundColor: "#f0fdfa",
                    padding: "18px 20px",
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#0f766e", margin: "0 0 10px" }}>
                    Team access
                  </p>
                  <p style={{ fontSize: 13, color: "#115e59", margin: 0 }}>
                    Team members can only be added for existing accounts right now. Ask a teammate to sign up first, then add them here by email.
                  </p>
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    border: "1.5px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    padding: "18px 20px",
                  }}
                >
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
                    <label style={{ display: "grid", gap: 8, minWidth: 260, flex: "1 1 260px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b" }}>
                        Business
                      </span>
                      <select
                        value={selectedTeamBusinessId}
                        onChange={(e) => {
                          const nextBusinessId = e.target.value
                          setSelectedTeamBusinessId(nextBusinessId)
                          void loadTeamMembers(nextBusinessId)
                        }}
                        disabled={teamLoading || teamBusinesses.length === 0}
                        style={{
                          borderRadius: 10,
                          border: "1.5px solid #cbd5e1",
                          backgroundColor: "#fff",
                          color: "#0f172a",
                          fontSize: 13,
                          fontWeight: 600,
                          padding: "8px 12px",
                          outline: "none",
                        }}
                      >
                        {teamBusinesses.length === 0 ? (
                          <option value="">No connected businesses</option>
                        ) : (
                          teamBusinesses.map((business) => (
                            <option key={business.id} value={business.id}>
                              {(business.name?.trim() || business.id)} ({business.role})
                            </option>
                          ))
                        )}
                      </select>
                    </label>

                    <div style={{ minWidth: 240, flex: "1 1 240px" }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                        {selectedTeamBusinessId
                          ? canManageTeam
                            ? "You can add, change, and remove members for this business."
                            : "You can view this team, but only owners can change membership."
                          : "Select a business to manage its team."}
                      </p>
                    </div>
                  </div>

                  {(teamError || teamMessage) && (
                    <div
                      style={{
                        marginTop: 14,
                        borderRadius: 10,
                        padding: "10px 12px",
                        backgroundColor: teamError ? "#fef2f2" : "#f0fdf4",
                        border: teamError ? "1px solid #fecaca" : "1px solid #bbf7d0",
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 12, color: teamError ? "#b91c1c" : "#166534", fontWeight: 600 }}>
                        {teamError || teamMessage}
                      </p>
                    </div>
                  )}
                </div>

                {canManageTeam && selectedTeamBusinessId && (
                  <div
                    style={{
                      borderRadius: 14,
                      border: "1.5px solid #e2e8f0",
                      backgroundColor: "#ffffff",
                      padding: "18px 20px",
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", margin: "0 0 10px" }}>
                      Add member
                    </p>
                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1.4fr) minmax(160px, 0.7fr) auto" }}>
                      <input
                        type="email"
                        placeholder="teammate@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={teamSubmitting}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1.5px solid #cbd5e1",
                          borderRadius: 10,
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as BusinessMemberRole)}
                        disabled={teamSubmitting}
                        style={{
                          borderRadius: 10,
                          border: "1.5px solid #cbd5e1",
                          backgroundColor: "#fff",
                          color: "#0f172a",
                          fontSize: 13,
                          fontWeight: 600,
                          padding: "10px 12px",
                          outline: "none",
                        }}
                      >
                        {BUSINESS_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={addTeamMember}
                        disabled={teamSubmitting}
                        style={{
                          padding: "10px 16px",
                          borderRadius: 10,
                          backgroundColor: teamSubmitting ? "#99f6e4" : "#0f766e",
                          color: "#ffffff",
                          fontSize: 13,
                          fontWeight: 700,
                          border: "none",
                          cursor: teamSubmitting ? "not-allowed" : "pointer",
                        }}
                      >
                        {teamSubmitting ? "Adding..." : "Add member"}
                      </button>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    borderRadius: 14,
                    border: "1.5px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    padding: "18px 20px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", margin: "0 0 6px" }}>
                        Members
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: "#334155" }}>
                        {teamLoading ? "Loading team..." : `${teamMembers.length} active member${teamMembers.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  </div>

                  {teamBusinesses.length === 0 ? (
                    <p style={{ marginTop: 14, fontSize: 13, color: "#64748b" }}>
                      Connect a business first before managing team access.
                    </p>
                  ) : teamMembers.length === 0 && !teamLoading ? (
                    <p style={{ marginTop: 14, fontSize: 13, color: "#64748b" }}>
                      No team members found for this business yet.
                    </p>
                  ) : (
                    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                      {teamMembers.map((member) => {
                        const isCurrentUser = member.userId === teamCurrentUserId
                        const pending = memberActionUserId === member.userId

                        return (
                          <div
                            key={member.id}
                            style={{
                              borderRadius: 12,
                              border: "1px solid #e2e8f0",
                              backgroundColor: "#f8fafc",
                              padding: "14px 16px",
                              display: "grid",
                              gap: 12,
                              gridTemplateColumns: canManageTeam ? "minmax(0, 1.4fr) minmax(150px, 0.7fr) auto auto" : "minmax(0, 1fr) auto",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                                {member.name || member.email}
                                {isCurrentUser ? " (you)" : ""}
                              </p>
                              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", wordBreak: "break-all" }}>
                                {member.email}
                              </p>
                              {member.createdAt && (
                                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8" }}>
                                  Added {new Date(member.createdAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>

                            {canManageTeam ? (
                              <>
                                <select
                                  value={memberRoleDrafts[member.userId] ?? member.role}
                                  onChange={(e) => setMemberRoleDrafts((current) => ({
                                    ...current,
                                    [member.userId]: e.target.value as BusinessMemberRole,
                                  }))}
                                  disabled={pending}
                                  style={{
                                    borderRadius: 10,
                                    border: "1.5px solid #cbd5e1",
                                    backgroundColor: "#fff",
                                    color: "#0f172a",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    padding: "8px 12px",
                                    outline: "none",
                                  }}
                                >
                                  {BUSINESS_ROLES.map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => updateMemberRole(member.userId)}
                                  disabled={pending || (memberRoleDrafts[member.userId] ?? member.role) === member.role}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    backgroundColor: pending ? "#cbd5e1" : "#0f766e",
                                    color: "#ffffff",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    border: "none",
                                    cursor: pending || (memberRoleDrafts[member.userId] ?? member.role) === member.role ? "not-allowed" : "pointer",
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => removeMember(member.userId)}
                                  disabled={pending}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    backgroundColor: "#ffffff",
                                    color: "#b91c1c",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    border: "1.5px solid #fecaca",
                                    cursor: pending ? "not-allowed" : "pointer",
                                  }}
                                >
                                  Remove
                                </button>
                              </>
                            ) : (
                              <div style={{ justifySelf: "start", padding: "6px 10px", borderRadius: 999, backgroundColor: "#e2e8f0", fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "capitalize" }}>
                                {member.role}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "danger" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Delete Data Section */}
                <div style={{
                  borderRadius: 14, border: "1.5px solid #fed7aa",
                  backgroundColor: "#fffbeb", padding: "20px 24px",
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#92400e", margin: "0 0 8px" }}>
                    Delete All Data
                  </h3>
                  <p style={{ fontSize: 13, color: "#b45309", margin: "0 0 16px" }}>
                    This will permanently delete all your businesses, reviews, integrations, and replies. Your account will remain active.
                  </p>

                  {deletingType !== "data" && (
                    <button
                      onClick={() => {
                        setDeletingType("data")
                        setDeleteStep("email")
                        setDeleteConfirmEmail("")
                      }}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 10,
                        backgroundColor: "#f59e0b",
                        color: "#ffffff",
                        fontSize: 13,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = "#d97706"
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = "#f59e0b"
                      }}
                    >
                      Delete All Data
                    </button>
                  )}

                  {deletingType === "data" && deleteStep === "email" && (
                    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#92400e", margin: 0 }}>
                        To confirm, please type your email address:
                      </p>
                      <input
                        type="text"
                        placeholder="Enter your email"
                        value={deleteConfirmEmail}
                        onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1.5px solid #fcd34d",
                          borderRadius: 10,
                          fontSize: 13,
                          outline: "none",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.border = "1.5px solid #f59e0b"
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.border = "1.5px solid #fcd34d"
                        }}
                      />
                      <div style={{ display: "flex", gap: 12 }}>
                        <button
                          onClick={() => {
                            setDeletingType(null)
                            setDeleteStep("initial")
                            setDeleteConfirmEmail("")
                          }}
                          style={{
                            flex: 1,
                            padding: "8px 16px",
                            borderRadius: 10,
                            border: "1.5px solid #cbd5e1",
                            backgroundColor: "#ffffff",
                            color: "#475569",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "background 0.2s",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setDeleteStep("final")}
                          disabled={!canProceedDelete}
                          style={{
                            flex: 1,
                            padding: "8px 16px",
                            borderRadius: 10,
                            backgroundColor: canProceedDelete ? "#f59e0b" : "#cbd5e1",
                            color: canProceedDelete ? "#ffffff" : "#94a3b8",
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            cursor: canProceedDelete ? "pointer" : "not-allowed",
                            transition: "background 0.2s",
                          }}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}

                  {deletingType === "data" && deleteStep === "final" && (
                    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ borderRadius: 10, backgroundColor: "#fed7aa", border: "1.5px solid #fcd34d", padding: 12 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", margin: "0 0 6px" }}>
                          ⚠️ Last warning
                        </p>
                        <p style={{ fontSize: 13, color: "#b45309", margin: 0 }}>
                          This action cannot be undone. All your data will be permanently deleted.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <button
                          onClick={() => {
                            setDeletingType(null)
                            setDeleteStep("initial")
                            setDeleteConfirmEmail("")
                          }}
                          disabled={isDeleting}
                          style={{
                            flex: 1,
                            padding: "8px 16px",
                            borderRadius: 10,
                            border: "1.5px solid #cbd5e1",
                            backgroundColor: "#ffffff",
                            color: "#475569",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: isDeleting ? "not-allowed" : "pointer",
                            opacity: isDeleting ? 0.5 : 1,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteData}
                          disabled={isDeleting}
                          style={{
                            flex: 1,
                            padding: "8px 16px",
                            borderRadius: 10,
                            backgroundColor: isDeleting ? "#cbd5e1" : "#dc2626",
                            color: "#ffffff",
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            cursor: isDeleting ? "not-allowed" : "pointer",
                          }}
                        >
                          {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delete Account Section */}
                <div style={{
                  borderRadius: 14, border: "1.5px solid #fecaca",
                  backgroundColor: "#fef2f2", padding: "20px 24px",
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#991b1b", margin: "0 0 8px" }}>
                    Delete Account
                  </h3>
                  <p style={{ fontSize: 13, color: "#dc2626", margin: "0 0 16px" }}>
                    This will permanently delete your account and all associated data. This action cannot be undone.
                  </p>

                  {deletingType !== "account" && (
                    <button
                      onClick={() => {
                        setDeletingType("account")
                        setDeleteStep("email")
                        setDeleteConfirmEmail("")
                      }}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 10,
                        backgroundColor: "#dc2626",
                        color: "#ffffff",
                        fontSize: 13,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = "#b91c1c"
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = "#dc2626"
                      }}
                    >
                      Delete Account
                    </button>
                  )}

                  {deletingType === "account" && deleteStep === "email" && (
                    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#991b1b", margin: 0 }}>
                        To confirm, please type your email address:
                      </p>
                      <input
                        type="text"
                        placeholder="Enter your email"
                        value={deleteConfirmEmail}
                        onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1.5px solid #fecaca",
                          borderRadius: 10,
                          fontSize: 13,
                          outline: "none",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.border = "1.5px solid #dc2626"
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.border = "1.5px solid #fecaca"
                        }}
                      />
                      <div style={{ display: "flex", gap: 12 }}>
                        <button
                          onClick={() => {
                            setDeletingType(null)
                            setDeleteStep("initial")
                            setDeleteConfirmEmail("")
                          }}
                          style={{
                            flex: 1,
                            padding: "8px 16px",
                            borderRadius: 10,
                            border: "1.5px solid #cbd5e1",
                            backgroundColor: "#ffffff",
                            color: "#475569",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "background 0.2s",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setDeleteStep("final")}
                          disabled={!canProceedDelete}
                          style={{
                            flex: 1,
                            padding: "8px 16px",
                            borderRadius: 10,
                            backgroundColor: canProceedDelete ? "#dc2626" : "#cbd5e1",
                            color: canProceedDelete ? "#ffffff" : "#94a3b8",
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            cursor: canProceedDelete ? "pointer" : "not-allowed",
                            transition: "background 0.2s",
                          }}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}

                  {deletingType === "account" && deleteStep === "final" && (
                    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ borderRadius: 10, backgroundColor: "#fecaca", border: "1.5px solid #fca5a5", padding: 12 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#991b1b", margin: "0 0 6px" }}>
                          ⚠️ Final Warning
                        </p>
                        <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>
                          This will permanently delete your account and ALL data. You will not be able to recover this account or any data associated with it.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <button
                          onClick={() => {
                            setDeletingType(null)
                            setDeleteStep("initial")
                            setDeleteConfirmEmail("")
                          }}
                          disabled={isDeleting}
                          style={{
                            flex: 1,
                            padding: "8px 16px",
                            borderRadius: 10,
                            border: "1.5px solid #cbd5e1",
                            backgroundColor: "#ffffff",
                            color: "#475569",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: isDeleting ? "not-allowed" : "pointer",
                            opacity: isDeleting ? 0.5 : 1,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={isDeleting}
                          style={{
                            flex: 1,
                            padding: "8px 16px",
                            borderRadius: 10,
                            backgroundColor: isDeleting ? "#cbd5e1" : "#dc2626",
                            color: "#ffffff",
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            cursor: isDeleting ? "not-allowed" : "pointer",
                          }}
                        >
                          {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
