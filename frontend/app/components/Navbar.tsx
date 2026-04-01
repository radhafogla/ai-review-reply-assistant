"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "../../lib/supabaseClient"
import { useSubscription } from "@/app/hooks/useSubscription"
import { getPlanLabel } from "@/lib/subscription"

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { subscription } = useSubscription()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeSection, setActiveSection] = useState<string>("")
  const [trialTimeLabel, setTrialTimeLabel] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      setIsAuthenticated(Boolean(data.session))
      setUserEmail(data.session?.user?.email ?? "")
    }

    loadSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session))
      if (session?.user?.email) setUserEmail(session.user.email)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    router.prefetch("/dashboard")
    router.prefetch("/dashboard/analytics")
    router.prefetch("/connect-business")
    // router.prefetch("/subscriptions") // hidden for now
  }, [isAuthenticated, router])

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
    function computeLabel(): string {
      if (subscription.plan !== "free" || !subscription.trialEnd) return ""
      const diffMs = new Date(subscription.trialEnd).getTime() - Date.now()
      if (diffMs <= 0) return "Expired"
      const totalMinutes = Math.floor(diffMs / (1000 * 60))
      const days = Math.floor(totalMinutes / (60 * 24))
      const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
      const minutes = totalMinutes % 60
      return `${days}d ${hours}h ${minutes}m left`
    }

    const init = setTimeout(() => setTrialTimeLabel(computeLabel()), 0)
    const timer = setInterval(() => setTrialTimeLabel(computeLabel()), 60_000)

    return () => {
      clearTimeout(init)
      clearInterval(timer)
    }
  }, [subscription.plan, subscription.trialEnd])

  const getNavLinkClass = (isActive: boolean) => {
    return `inline-flex cursor-pointer items-center rounded-md px-2 py-1 text-sm font-semibold tracking-wide transition-all duration-200 ease-out border-b-2 ${
      isActive ? "" : ""
    }`;
  }

  const getNavLinkStyle = (isActive: boolean) => ({
    color: isActive ? 'var(--primary-700)' : 'var(--neutral-700)',
    borderBottomColor: isActive ? 'var(--primary-500)' : 'transparent',
    backgroundColor: isActive ? 'var(--primary-50)' : 'transparent',
  });

  return (
    <nav className="sticky top-0 z-50 shadow-sm" style={{ borderBottomColor: 'color-mix(in srgb, var(--neutral-200) 80%, transparent)', borderBottomWidth: '1px', backgroundColor: 'color-mix(in srgb, white 85%, transparent)', backdropFilter: 'blur(12px)' }}>
      <div className="relative flex w-full items-center justify-between py-4" style={{ paddingLeft: "2rem", paddingRight: "3rem" }}>
        {/* Left: Logo */}
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--neutral-900)' }}>
          <Link href="/" className="transition" style={{ color: 'var(--neutral-900)' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-600)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--neutral-900)')}>
            Revidew
          </Link>
        </h1>

        {/* Center: Navigation */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center justify-center gap-8 md:flex">
          <button
            type="button"
            onClick={() => navigateToSection("about")}
            className={getNavLinkClass(pathname === "/" && activeSection === "about")}
            style={getNavLinkStyle(pathname === "/" && activeSection === "about")}
            onMouseEnter={(e) => {
              if (pathname !== "/" || activeSection !== "about") {
                e.currentTarget.style.color = 'var(--primary-600)';
                e.currentTarget.style.backgroundColor = 'var(--primary-50)';
              }
            }}
            onMouseLeave={(e) => {
              if (pathname !== "/" || activeSection !== "about") {
                e.currentTarget.style.color = 'var(--neutral-700)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            About
          </button>

          <button
            type="button"
            onClick={() => navigateToSection("features")}
            className={getNavLinkClass(pathname === "/" && activeSection === "features")}
            style={getNavLinkStyle(pathname === "/" && activeSection === "features")}
            onMouseEnter={(e) => {
              if (pathname !== "/" || activeSection !== "features") {
                e.currentTarget.style.color = 'var(--primary-600)';
                e.currentTarget.style.backgroundColor = 'var(--primary-50)';
              }
            }}
            onMouseLeave={(e) => {
              if (pathname !== "/" || activeSection !== "features") {
                e.currentTarget.style.color = 'var(--neutral-700)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Features
          </button>

          {isAuthenticated && (
            <>
              <Link
                href="/dashboard"
                className={getNavLinkClass(pathname === "/dashboard")}
                style={getNavLinkStyle(pathname === "/dashboard")}
                onMouseEnter={(e) => {
                  if (pathname !== "/dashboard") {
                    e.currentTarget.style.color = 'var(--primary-600)';
                    e.currentTarget.style.backgroundColor = 'var(--primary-50)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (pathname !== "/dashboard") {
                    e.currentTarget.style.color = 'var(--neutral-700)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                Dashboard
              </Link>

              <Link
                href="/dashboard/analytics"
                className={getNavLinkClass(pathname === "/dashboard/analytics")}
                style={getNavLinkStyle(pathname === "/dashboard/analytics")}
                onMouseEnter={(e) => {
                  if (pathname !== "/dashboard/analytics") {
                    e.currentTarget.style.color = 'var(--primary-600)';
                    e.currentTarget.style.backgroundColor = 'var(--primary-50)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (pathname !== "/dashboard/analytics") {
                    e.currentTarget.style.color = 'var(--neutral-700)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                Analytics
              </Link>

              <Link
                href="/connect-business"
                className={getNavLinkClass(pathname === "/connect-business")}
                style={getNavLinkStyle(pathname === "/connect-business")}
                onMouseEnter={(e) => {
                  if (pathname !== "/connect-business") {
                    e.currentTarget.style.color = 'var(--primary-600)';
                    e.currentTarget.style.backgroundColor = 'var(--primary-50)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (pathname !== "/connect-business") {
                    e.currentTarget.style.color = 'var(--neutral-700)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                Connect Business
              </Link>

              {/* Subscriptions link hidden for now — uncomment to restore
              <Link
                href="/subscriptions"
                className={getNavLinkClass(pathname === "/subscriptions")}
                style={getNavLinkStyle(pathname === "/subscriptions")}
                onMouseEnter={(e) => {
                  if (pathname !== "/subscriptions") {
                    e.currentTarget.style.color = 'var(--primary-600)';
                    e.currentTarget.style.backgroundColor = 'var(--primary-50)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (pathname !== "/subscriptions") {
                    e.currentTarget.style.color = 'var(--neutral-700)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                Subscriptions
              </Link>
              */}

            </>
          )}
        </div>

        {/* Right: Auth & Settings */}
        <div className="ml-auto flex items-center justify-end gap-4">
          {isAuthenticated && (
            <span className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold tracking-wide" style={{ borderColor: 'var(--primary-200)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)' }}>
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
                  ? { backgroundColor: 'var(--primary-50)', color: 'var(--primary-600)' }
                  : { color: 'var(--neutral-600)' }
              }
              onMouseEnter={(e) => {
                if (pathname !== "/settings") {
                  e.currentTarget.style.color = 'var(--primary-600)';
                  e.currentTarget.style.backgroundColor = 'var(--primary-50)';
                }
              }}
              onMouseLeave={(e) => {
                if (pathname !== "/settings") {
                  e.currentTarget.style.color = 'var(--neutral-600)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              title="Settings"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          )}

          {isAuthenticated ? (
            <div
              style={{ position: "relative" }}
              onMouseEnter={() => setShowUserMenu(true)}
              onMouseLeave={() => setShowUserMenu(false)}
            >
              <button
                type="button"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "none",
                  backgroundColor: "var(--primary-600)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textTransform: "uppercase",
                  transition: "background-color 150ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--primary-700)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--primary-600)")}
                title={userEmail}
              >
                {userEmail ? userEmail[0] : "U"}
              </button>

              {showUserMenu && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    paddingTop: 6,
                    zIndex: 100,
                  }}
                >
                  <div
                    style={{
                      minWidth: 220,
                      backgroundColor: "#fff",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>
                        Signed in as
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "#0f172a", wordBreak: "break-all" }}>
                        {userEmail}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#dc2626",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background-color 100ms ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-2.5 text-sm font-medium shadow-sm transition"
                style={{ borderColor: 'var(--neutral-300)', borderWidth: '1px', color: 'var(--neutral-700)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-300)';
                  e.currentTarget.style.color = 'var(--primary-600)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--neutral-300)';
                  e.currentTarget.style.color = 'var(--neutral-700)';
                }}
              >
                Sign Up
              </Link>
              <Link
                href="/login?mode=login"
                className="inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-white shadow-sm transition"
                style={{ backgroundColor: 'var(--neutral-900)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-600)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--neutral-900)')}
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