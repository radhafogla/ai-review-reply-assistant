import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizePlan, type SubscriptionPlan } from "@/lib/subscription"

type PaidPlan = Exclude<SubscriptionPlan, "free">

type SubscriptionAccessState = {
  userPlan: SubscriptionPlan
  effectivePlan: SubscriptionPlan
  activePaidPlan: PaidPlan | null
  trialEnd: string | null
  trialExpired: boolean
  isTrialActive: boolean
  hasActivePaidSubscription: boolean
  isAccessAllowed: boolean
}

type EvaluateSubscriptionAccessInput = {
  userPlanRaw: unknown
  activeSubscriptionPlanRaw: unknown
  activeSubscriptionStatusRaw: unknown
  trialEndRaw: unknown
  nowMs?: number
}

type RequireAccessResult = {
  state: SubscriptionAccessState | null
  response: NextResponse | null
}

function isPaidPlan(plan: SubscriptionPlan): plan is PaidPlan {
  return plan === "basic" || plan === "premium"
}

function parseTrialState(trialEndRaw: unknown, nowMs = Date.now()) {
  if (typeof trialEndRaw !== "string") {
    return {
      trialEnd: null,
      trialExpired: true,
      isTrialActive: false,
    }
  }

  const trialEndDate = new Date(trialEndRaw)
  if (Number.isNaN(trialEndDate.getTime())) {
    return {
      trialEnd: null,
      trialExpired: true,
      isTrialActive: false,
    }
  }

  const trialExpired = trialEndDate.getTime() <= nowMs

  return {
    trialEnd: trialEndDate.toISOString(),
    trialExpired,
    isTrialActive: !trialExpired,
  }
}

export function evaluateTrialOrPaidAccess(input: EvaluateSubscriptionAccessInput): SubscriptionAccessState {
  const userPlan = normalizePlan(input.userPlanRaw)
  const activePlan = normalizePlan(input.activeSubscriptionPlanRaw)
  const activeStatus = typeof input.activeSubscriptionStatusRaw === "string" ? input.activeSubscriptionStatusRaw : null
  const activePaidPlan: PaidPlan | null = activeStatus === "active" && isPaidPlan(activePlan) ? activePlan : null
  const hasActivePaidSubscription = activePaidPlan !== null
  const { trialEnd, trialExpired, isTrialActive } = parseTrialState(input.trialEndRaw, input.nowMs)
  const effectivePlan = activePaidPlan ?? userPlan
  const isAccessAllowed = hasActivePaidSubscription || isTrialActive

  return {
    userPlan,
    effectivePlan,
    activePaidPlan,
    trialEnd,
    trialExpired,
    isTrialActive,
    hasActivePaidSubscription,
    isAccessAllowed,
  }
}

export async function resolveSubscriptionAccessState(
  userId: string,
  supabase: SupabaseClient,
): Promise<SubscriptionAccessState | null> {
  const [{ data: userRow, error: userError }, { data: activeSubscriptionRow, error: subscriptionError }] = await Promise.all([
    supabase
      .from("users")
      .select("plan, trial_end")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (userError || subscriptionError || !userRow) {
    return null
  }

  return evaluateTrialOrPaidAccess({
    userPlanRaw: userRow.plan,
    activeSubscriptionPlanRaw: activeSubscriptionRow?.plan,
    activeSubscriptionStatusRaw: activeSubscriptionRow?.status,
    trialEndRaw: userRow.trial_end,
  })
}

export async function requireTrialOrPaidAccess(
  userId: string,
  supabase: SupabaseClient,
): Promise<RequireAccessResult> {
  const state = await resolveSubscriptionAccessState(userId, supabase)

  if (!state) {
    return {
      state: null,
      response: NextResponse.json(
        { error: "Failed to validate subscription access", reason: "subscription_access_unavailable" },
        { status: 500 },
      ),
    }
  }

  if (state.isAccessAllowed) {
    return { state, response: null }
  }

  return {
    state,
    response: NextResponse.json(
      {
        error: "Trial expired. Upgrade to Basic or Premium to continue.",
        reason: "trial_expired",
        trialEnd: state.trialEnd,
      },
      { status: 402 },
    ),
  }
}
