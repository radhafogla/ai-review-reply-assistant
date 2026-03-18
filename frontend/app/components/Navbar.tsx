"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "../../lib/supabaseClient"
import { useSubscription } from "@/app/hooks/useSubscription"
import { getPlanLabel, hasFeature } from "@/lib/subscription"

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { subscription } = useSubscription()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeSection, setActiveSection] = useState<string>("")
  const [nowMs, setNowMs] = useState<number>(() => Date.now())

  const canViewAnalytics = hasFeature(subscription.plan, "analytics")

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      setIsAuthenticated(Boolean(data.session))
    }

    loadSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session))
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    router.prefetch("/dashboard")
    if (canViewAnalytics) {
      router.prefetch("/dashboard/analytics")
    }
    router.prefetch("/connect-business")
    router.prefetch("/subscriptions")
  }, [isAuthenticated, router, canViewAnalytics])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const navigateToSection = (section: "about" | "features") => {
    if (pathname === "/") {
      setActiveSection(section)
      const element = document.getElementById(section)
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" })
        window.history.replaceState(null, "", `/#${section}`)
      }
      return
    }

    router.push(`/#${section}`)
  }

  useEffect(() => {
    if (pathname !== "/") {
      return
    }

    const readHash = () => {
      const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : ""
      setActiveSection(hash)
    }

    readHash()
    window.addEventListener("hashchange", readHash)

    return () => {
      window.removeEventListener("hashchange", readHash)
    }
  }, [pathname])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 60 * 1000)

    return () => window.clearInterval(timer)
  }, [])

  const trialTimeLabel = (() => {
    if (subscription.plan !== "free" || !subscription.trialEnd) return ""

    const diffMs = new Date(subscription.trialEnd).getTime() - nowMs
    if (diffMs <= 0) return "Expired"

    const totalMinutes = Math.floor(diffMs / (1000 * 60))
    const days = Math.floor(totalMinutes / (60 * 24))
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
    const minutes = totalMinutes % 60

    return `${days}d ${hours}h ${minutes}m left`
  })()

  const getNavLinkClass = (isActive: boolean) => {
    return `inline-flex cursor-pointer items-center rounded-md px-2 py-1 text-sm font-semibold tracking-wide transition-all duration-200 ease-out ${
      isActive
        ? "text-blue-700 border-b-2 border-blue-600 bg-blue-50"
        : "text-slate-700 hover:text-blue-600 hover:bg-slate-100 border-b-2 border-transparent"
    }`
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="flex w-full items-center justify-between py-4" style={{ paddingLeft: "2rem", paddingRight: "3rem" }}>
        {/* Left: Logo */}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          <Link href="/" className="transition hover:text-blue-600">
            Review AI
          </Link>
        </h1>

        {/* Center: Navigation */}
        <div className="flex items-center justify-center gap-8">
          <button
            type="button"
            onClick={() => navigateToSection("about")}
            className={getNavLinkClass(pathname === "/" && activeSection === "about")}
          >
            About
          </button>

          <button
            type="button"
            onClick={() => navigateToSection("features")}
            className={getNavLinkClass(pathname === "/" && activeSection === "features")}
          >
            Features
          </button>

          {isAuthenticated && (
            <>
              <Link
                href="/dashboard"
                className={getNavLinkClass(pathname === "/dashboard")}
              >
                Dashboard
              </Link>

              {canViewAnalytics && (
                <Link
                  href="/dashboard/analytics"
                  className={getNavLinkClass(pathname === "/dashboard/analytics")}
                >
                  Analytics
                </Link>
              )}

              <Link
                href="/connect-business"
                className={getNavLinkClass(pathname === "/connect-business")}
              >
                Connect Business
              </Link>

              <Link
                href="/subscriptions"
                className={getNavLinkClass(pathname === "/subscriptions")}
              >
                Subscriptions
              </Link>
            </>
          )}
        </div>

        {/* Right: Auth & Settings */}
        <div className="flex items-center justify-end gap-4 ml-auto">
          {isAuthenticated && (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-bold tracking-wide text-blue-800">
              {subscription.plan === "free"
                ? `Free Trial${trialTimeLabel ? `: ${trialTimeLabel}` : ""}`
                : getPlanLabel(subscription.plan)}
            </span>
          )}

          {isAuthenticated && (
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-lg p-2 transition"
              style={
                pathname === "/settings"
                  ? { backgroundColor: "#eff6ff", color: "#2563eb" }
                  : { color: "#475569" }
              }
              title="Settings"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          )}

          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-600"
            >
              Logout
            </button>
          ) : (
            <>
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-600"
              >
                Sign Up
              </Link>
              <Link
                href="/login?mode=login"
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-600"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}