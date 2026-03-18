"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { DEFAULT_SUBSCRIPTION_PLAN, createDefaultPlanLimits, createDefaultPlanUsage, normalizePlan, type SubscriptionPlan } from "@/lib/subscription"
import type { LimitWarning, PlanLimits } from "@/lib/subscription"

const SUBSCRIPTION_UPDATED_EVENT = "subscription-updated"

type SubscriptionState = {
  plan: SubscriptionPlan
  status: string
  trialEnd: string | null
  trialExpired: boolean
  trialDaysRemaining: number | null
  limits: PlanLimits
  usage: PlanLimits
  warnings: LimitWarning[]
}

function toSubscriptionState(data: unknown): SubscriptionState {
  const payload = (data ?? {}) as {
    plan?: unknown
    status?: unknown
    trialEnd?: unknown
    trialExpired?: unknown
    trialDaysRemaining?: unknown
    limits?: unknown
    usage?: unknown
    warnings?: unknown
  }

  const defaultLimits = createDefaultPlanLimits()
  const defaultUsage = createDefaultPlanUsage()

  const parsedLimits = (payload.limits ?? {}) as Partial<PlanLimits>
  const parsedUsage = (payload.usage ?? {}) as Partial<PlanLimits>
  const parsedWarnings = Array.isArray(payload.warnings) ? payload.warnings : []

  return {
    plan: normalizePlan(payload.plan),
    status: typeof payload.status === "string" ? payload.status : "active",
    trialEnd: typeof payload.trialEnd === "string" ? payload.trialEnd : null,
    trialExpired: Boolean(payload.trialExpired),
    trialDaysRemaining: typeof payload.trialDaysRemaining === "number" ? payload.trialDaysRemaining : null,
    limits: {
      monthlyAiGenerations: typeof parsedLimits.monthlyAiGenerations === "number" ? parsedLimits.monthlyAiGenerations : defaultLimits.monthlyAiGenerations,
      connectedBusinesses: typeof parsedLimits.connectedBusinesses === "number" ? parsedLimits.connectedBusinesses : defaultLimits.connectedBusinesses,
    },
    usage: {
      monthlyAiGenerations: typeof parsedUsage.monthlyAiGenerations === "number" ? parsedUsage.monthlyAiGenerations : defaultUsage.monthlyAiGenerations,
      connectedBusinesses: typeof parsedUsage.connectedBusinesses === "number" ? parsedUsage.connectedBusinesses : defaultUsage.connectedBusinesses,
    },
    warnings: parsedWarnings as LimitWarning[],
  }
}

export function useSubscription() {
  const defaultLimits = createDefaultPlanLimits()
  const defaultUsage = createDefaultPlanUsage()

  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<SubscriptionState>({
    plan: DEFAULT_SUBSCRIPTION_PLAN,
    status: "active",
    trialEnd: null,
    trialExpired: false,
    trialDaysRemaining: null,
    limits: defaultLimits,
    usage: defaultUsage,
    warnings: [],
  })

  const refresh = useCallback(async () => {
    setLoading(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const token = session?.access_token
    if (!token) {
      setSubscription(toSubscriptionState({}))
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/subscription", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        setSubscription(toSubscriptionState({}))
        return
      }

      setSubscription(toSubscriptionState(data))
    } catch {
      setSubscription(toSubscriptionState({}))
    } finally {
      setLoading(false)
    }
  }, [])

  const changePlan = useCallback(async (plan: SubscriptionPlan) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const token = session?.access_token
    if (!token) {
      throw new Error("Unauthorized")
    }

    const res = await fetch("/api/subscription", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data?.error || "Failed to update subscription")
    }

    const nextState = toSubscriptionState(data)

    setSubscription(nextState)

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<SubscriptionState>(SUBSCRIPTION_UPDATED_EVENT, { detail: nextState }))
    }

    return data
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const handleSubscriptionUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<SubscriptionState>
      if (customEvent.detail) {
        setSubscription(customEvent.detail)
      }
    }

    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, handleSubscriptionUpdated)

    return () => {
      window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, handleSubscriptionUpdated)
    }
  }, [])

  return {
    loading,
    subscription,
    refresh,
    changePlan,
  }
}