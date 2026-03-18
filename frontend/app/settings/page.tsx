"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

type DeleteActionType = "data" | "account" | null
type DeleteStepType = "initial" | "email" | "final"

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"account" | "danger">("account")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("")
  const [deleteStep, setDeleteStep] = useState<DeleteStepType>("initial")
  const [deletingType, setDeletingType] = useState<DeleteActionType>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user?.email) {
        setUserEmail(data.session.user.email)
        setIsAuthenticated(true)
      } else {
        router.push("/login")
      }
    }

    loadSession()
  }, [router])

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
