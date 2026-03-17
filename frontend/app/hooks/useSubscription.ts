"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { normalizePlan, type SubscriptionPlan } from "@/lib/subscription"

const SUBSCRIPTION_UPDATED_EVENT = "subscription-updated"

type SubscriptionState = {
  plan: SubscriptionPlan
  status: string
  trialEnd: string | null
  trialExpired: boolean
  trialDaysRemaining: number | null
}

function toSubscriptionState(data: unknown): SubscriptionState {
  const payload = (data ?? {}) as {
    plan?: unknown
    status?: unknown
    trialEnd?: unknown
    trialExpired?: unknown
    trialDaysRemaining?: unknown
  }

  return {
    plan: normalizePlan(payload.plan),
    status: typeof payload.status === "string" ? payload.status : "active",
    trialEnd: typeof payload.trialEnd === "string" ? payload.trialEnd : null,
    trialExpired: Boolean(payload.trialExpired),
    trialDaysRemaining: typeof payload.trialDaysRemaining === "number" ? payload.trialDaysRemaining : null,
  }
}

export function useSubscription() {
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<SubscriptionState>({
    plan: "free",
    status: "active",
    trialEnd: null,
    trialExpired: false,
    trialDaysRemaining: null,
  })

  const refresh = useCallback(async () => {
    setLoading(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const token = session?.access_token
    if (!token) {
      setSubscription({ plan: "free", status: "active", trialEnd: null, trialExpired: false, trialDaysRemaining: null })
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
        setSubscription({ plan: "free", status: "active", trialEnd: null, trialExpired: false, trialDaysRemaining: null })
        return
      }

      setSubscription(toSubscriptionState(data))
    } catch {
      setSubscription({ plan: "free", status: "active", trialEnd: null, trialExpired: false, trialDaysRemaining: null })
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