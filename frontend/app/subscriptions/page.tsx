"use client"

import { useEffect, useState } from "react"
import { useSubscription } from "@/app/hooks/useSubscription"
import {
  PLAN_FEATURE_ORDER,
  PLAN_FEATURES,
  PLAN_ORDER,
  PREMIUM_AUTO_REPLY_DEFAULT_MIN_RATING,
  getFeatureLabel,
  getPlanLimits,
  getPlanDescription,
  getPlanLabel,
  getPlanPrice,
  getPlanUsageLabel,
  type SubscriptionPlan,
} from "@/lib/subscription"
import { supabase } from "@/lib/supabaseClient"

export default function SubscriptionsPage() {
  const { loading, subscription, changePlan } = useSubscription()
  const [updatingPlan, setUpdatingPlan] = useState<SubscriptionPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoReplyLoading, setAutoReplyLoading] = useState(false)
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false)
  const [autoReplyMinRating, setAutoReplyMinRating] = useState(PREMIUM_AUTO_REPLY_DEFAULT_MIN_RATING)

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function loadAutoReplySettings() {
    if (subscription.plan !== "premium") return
    setAutoReplyLoading(true)

    try {
      const token = await getAccessToken()
      if (!token) return

      const res = await fetch("/api/premium-auto-reply", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) return

      const data = await res.json()
      setAutoReplyEnabled(Boolean(data?.enabled))
      setAutoReplyMinRating(Number(data?.minRating ?? PREMIUM_AUTO_REPLY_DEFAULT_MIN_RATING))
    } finally {
      setAutoReplyLoading(false)
    }
  }

  useEffect(() => {
    if (subscription.plan !== "premium") return
    void loadAutoReplySettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription.plan])

  async function handlePlanChange(plan: SubscriptionPlan) {
    setError(null)
    setUpdatingPlan(plan)

    try {
      await changePlan(plan)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update subscription"
      setError(message)
    } finally {
      setUpdatingPlan(null)
    }
  }

  async function saveAutoReplySettings(nextEnabled: boolean, minRating: number) {
    setAutoReplyLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Unauthorized")

      const res = await fetch("/api/premium-auto-reply", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: nextEnabled, minRating }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save auto-reply settings")
      }

      setAutoReplyEnabled(Boolean(data?.enabled))
      setAutoReplyMinRating(Number(data?.minRating ?? PREMIUM_AUTO_REPLY_DEFAULT_MIN_RATING))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save auto-reply settings"
      setError(message)
    } finally {
      setAutoReplyLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <div style={{ maxWidth: 1680, margin: "0 auto", padding: "20px 24px 36px" }}>
        <section
          style={{
            borderRadius: 20,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
            marginBottom: 12,
          }}
        >
          <div style={{ backgroundColor: "#0f172a", padding: "20px 28px" }}>
            <p style={{ margin: 0, fontSize: 14, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: "#93c5fd" }}>
              Plans and access controls
            </p>
            <h1 style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>
              Subscription management
            </h1>
            <p style={{ marginTop: 8, marginBottom: 0, maxWidth: 680, fontSize: 14, color: "#94a3b8" }}>
              Choose your plan and instantly control which pages and features are enabled.
            </p>
          </div>

          <div style={{ padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
              Current plan: {loading ? "Loading..." : getPlanLabel(subscription.plan)}
            </span>
            {subscription.plan === "free" && !loading && (
              <span style={{ fontSize: 13, color: subscription.trialExpired ? "#b91c1c" : "#1e3a8a", fontWeight: 700 }}>
                {subscription.trialExpired
                  ? "Your trial has ended"
                  : `Trial days remaining: ${subscription.trialDaysRemaining ?? 0}`}
              </span>
            )}
            {error && <span style={{ fontSize: 13, color: "#b91c1c", fontWeight: 700 }}>{error}</span>}
          </div>

          <div style={{ padding: "0 24px 20px" }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, backgroundColor: "#f8fafc", padding: 14 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
                Plan split
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#334155", fontWeight: 600 }}>
                Basic includes manual sentiment analysis. Premium adds themes, AI suggestions, and deeper trend views.
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                AI reply generation stays capped at 5 attempts per review across all plans.
              </p>
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {PLAN_ORDER.map((plan) => {
            const isCurrent = subscription.plan === plan
            const isUpdating = updatingPlan === plan
            const planLimits = getPlanLimits(plan)

            return (
              <article
                key={plan}
                style={{
                  borderRadius: 16,
                  border: isCurrent ? "2px solid #2563eb" : "1.5px solid #e2e8f0",
                  backgroundColor: "#fff",
                  padding: 18,
                  boxShadow: isCurrent ? "0 6px 20px rgba(37,99,235,0.12)" : "0 1px 4px rgba(0,0,0,0.05)",
                }}
              >
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{getPlanLabel(plan)}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#334155", fontWeight: 700 }}>{getPlanPrice(plan)}</p>
                <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, color: "#64748b" }}>{getPlanDescription(plan)}</p>

                <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                  {PLAN_FEATURE_ORDER.map((featureKey) => {
                    const enabled = PLAN_FEATURES[plan][featureKey]
                    return (
                      <div key={featureKey} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 18,
                          height: 18,
                          borderRadius: 99,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 800,
                          color: enabled ? "#14532d" : "#64748b",
                          backgroundColor: enabled ? "#dcfce7" : "#e2e8f0",
                        }}>
                          {enabled ? "✓" : "-"}
                        </span>
                        <span style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{getFeatureLabel(featureKey)}</span>
                      </div>
                    )
                  })}
                </div>

                <div style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 10, display: "grid", gap: 4 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#334155" }}>
                    {getPlanUsageLabel("connectedBusinesses")}: {planLimits.connectedBusinesses}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#334155" }}>
                    Per-review AI generations: 5 max
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isCurrent || Boolean(updatingPlan)}
                  onClick={() => handlePlanChange(plan)}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid",
                    borderColor: isCurrent ? "#93c5fd" : "#1d4ed8",
                    backgroundColor: isCurrent ? "#dbeafe" : "#2563eb",
                    color: isCurrent ? "#1e3a8a" : "#fff",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: isCurrent || Boolean(updatingPlan) ? "not-allowed" : "pointer",
                  }}
                >
                  {isCurrent ? "Current Plan" : isUpdating ? "Updating..." : `Switch to ${getPlanLabel(plan)}`}
                </button>
              </article>
            )
          })}
        </section>

        {subscription.plan === "premium" && (
          <section style={{ marginTop: 20, border: "1px solid #e2e8f0", borderRadius: 16, backgroundColor: "#fff", padding: 18 }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Premium auto-reply</h3>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#475569" }}>
              Automatically generate and post replies for high-rating reviews after sync. Default is OFF.
            </p>

            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => void saveAutoReplySettings(!autoReplyEnabled, autoReplyMinRating)}
                disabled={autoReplyLoading}
                style={{
                  borderRadius: 10,
                  border: "1px solid #1d4ed8",
                  backgroundColor: autoReplyEnabled ? "#1d4ed8" : "#e2e8f0",
                  color: autoReplyEnabled ? "#fff" : "#334155",
                  fontSize: 13,
                  fontWeight: 800,
                  padding: "8px 14px",
                  cursor: autoReplyLoading ? "not-allowed" : "pointer",
                }}
              >
                {autoReplyLoading ? "Saving..." : autoReplyEnabled ? "Enabled" : "Disabled"}
              </button>

              <label style={{ fontSize: 13, color: "#334155", fontWeight: 700 }} htmlFor="auto-reply-min-rating">
                Minimum rating
              </label>
              <select
                id="auto-reply-min-rating"
                value={autoReplyMinRating}
                disabled={autoReplyLoading}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setAutoReplyMinRating(value)
                  void saveAutoReplySettings(autoReplyEnabled, value)
                }}
                style={{ borderRadius: 8, border: "1px solid #cbd5e1", padding: "6px 10px", fontSize: 13 }}
              >
                <option value={5}>5 stars</option>
                <option value={4}>4+ stars</option>
              </select>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}