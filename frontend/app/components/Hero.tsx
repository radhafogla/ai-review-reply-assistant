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
      <section id="about" className="scroll-mt-24 px-4 py-16 md:py-18">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white/80 backdrop-blur rounded-3xl border border-slate-200 shadow-xl px-6 py-12 md:px-10 md:py-14 text-center">
          <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 mb-5">
            Smart review management for modern businesses
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 leading-tight max-w-3xl mx-auto mb-4">
            AI-Powered Review Replies & Insights
          </h1>

          <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto mb-8 leading-7">
            Automatically reply to reviews, track analytics, and get AI suggestions
            to strengthen your business reputation.
          </p>

          {!isLoggedIn && (
            <div className="flex justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm md:text-base font-medium text-white shadow-md transition hover:bg-blue-600"
              >
                Get Started for Free
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}