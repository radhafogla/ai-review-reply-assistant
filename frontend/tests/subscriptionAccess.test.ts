import { describe, expect, it } from "vitest"
import { evaluateTrialOrPaidAccess, requireTrialOrPaidAccess } from "../lib/subscriptionAccess"

describe("subscriptionAccess", () => {
  const nowMs = Date.parse("2026-03-23T12:00:00.000Z")

  it("allows access when trial is active without paid subscription", () => {
    const state = evaluateTrialOrPaidAccess({
      userPlanRaw: "free",
      activeSubscriptionPlanRaw: null,
      activeSubscriptionStatusRaw: null,
      trialEndRaw: "2026-03-30T00:00:00.000Z",
      nowMs,
    })

    expect(state.isTrialActive).toBe(true)
    expect(state.hasActivePaidSubscription).toBe(false)
    expect(state.isAccessAllowed).toBe(true)
    expect(state.effectivePlan).toBe("free")
  })

  it("blocks access when trial is expired and no paid subscription is active", () => {
    const state = evaluateTrialOrPaidAccess({
      userPlanRaw: "free",
      activeSubscriptionPlanRaw: null,
      activeSubscriptionStatusRaw: null,
      trialEndRaw: "2026-03-01T00:00:00.000Z",
      nowMs,
    })

    expect(state.trialExpired).toBe(true)
    expect(state.hasActivePaidSubscription).toBe(false)
    expect(state.isAccessAllowed).toBe(false)
  })

  it("allows access when paid subscription is active even if trial expired", () => {
    const state = evaluateTrialOrPaidAccess({
      userPlanRaw: "free",
      activeSubscriptionPlanRaw: "basic",
      activeSubscriptionStatusRaw: "active",
      trialEndRaw: "2026-03-01T00:00:00.000Z",
      nowMs,
    })

    expect(state.trialExpired).toBe(true)
    expect(state.hasActivePaidSubscription).toBe(true)
    expect(state.isAccessAllowed).toBe(true)
    expect(state.effectivePlan).toBe("basic")
  })

  it("does not allow access for active free/trial subscription rows after expiry", () => {
    const state = evaluateTrialOrPaidAccess({
      userPlanRaw: "free",
      activeSubscriptionPlanRaw: "free",
      activeSubscriptionStatusRaw: "active",
      trialEndRaw: "2026-03-01T00:00:00.000Z",
      nowMs,
    })

    expect(state.hasActivePaidSubscription).toBe(false)
    expect(state.isAccessAllowed).toBe(false)
  })

  it("accepts trial alias and normalizes it to free", () => {
    const state = evaluateTrialOrPaidAccess({
      userPlanRaw: "trial",
      activeSubscriptionPlanRaw: null,
      activeSubscriptionStatusRaw: null,
      trialEndRaw: "2026-03-30T00:00:00.000Z",
      nowMs,
    })

    expect(state.userPlan).toBe("free")
    expect(state.effectivePlan).toBe("free")
    expect(state.isAccessAllowed).toBe(true)
  })
})

function createQueryResult(result: { data: unknown; error: unknown }) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => result,
  }

  return query
}

function createSupabaseMock(params: {
  userRow: { plan: string; trial_end: string | null } | null
  subscriptionRow: { plan: string; status: string } | null
  userError?: unknown
  subscriptionError?: unknown
}) {
  return {
    from: (table: string) => {
      if (table === "users") {
        return createQueryResult({ data: params.userRow, error: params.userError ?? null })
      }

      if (table === "subscriptions") {
        return createQueryResult({ data: params.subscriptionRow, error: params.subscriptionError ?? null })
      }

      throw new Error(`Unexpected table in test mock: ${table}`)
    },
  }
}

describe("requireTrialOrPaidAccess", () => {
  it("returns a 402 trial_expired response when no paid subscription and trial expired", async () => {
    const supabaseMock = createSupabaseMock({
      userRow: {
        plan: "free",
        trial_end: "2026-03-01T00:00:00.000Z",
      },
      subscriptionRow: null,
    })

    const result = await requireTrialOrPaidAccess("user-123", supabaseMock as never)

    expect(result.state?.trialExpired).toBe(true)
    expect(result.state?.isAccessAllowed).toBe(false)
    expect(result.response?.status).toBe(402)

    const payload = await result.response?.json()
    expect(payload).toMatchObject({
      reason: "trial_expired",
      error: "Trial expired. Upgrade to Basic or Premium to continue.",
      trialEnd: "2026-03-01T00:00:00.000Z",
    })
  })

  it("returns null response for active paid subscriptions", async () => {
    const supabaseMock = createSupabaseMock({
      userRow: {
        plan: "free",
        trial_end: "2026-03-01T00:00:00.000Z",
      },
      subscriptionRow: {
        plan: "premium",
        status: "active",
      },
    })

    const result = await requireTrialOrPaidAccess("user-456", supabaseMock as never)

    expect(result.response).toBeNull()
    expect(result.state?.isAccessAllowed).toBe(true)
    expect(result.state?.effectivePlan).toBe("premium")
  })
})
