"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "../../lib/supabaseClient"

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeSection, setActiveSection] = useState<string>("")

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
    router.prefetch("/connect-business")
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

  const getNavLinkClass = (isActive: boolean) => {
    return `inline-flex cursor-pointer items-center rounded-md px-2 py-1 text-sm font-semibold tracking-wide transition-all duration-200 ease-out ${
      isActive
        ? "text-blue-700 border-b-2 border-blue-600 bg-blue-50"
        : "text-slate-700 hover:text-blue-600 hover:bg-slate-100 border-b-2 border-transparent"
    }`
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-6 py-4 md:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          <Link href="/" className="transition hover:text-blue-600">
            Review AI
          </Link>
        </h1>

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

              <Link
                href="/connect-business"
                className={getNavLinkClass(pathname === "/connect-business")}
              >
                Connect Business
              </Link>
            </>
          )}
        </div>

        <div className="flex justify-end">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-600"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-600"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}