import { describe, expect, it } from "vitest"
import {
  buildLimitWarnings,
  createDefaultPlanLimits,
  createDefaultPlanUsage,
  getFeatureGateTitle,
  getConnectedBusinessLimitExceededMessage,
  getFeatureGateApiMessage,
  getMonthRangeUtc,
  getPlanLimits,
  hasFeature,
  normalizePlan,
} from "../lib/subscription"

describe("subscription", () => {
  it("normalizes unsupported plans to free", () => {
    expect(normalizePlan("enterprise")).toBe("free")
    expect(normalizePlan(undefined)).toBe("free")
    expect(normalizePlan("premium")).toBe("premium")
    expect(normalizePlan("trial")).toBe("free")
  })

  it("returns feature gates by plan", () => {
    expect(hasFeature("free", "advancedAnalytics")).toBe(false)
    expect(hasFeature("basic", "bulkActions")).toBe(true)
    expect(hasFeature("premium", "premiumAutoReply")).toBe(true)
  })

  it("returns plan limits and default usage helpers", () => {
    expect(createDefaultPlanLimits()).toEqual(getPlanLimits("free"))
    expect(createDefaultPlanUsage()).toEqual({ monthlyAiGenerations: 0, connectedBusinesses: 0 })
  })

  it("builds notice and warning limit states once usage is high", () => {
    expect(buildLimitWarnings("free", { monthlyAiGenerations: 79, connectedBusinesses: 0 })).toEqual([])

    expect(buildLimitWarnings("free", { monthlyAiGenerations: 80, connectedBusinesses: 1 })).toEqual([
      {
        key: "monthlyAiGenerations",
        label: "Monthly AI generations",
        used: 80,
        limit: 100,
        percentUsed: 80,
        severity: "notice",
      },
      {
        key: "connectedBusinesses",
        label: "Connected businesses",
        used: 1,
        limit: 1,
        percentUsed: 100,
        severity: "warning",
      },
    ])
  })

  it("builds UTC month boundaries correctly", () => {
    expect(getMonthRangeUtc(new Date("2026-03-23T10:15:00.000Z"))).toEqual({
      monthStartIso: "2026-03-01T00:00:00.000Z",
      nextMonthStartIso: "2026-04-01T00:00:00.000Z",
    })
  })

  it("returns clear user-facing gate messages", () => {
    expect(getConnectedBusinessLimitExceededMessage(1)).toContain("1 connected business")
    expect(getFeatureGateApiMessage("premiumAutoReply")).toContain("Premium auto-reply")
    expect(getFeatureGateTitle("analytics")).toContain("Trial")
  })
})