"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabaseClient"
import { Location } from "../types/location"

export default function ConnectBusiness() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  // -------------------------
  // 1️⃣ Check Supabase session
  // -------------------------
  useEffect(() => {
    async function fetchUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
        setAccessToken(session.access_token ?? null)
      }
      setCheckingSession(false)
    }
    fetchUser()
  }, [])

  // Redirect to login if no user after session check
  useEffect(() => {
    if (!checkingSession && !userId) {
      router.push("/login")
    }
  }, [checkingSession, userId, router])

  // -------------------------
  // 2️⃣ Fetch Google locations
  // -------------------------
  useEffect(() => {
    async function fetchLocations() {
      if (!userId || !accessToken) return
      setLoading(true)
      try {
        const res = await fetch(`/api/google-locations`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.locations && data.locations.length > 0) {
            setLocations(data.locations)
            setConnected(true)
          }
        }
      } catch (err) {
        console.error("Error fetching locations", err)
      } finally {
        setLoading(false)
      }
    }
    fetchLocations()
  }, [userId, accessToken])

  // -------------------------
  // 3️⃣ Handle Supabase OAuth connect
  // -------------------------
  function handleConnect() {
    router.push(`/api/connect-google-business?userId=${userId}`)
  }

  // -------------------------
  // 4️⃣ Handle selecting a location
  // -------------------------
  async function handleSelect(location: Location) {
    if (!userId || !accessToken) return
    setLoading(true)
    try {
      const res = await fetch("/api/save-business", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          account_id: userId,
          location_id: location.locationId,
          name: location.name,
        }),
      })
      const data = await res.json()
      if (data.success) {
        router.push("/dashboard")
      }
    } catch (err) {
      console.error("Error saving business", err)
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="mx-auto max-w-4xl px-4 pt-10">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm backdrop-blur">
            <p className="text-slate-600">Loading session...</p>
          </div>
        </div>
      </div>
    )
  }
  if (!userId) return null // prevent flicker

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="mx-auto max-w-4xl px-4 pt-10">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
          {!connected ? (
            <div className="text-center">
              <div className="mb-3 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
                Setup Required
              </div>
              <h1 className="mb-3 text-2xl font-bold text-slate-900 md:text-3xl">Connect Your Google Business</h1>
              <p className="mx-auto mb-6 max-w-2xl text-slate-600">
                We need access to your Google Business locations to fetch reviews and start generating AI-assisted replies.
              </p>
              <button
                onClick={handleConnect}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
              >
                Connect Google Business
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
                Connected Successfully
              </div>
              <h1 className="mb-3 text-2xl font-bold text-slate-900 md:text-3xl">Select a Business Location</h1>
              <p className="mx-auto mb-6 max-w-2xl text-slate-600">
                Choose which location you want to manage with AI-assisted review replies.
              </p>

              {loading ? (
                <p className="text-slate-600">Loading locations...</p>
              ) : (
                <div className="mx-auto grid max-w-2xl gap-3">
                  {locations.map((loc) => (
                    <button
                      key={loc.locationId}
                      onClick={() => handleSelect(loc)}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-left font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-green-200 hover:bg-green-50 hover:text-green-700"
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}