"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function Hero() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setIsLoggedIn(!!session)
    }
    checkAuth()
  }, [])

  return (
    <section id="about" className="scroll-mt-24 px-4 pb-8 pt-14 md:pb-10 md:pt-16">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border-[color:var(--primary-100)] bg-white/90 px-6 py-12 shadow-2xl md:px-10 md:py-14" style={{ borderColor: 'var(--primary-100)' }}>
          <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full blur-3xl" style={{ backgroundColor: 'color-mix(in srgb, var(--secondary-200) 50%, transparent)' }} />
          <div className="pointer-events-none absolute -bottom-20 -right-12 h-56 w-56 rounded-full blur-3xl" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-200) 50%, transparent)' }} />

          <div className="relative text-center">
            <div className="mb-5 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold" style={{ borderColor: 'var(--primary-200)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)' }}>
              Feedback intelligence for growing teams
            </div>

            <h1 className="mx-auto mb-4 max-w-4xl text-4xl font-black tracking-tight md:text-6xl md:leading-[1.05]" style={{ color: 'var(--neutral-900)' }}>
              Turn customer feedback into your competitive edge.
            </h1>

            <p className="mx-auto mb-8 max-w-2xl text-base leading-7 md:text-lg" style={{ color: 'var(--neutral-600)' }}>
              Revora helps teams manage customer reviews with AI-powered replies, brand voice templates, instant negative-review alerts, and actionable trend detection in one streamlined workflow.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={isLoggedIn ? "/dashboard" : "/login?mode=signup"}
                className="inline-flex min-w-44 items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md transition md:text-base"
                style={{ backgroundColor: 'var(--neutral-900)', '--hover-bg': 'var(--primary-600)' } as React.CSSProperties}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-600)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--neutral-900)')}
              >
                {isLoggedIn ? "Open Dashboard" : "Start Free"}
              </Link>
              <Link
                href="#features"
                className="inline-flex min-w-44 items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold transition md:text-base"
                style={{ borderColor: 'var(--neutral-300)', color: 'var(--neutral-700)', borderWidth: '1px' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-300)';
                  e.currentTarget.style.color = 'var(--primary-600)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--neutral-300)';
                  e.currentTarget.style.color = 'var(--neutral-700)';
                }}
              >
                See what Revora does
              </Link>
            </div>

            <div className="mx-auto mt-8 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
              <div className="rounded-2xl bg-white/80 p-4" style={{ borderColor: 'var(--neutral-200)', borderWidth: '1px' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--neutral-500)' }}>Reply time</p>
                <p className="mt-2 text-2xl font-black" style={{ color: 'var(--neutral-900)' }}>70% faster</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-4" style={{ borderColor: 'var(--neutral-200)', borderWidth: '1px' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--neutral-500)' }}>Brand voice</p>
                <p className="mt-2 text-2xl font-black" style={{ color: 'var(--neutral-900)' }}>Consistent</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-4" style={{ borderColor: 'var(--neutral-200)', borderWidth: '1px' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--neutral-500)' }}>Setup time</p>
                <p className="mt-2 text-2xl font-black" style={{ color: 'var(--neutral-900)' }}>5 minutes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}