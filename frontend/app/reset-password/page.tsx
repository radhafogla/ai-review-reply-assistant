"use client"

import { FormEvent, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { supabase } from "../../lib/supabaseClient"

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isRecoverySession, setIsRecoverySession] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const initializeRecovery = async () => {
      setError(null)
      const code = searchParams.get("code")
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
      const hasRecoveryHash = hashParams.get("type") === "recovery"

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError && isMounted) {
          setError("This reset link is invalid or expired. Request a new one.")
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession()

      if (!isMounted) return

      if (sessionError) {
        setError("We could not validate your reset session. Request a new link.")
      }

      if (hasRecoveryHash || !!data.session) {
        setIsRecoverySession(true)
      }

      setIsCheckingSession(false)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoverySession(true)
        setIsCheckingSession(false)
      }
    })

    initializeRecovery()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [searchParams])

  const resetFeedback = () => {
    setError(null)
    setMessage(null)
  }

  const handleRequestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()

    if (!email.trim()) {
      setError("Enter your account email to continue.")
      return
    }

    setIsSubmitting(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setIsSubmitting(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setMessage("If that email is registered, a reset link has been sent. Please check your inbox.")
    setEmail("")
  }

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()

    if (newPassword.length < 8) {
      setError("Choose a password with at least 8 characters.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setIsSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await supabase.auth.signOut()
    setMessage("Password updated successfully. Please sign in with your new password.")
    setNewPassword("")
    setConfirmPassword("")

    setTimeout(() => {
      router.replace("/login?mode=login")
    }, 1200)
  }

  return (
    <motion.div
      className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <motion.div
        className="relative box-border min-w-0 overflow-x-hidden rounded-3xl border border-slate-300/80 bg-gradient-to-b from-white/95 to-slate-50/90 p-6 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.28)] backdrop-blur md:p-8"
        style={{ width: "min(36rem, calc(100vw - 2rem))" }}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          {isRecoverySession ? "Set a new password" : "Reset your password"}
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          {isRecoverySession
            ? "Choose a new password for your account."
            : "Enter your email and we will send you a secure password reset link."}
        </p>

        {!isCheckingSession && (
          <form className="mt-6 space-y-3" onSubmit={isRecoverySession ? handleUpdatePassword : handleRequestReset}>
            {!isRecoverySession && (
              <>
                <label className="block text-sm font-medium text-slate-700" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@business.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-blue-400 focus:ring-blue-200"
                  autoComplete="email"
                  required
                />
              </>
            )}

            {isRecoverySession && (
              <>
                <label className="block text-sm font-medium text-slate-700" htmlFor="newPassword">
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Create a strong password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-blue-400 focus:ring-blue-200"
                  autoComplete="new-password"
                  required
                />

                <label className="block text-sm font-medium text-slate-700" htmlFor="confirmPassword">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-blue-400 focus:ring-blue-200"
                  autoComplete="new-password"
                  required
                />
              </>
            )}

            <div className="pt-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {isSubmitting
                  ? isRecoverySession
                    ? "Updating password..."
                    : "Sending reset link..."
                  : isRecoverySession
                    ? "Update password"
                    : "Send reset link"}
              </button>
            </div>
          </form>
        )}

        {isCheckingSession && (
          <div className="mt-6 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
            Validating reset session...
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
            {error}
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push("/login?mode=login")}
            className="text-sm font-medium text-slate-600 transition hover:text-blue-600"
          >
            &larr; Back to sign in
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
