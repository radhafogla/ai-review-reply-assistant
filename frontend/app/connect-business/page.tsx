"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabaseClient"
import { useSubscription } from "@/app/hooks/useSubscription"
import { hasFeature } from "@/lib/subscription"
import { GoogleLocation } from "../types/location"

type BusinessConnection = {
  id: string
  name: string | null
  external_business_id?: string | null
  account_id?: string | null
  connected_at?: string | null
  platform?: string | null
}

function getPlatformBadgeStyle(platform: string) {
  if (platform === "yelp") {
    return { border: "1px solid #fecaca", backgroundColor: "#fff1f2", color: "#b91c1c" }
  }

  if (platform === "facebook") {
    return { border: "1px solid #bfdbfe", backgroundColor: "#eff6ff", color: "#1d4ed8" }
  }

  return { border: "1px solid #bbf7d0", backgroundColor: "#f0fdf4", color: "#166534" }
}

function ConnectBusinessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loading: subscriptionLoading, subscription } = useSubscription()
  const [checkingSession, setCheckingSession] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const [connectedBusinesses, setConnectedBusinesses] = useState<BusinessConnection[]>([])
  const [locations, setLocations] = useState<GoogleLocation[]>([])

  const [loadingBusinesses, setLoadingBusinesses] = useState(false)
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [savingBusinessId, setSavingBusinessId] = useState<string | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [connectNotice, setConnectNotice] = useState<string | null>(null)
  const shouldRedirectAfterAuth = searchParams.get("postAuth") === "1"

  const loadSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      setCheckingSession(false)
      return
    }

    setUserId(session.user.id)
    setAccessToken(session.access_token ?? null)

    await fetch("/api/ensure-user", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    })

    setCheckingSession(false)
  }, [])

  const loadConnectedBusinesses = useCallback(async (uid: string) => {
    setLoadingBusinesses(true)

    const { data, error } = await supabase
      .from("businesses")
       .select("id, name, account_id, connected_at, external_business_id, platform")
      .eq("user_id", uid)
      .order("connected_at", { ascending: false })

    if (error) {
      console.error("Failed to load businesses", error)
      setConnectedBusinesses([])
    } else {
      setConnectedBusinesses((data || []) as BusinessConnection[])
    }

    setLoadingBusinesses(false)
  }, [])

  const fetchLocations = useCallback(async () => {
    if (!accessToken) return { reconnectRequired: false }

    setLoadingLocations(true)
    setConnectNotice(null)

    try {
      const res = await fetch("/api/google-locations", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const data = await res.json()
      if (res.ok) {
        setLocations(Array.isArray(data.locations) ? data.locations : [])
        return { reconnectRequired: false }
      } else {
        console.error("Failed to fetch locations", data)
        if (data?.reconnectRequired) {
          return { reconnectRequired: true }
        }

        setConnectNotice("Unable to load locations right now. Please try again.")
        return { reconnectRequired: false }
      }
    } catch (err) {
      console.error("Error fetching locations", err)
      setConnectNotice("Unable to load locations right now. Please try again.")
      return { reconnectRequired: false }
    } finally {
      setLoadingLocations(false)
    }
  }, [accessToken])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  useEffect(() => {
    if (!checkingSession && !userId) {
      router.push("/login")
    }
  }, [checkingSession, userId, router])

  useEffect(() => {
    if (!userId) return
    loadConnectedBusinesses(userId)
  }, [userId, loadConnectedBusinesses])

  useEffect(() => {
    if (!shouldRedirectAfterAuth || checkingSession || loadingBusinesses) {
      return
    }

    if (connectedBusinesses.length > 0) {
      router.replace("/dashboard")
    }
  }, [shouldRedirectAfterAuth, checkingSession, loadingBusinesses, connectedBusinesses.length, router])

  const visibleLocations = useMemo(() => {
    const existingKeys = new Set(
       connectedBusinesses.map((business) => business.external_business_id).filter(Boolean),
    )

    return locations.filter((loc) => !existingKeys.has(loc.locationId))
  }, [locations, connectedBusinesses])

  const canUseMultiBusiness = hasFeature(subscription.plan, "multiBusiness")
  const hasReachedPlanLimit = !canUseMultiBusiness && connectedBusinesses.length >= 1

  async function handleConnectGoogle() {
    if (!accessToken) return

    try {
      const res = await fetch("/api/connect-google-business", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      })

      const data = await res.json()

      if (!res.ok || !data.url) {
        console.error("Failed to initialize Google OAuth", data)
        return
      }

      window.location.href = data.url
    } catch (err) {
      console.error("Error connecting Google", err)
    }
  }

  async function handleAddAnotherClick() {
    if (hasReachedPlanLimit) return
    setShowAddPanel(true)
    const { reconnectRequired } = await fetchLocations()

    if (reconnectRequired) {
      setConnectNotice("Please reconnect Google to load your available locations.")
      setShowAddPanel(false)
      await handleConnectGoogle()
    }
  }

  async function handleSelectLocation(location: GoogleLocation) {
    if (!accessToken || !userId) return

    setSavingBusinessId(location.locationId)

    try {
      const res = await fetch("/api/save-business", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_id: location.accountId || userId,
          external_business_id: location.locationId,
          platform: "google",
          name: location.name,
          primary_category: location.primaryCategory ?? null,
          additional_categories: Array.isArray(location.additionalCategories) ? location.additionalCategories : [],
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        console.error("Error saving business", data)
        return
      }

      await loadConnectedBusinesses(userId)
      setShowAddPanel(false)
    } catch (err) {
      console.error("Error saving business", err)
    } finally {
      setSavingBusinessId(null)
    }
  }

  if (checkingSession) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <div style={{ maxWidth: 1680, margin: "0 auto", padding: "20px 24px 36px" }}>
          <section style={{ borderRadius: 20, border: "1px solid #e2e8f0", backgroundColor: "#fff", padding: 24 }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Loading session...</p>
          </section>
        </div>
      </div>
    )
  }

  if (!userId) return null

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <div style={{ maxWidth: 1680, margin: "0 auto", padding: "20px 24px 36px" }}>
        <section style={{
          marginBottom: 12,
          borderRadius: 20,
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          backgroundColor: "#fff",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        }}>
          <div style={{ backgroundColor: "#0f172a", padding: "20px 28px" }}>
            <p style={{ margin: 0, fontSize: 14, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: "#93c5fd" }}>
              Business management
            </p>
            <h1 style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>
              Connect and manage businesses
            </h1>
            <p style={{ marginTop: 8, marginBottom: 0, maxWidth: 680, fontSize: 14, color: "#94a3b8" }}>
              Keep your connected locations in one place. Add another business anytime and choose where reviews sync from.
            </p>
          </div>

          <div style={{ padding: "18px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Connected businesses
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 20, color: "#0f172a", fontWeight: 800 }}>
                  {connectedBusinesses.length}
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={hasReachedPlanLimit || subscriptionLoading}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: `1px solid ${hasReachedPlanLimit || subscriptionLoading ? "#cbd5e1" : "#1d4ed8"}`,
                    backgroundColor: hasReachedPlanLimit || subscriptionLoading ? "#e2e8f0" : "#2563eb",
                    color: hasReachedPlanLimit || subscriptionLoading ? "#94a3b8" : "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: hasReachedPlanLimit || subscriptionLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Connect Google
                </button>

                <button
                  type="button"
                  onClick={handleAddAnotherClick}
                  disabled={hasReachedPlanLimit || subscriptionLoading}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: `1px solid ${hasReachedPlanLimit || subscriptionLoading ? "#cbd5e1" : "#94a3b8"}`,
                    backgroundColor: hasReachedPlanLimit || subscriptionLoading ? "#e2e8f0" : "#f8fafc",
                    color: hasReachedPlanLimit || subscriptionLoading ? "#94a3b8" : "#1e293b",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: hasReachedPlanLimit || subscriptionLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Add another business
                </button>
              </div>
            </div>

            {hasReachedPlanLimit && (
              <div style={{ marginTop: 12, borderRadius: 10, border: "1px solid #bfdbfe", backgroundColor: "#eff6ff", padding: "10px 12px" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#1e3a8a", fontWeight: 600 }}>
                  Free plan supports one connected business. Upgrade to Basic or Premium for multi-business management.
                </p>
                <Link
                  href="/subscriptions"
                  style={{ marginTop: 8, display: "inline-flex", fontSize: 12, fontWeight: 700, color: "#1d4ed8", textDecoration: "none" }}
                >
                  Go to Subscriptions
                </Link>
              </div>
            )}

            {connectNotice && (
              <div style={{ marginTop: 12, borderRadius: 10, border: "1px solid #bfdbfe", backgroundColor: "#eff6ff", padding: "10px 12px" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#1e3a8a", fontWeight: 600 }}>
                  {connectNotice}
                </p>
              </div>
            )}
          </div>
        </section>

        <section style={{ borderRadius: 16, border: "1px solid #e2e8f0", backgroundColor: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Businesses list
          </div>

          {loadingBusinesses ? (
            <div style={{ padding: 16, fontSize: 14, color: "#64748b" }}>Loading businesses...</div>
          ) : connectedBusinesses.length === 0 ? (
            <div style={{ padding: 16, fontSize: 14, color: "#64748b" }}>No businesses connected yet. Click &quot;Connect Google&quot; to start.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 12, color: "#64748b" }}>Business</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 12, color: "#64748b" }}>External Business ID</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 12, color: "#64748b" }}>Platform</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 12, color: "#64748b" }}>Connected</th>
                  </tr>
                </thead>
                <tbody>
                  {connectedBusinesses.map((business) => (
                    <tr key={business.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "12px 14px", fontSize: 14, color: "#0f172a", fontWeight: 600 }}>
                        {business.name || "Unnamed business"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: "#334155" }}>
                          {business.external_business_id || "-"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: "#334155", textTransform: "capitalize" }}>
                        {(() => {
                          const platform = (business.platform || "google").toLowerCase()
                          const badgeStyle = getPlatformBadgeStyle(platform)

                          return (
                            <span
                              style={{
                                ...badgeStyle,
                                display: "inline-flex",
                                alignItems: "center",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 12,
                                fontWeight: 700,
                                lineHeight: 1.4,
                              }}
                            >
                              {platform}
                            </span>
                          )
                        })()}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: "#334155" }}>
                        {business.connected_at ? new Date(business.connected_at).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showAddPanel && (
          <section style={{ marginTop: 20, borderRadius: 16, border: "1px solid #e2e8f0", backgroundColor: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#eff6ff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1e3a8a" }}>Available locations</p>
              <button
                type="button"
                onClick={() => setShowAddPanel(false)}
                style={{
                  border: "1px solid #93c5fd",
                  backgroundColor: "#fff",
                  color: "#1d4ed8",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: 16 }}>
              {loadingLocations ? (
                <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Loading locations...</p>
              ) : visibleLocations.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>No new locations available to add.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {visibleLocations.map((location) => {
                    const isSaving = savingBusinessId === location.locationId
                    return (
                      <button
                        key={location.locationId}
                        type="button"
                        onClick={() => handleSelectLocation(location)}
                        disabled={isSaving}
                        style={{
                          border: "1px solid #cbd5e1",
                          backgroundColor: "#fff",
                          borderRadius: 10,
                          padding: "12px 14px",
                          textAlign: "left",
                          cursor: isSaving ? "not-allowed" : "pointer",
                          opacity: isSaving ? 0.7 : 1,
                        }}
                      >
                        <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 700 }}>
                          {location.name}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12, color: "#64748b" }}>
                          External Business ID: {location.locationId}
                        </div>
                        {isSaving && (
                          <div style={{ marginTop: 6, fontSize: 12, color: "#2563eb", fontWeight: 700 }}>
                            Saving...
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function ConnectBusinessFallback() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px 40px" }}>
        <section style={{ borderRadius: 20, border: "1px solid #e2e8f0", backgroundColor: "#fff", padding: 24 }}>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Loading connect business...</p>
        </section>
      </div>
    </div>
  )
}

export default function ConnectBusiness() {
  return (
    <Suspense fallback={<ConnectBusinessFallback />}>
      <ConnectBusinessContent />
    </Suspense>
  )
}
