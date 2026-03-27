  "use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { supabase } from "../../lib/supabaseClient"

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const [resending, setResending] = useState(false)
  const [resendNotice, setResendNotice] = useState<string | null>(null)

  const handleResend = async () => {
    if (!email) return
    setResending(true)
    setResendNotice(null)

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    })

    setResending(false)
    if (error) {
      setResendNotice("Could not resend. Please wait a moment and try again.")
    } else {
      setResendNotice("Verification email sent! Check your inbox.")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-slate-900">Check your inbox</h2>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          We sent a verification link to{" "}
          {email ? <span className="font-semibold text-slate-800">{email}</span> : "your email"}. Click the link to verify your account.
        </p>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
        </p>

        {resendNotice && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            {resendNotice}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {email && (
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resending ? "Sending..." : "Resend verification email"}
            </button>
          )}

          <button
            onClick={() => router.push("/login")}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}