export type SubscriptionPlan = "free" | "basic" | "premium"

export type SubscriptionFeature =
  | "analytics"
  | "negativeReviewAlerts"
  | "advancedAnalytics"
  | "aiGeneration"
  | "bulkActions"
  | "multiBusiness"
  | "premiumAutoReply"

export type PlanLimitKey = "monthlyAiGenerations" | "connectedBusinesses"

export type PlanLimits = Record<PlanLimitKey, number>

export type LimitWarning = {
  key: PlanLimitKey
  label: string
  used: number
  limit: number
  percentUsed: number
  severity: "notice" | "warning"
}

type FeatureMap = Record<SubscriptionFeature, boolean>

export const DEFAULT_SUBSCRIPTION_PLAN: SubscriptionPlan = "free"
export const PREMIUM_AUTO_REPLY_DEFAULT_MIN_RATING = 5
export const PLAN_ORDER: SubscriptionPlan[] = ["free", "basic", "premium"]

export const PLAN_DESCRIPTIONS: Record<SubscriptionPlan, string> = {
  free: "14-day trial with core workflow features and single-business setup.",
  basic: "Built for growing teams that need AI speed and analytics visibility.",
  premium: "Full suite with advanced controls for multi-business operations.",
}

export const PLAN_PRICING: Record<SubscriptionPlan, string> = {
  free: "$0 for 14 days",
  basic: "$39 / month",
  premium: "$89 / month",
}

export const PLAN_FEATURE_ORDER: SubscriptionFeature[] = [
  "analytics",
  "negativeReviewAlerts",
  "advancedAnalytics",
  "aiGeneration",
  "bulkActions",
  "multiBusiness",
  "premiumAutoReply",
]

export const PLAN_FEATURE_LABELS: Record<SubscriptionFeature, string> = {
  analytics: "Basic analytics",
  negativeReviewAlerts: "Negative review email alerts",
  advancedAnalytics: "Premium insights",
  aiGeneration: "AI reply generation",
  bulkActions: "Bulk generate and post",
  multiBusiness: "Multiple connected businesses",
  premiumAutoReply: "Auto-reply for 5-star reviews",
}

export const PLAN_FEATURES: Record<SubscriptionPlan, FeatureMap> = {
  free: {
    analytics: true,
    negativeReviewAlerts: true,
    advancedAnalytics: false,
    aiGeneration: true,
    bulkActions: false,
    multiBusiness: false,
    premiumAutoReply: false,
  },
  basic: {
    analytics: true,
    negativeReviewAlerts: true,
    advancedAnalytics: false,
    aiGeneration: true,
    bulkActions: true,
    multiBusiness: true,
    premiumAutoReply: false,
  },
  premium: {
    analytics: true,
    negativeReviewAlerts: true,
    advancedAnalytics: true,
    aiGeneration: true,
    bulkActions: true,
    multiBusiness: true,
    premiumAutoReply: true,
  },
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    monthlyAiGenerations: 100,
    connectedBusinesses: 1,
  },
  basic: {
    monthlyAiGenerations: 1000,
    connectedBusinesses: 5,
  },
  premium: {
    monthlyAiGenerations: 5000,
    connectedBusinesses: 20,
  },
}

const LIMIT_LABELS: Record<PlanLimitKey, string> = {
  monthlyAiGenerations: "Monthly AI generations",
  connectedBusinesses: "Connected businesses",
}

export const PLAN_USAGE_LABELS: Record<PlanLimitKey, string> = {
  monthlyAiGenerations: "AI generations",
  connectedBusinesses: "Connected businesses",
}

export function normalizePlan(value: unknown): SubscriptionPlan {
  // "trial" is accepted as an alias for legacy/cross-system compatibility.
  if (value === "trial") {
    return "free"
  }

  if (value === "basic" || value === "premium" || value === "free") {
    return value
  }

  return DEFAULT_SUBSCRIPTION_PLAN
}

export function hasFeature(plan: SubscriptionPlan, feature: SubscriptionFeature) {
  return PLAN_FEATURES[plan][feature]
}

export function getFeatureLabel(feature: SubscriptionFeature) {
  return PLAN_FEATURE_LABELS[feature]
}

export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan]
}

export function createDefaultPlanLimits(): PlanLimits {
  return {
    ...getPlanLimits(DEFAULT_SUBSCRIPTION_PLAN),
  }
}

export function createDefaultPlanUsage(): PlanLimits {
  return {
    monthlyAiGenerations: 0,
    connectedBusinesses: 0,
  }
}

export function getMonthRangeUtc(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))

  return {
    monthStartIso: start.toISOString(),
    nextMonthStartIso: end.toISOString(),
  }
}

export function buildLimitWarnings(
  plan: SubscriptionPlan,
  usage: Pick<PlanLimits, "monthlyAiGenerations" | "connectedBusinesses">,
) {
  const limits = getPlanLimits(plan)
  const warnings: LimitWarning[] = []

  for (const key of ["monthlyAiGenerations", "connectedBusinesses"] as const) {
    const used = Math.max(0, Number(usage[key] ?? 0))
    const limit = Math.max(1, Number(limits[key]))
    const percentUsed = Math.min(999, Math.round((used / limit) * 100))

    if (percentUsed >= 80) {
      warnings.push({
        key,
        label: LIMIT_LABELS[key],
        used,
        limit,
        percentUsed,
        severity: percentUsed >= 100 ? "warning" : "notice",
      })
    }
  }

  return warnings
}

export function getPlanLabel(plan: SubscriptionPlan) {
  if (plan === "free") return "Free Trial"
  if (plan === "basic") return "Basic"
  return "Premium"
}

export function getPlanDescription(plan: SubscriptionPlan) {
  return PLAN_DESCRIPTIONS[plan]
}

export function getPlanPrice(plan: SubscriptionPlan) {
  return PLAN_PRICING[plan]
}

export function getPlanUsageLabel(key: PlanLimitKey) {
  return PLAN_USAGE_LABELS[key]
}

export function getConnectedBusinessLimitExceededMessage(limit: number) {
  return `Your current plan allows only ${limit} connected business(es). Upgrade to Premium to add more.`
}

export function getFeatureGateApiMessage(feature: SubscriptionFeature) {
  if (feature === "analytics") {
    return "Analytics is not included in your current plan"
  }

  if (feature === "advancedAnalytics") {
    return "Premium insights are available only on the Premium plan"
  }

  if (feature === "premiumAutoReply") {
    return "Premium auto-reply is available only on Premium plan"
  }

  return "This feature is not included in your current plan"
}

export function getFeatureGateTitle(feature: SubscriptionFeature) {
  if (feature === "analytics") {
    return "Analytics is not available on Trial"
  }

  if (feature === "advancedAnalytics") {
    return "Premium insights are available on Premium"
  }

  if (feature === "premiumAutoReply") {
    return "Premium auto-reply is available on Premium"
  }

  return "Feature unavailable on current plan"
}

export function getFeatureGateUpgradeHint(feature: SubscriptionFeature) {
  if (feature === "analytics") {
    return "Upgrade to Basic or Premium to view analytics charts and performance insights."
  }

  if (feature === "advancedAnalytics") {
    return "Upgrade to Premium to unlock recurring themes, AI suggestions, and premium trend views."
  }

  if (feature === "premiumAutoReply") {
    return "Upgrade to Premium to enable automatic replies for high-rating reviews."
  }

  return "Upgrade your plan to unlock this feature."
}

export function getTrialEndedUpgradeMessage() {
  return "Your Free Trial has ended. Choose Basic or Premium to continue using Revidew."
}