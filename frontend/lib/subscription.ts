export type SubscriptionPlan = "free" | "basic" | "premium"

export type SubscriptionFeature =
  | "analytics"
  | "aiGeneration"
  | "bulkActions"
  | "multiBusiness"

type FeatureMap = Record<SubscriptionFeature, boolean>

export const PLAN_FEATURES: Record<SubscriptionPlan, FeatureMap> = {
  free: {
    analytics: false,
    aiGeneration: true,
    bulkActions: false,
    multiBusiness: false,
  },
  basic: {
    analytics: true,
    aiGeneration: true,
    bulkActions: true,
    multiBusiness: false,
  },
  premium: {
    analytics: true,
    aiGeneration: true,
    bulkActions: true,
    multiBusiness: true,
  },
}

export function normalizePlan(value: unknown): SubscriptionPlan {
  if (value === "basic" || value === "premium" || value === "free") {
    return value
  }

  return "free"
}

export function hasFeature(plan: SubscriptionPlan, feature: SubscriptionFeature) {
  return PLAN_FEATURES[plan][feature]
}

export function getPlanLabel(plan: SubscriptionPlan) {
  if (plan === "free") return "Free Trial"
  if (plan === "basic") return "Basic"
  return "Premium"
}