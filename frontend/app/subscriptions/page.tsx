"use client"

import { useState } from "react"
import { useSubscription } from "@/app/hooks/useSubscription"
import { PLAN_FEATURES, getPlanLabel, type SubscriptionPlan } from "@/lib/subscription"

const PLAN_ORDER: SubscriptionPlan[] = ["free", "basic", "premium"]

const PLAN_DESCRIPTIONS: Record<SubscriptionPlan, string> = {
  free: "14-day trial with core workflow features and single-business setup.",
  basic: "Built for growing teams that need AI speed and analytics visibility.",
  premium: "Full suite with advanced controls for multi-business operations.",
}

const PLAN_PRICING: Record<SubscriptionPlan, string> = {
  free: "$0 for 14 days",
  basic: "$19 / month",
  premium: "$49 / month",
}

const FEATURES = [
  { key: "analytics", label: "Analytics page" },
  { key: "aiGeneration", label: "AI reply generation" },
  { key: "bulkActions", label: "Bulk generate and post" },
  { key: "multiBusiness", label: "Multiple connected businesses" },
] as const

export default function SubscriptionsPage() {
  const { loading, subscription, changePlan } = useSubscription()
  const [updatingPlan, setUpdatingPlan] = useState<SubscriptionPlan | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#f8fafc", padding: "32px 24px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <section
          style={{
            borderRadius: 20,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
            marginBottom: 20,
          }}
        >
          <div style={{ backgroundColor: "#0f172a", padding: "24px 32px" }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: "#93c5fd" }}>
              Plans and access controls
            </p>
            <h1 style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>
              Subscription management
            </h1>
            <p style={{ marginTop: 8, marginBottom: 0, maxWidth: 680, fontSize: 13, color: "#94a3b8" }}>
              Choose your plan and instantly control which pages and features are enabled.
            </p>
          </div>

          <div style={{ padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
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
        </section>

        <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {PLAN_ORDER.map((plan) => {
            const isCurrent = subscription.plan === plan
            const isUpdating = updatingPlan === plan

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
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#334155", fontWeight: 700 }}>{PLAN_PRICING[plan]}</p>
                <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, color: "#64748b" }}>{PLAN_DESCRIPTIONS[plan]}</p>

                <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                  {FEATURES.map((feature) => {
                    const enabled = PLAN_FEATURES[plan][feature.key]
                    return (
                      <div key={feature.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                        <span style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{feature.label}</span>
                      </div>
                    )
                  })}
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
      </div>
    </main>
  )
}