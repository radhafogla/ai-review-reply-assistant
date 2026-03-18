"use client"

import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { FormEvent, useState } from "react"
import { motion } from "framer-motion"
import { supabase } from "../../lib/supabaseClient"

type AuthMode = "login" | "signup"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showSessionExpiredNotice = searchParams.get("reason") === "session-expired"
  const requestedMode: AuthMode = searchParams.get("mode") === "signup" ? "signup" : "login"
  const [mode, setMode] = useState<AuthMode>(() => requestedMode)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)

  const isGmailAddress = /^[^@]+@(gmail|googlemail)\.com$/i.test(email.trim())

  const getRedirectTo = () => `${window.location.origin}/connect-business`

  const ensureUserRecord = async (accessToken: string) => {
    const res = await fetch("/api/ensure-user", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || "We signed you in, but failed to initialize your account.")
    }
  }

  const determineRedirect = async (userId: string) => {
    const { data: businesses, error } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", userId)
      .limit(1)

    if (!error && businesses && businesses.length > 0) {
      return "/dashboard"
    }

    return "/connect-business"
  }

  const resetFeedback = () => {
    setAuthError(null)
    setAuthNotice(null)
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    resetFeedback()
  }


  const getLoginErrorMessage = (message: string) => {
    if (/invalid login credentials/i.test(message)) {
      return "No account matched that email and password. Sign up first or continue with Google."
    }

    return message
  }

  const handleGoogleLogin = async () => {
    resetFeedback()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getRedirectTo(),
      },
    })

    if (error) {
      setAuthError(error.message)
    }
  }

  const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()

    if (!email.trim() || !password) {
      setAuthError("Enter your email and password to continue.")
      return
    }

    setIsSubmitting(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (!error && data.session?.access_token) {
      try {
        await ensureUserRecord(data.session.access_token)
      } catch (ensureErr) {
        setIsSubmitting(false)
        setAuthError(ensureErr instanceof Error ? ensureErr.message : "Failed to initialize account.")
        return
      }
    }

    setIsSubmitting(false)

    if (error) {
      setAuthError(getLoginErrorMessage(error.message))
      return
    }

    const redirectPath = await determineRedirect(data.user?.id || "")
    router.push(redirectPath)
  }

  const handlePasswordSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()

    if (!fullName.trim()) {
      setAuthError("Enter your full name to create your account.")
      return
    }

    if (!email.trim()) {
      setAuthError("Enter your email to create your account.")
      return
    }

    if (password.length < 8) {
      setAuthError("Choose a password with at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    const signupRes = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      }),
    })

    const signupData = await signupRes.json().catch(() => ({}))

    if (!signupRes.ok) {
      setIsSubmitting(false)
      setAuthError(signupData.error || "Failed to create account.")
      return
    }

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (loginError) {
      setIsSubmitting(false)
      setAuthError("Account created, but auto-login failed. Please log in with your new password.")
      return
    }

    if (loginData.session?.access_token) {
      try {
        await ensureUserRecord(loginData.session.access_token)
      } catch (ensureErr) {
        setIsSubmitting(false)
        setAuthError(ensureErr instanceof Error ? ensureErr.message : "Failed to initialize account.")
        return
      }
    }

    setIsSubmitting(false)
    const redirectPath = await determineRedirect(loginData.user?.id || "")
    router.push(redirectPath)
  }

  return (
    <motion.div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-10 top-16 h-40 w-40 rounded-full bg-blue-200/30 blur-3xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        />
        <motion.div
          className="absolute bottom-10 right-10 h-48 w-48 rounded-full bg-indigo-200/30 blur-3xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        />
      </div>

      {/* Login card */}
      <motion.div
        className="relative w-[90vw] max-w-[26rem] rounded-3xl border border-slate-300/80 bg-gradient-to-b from-white/95 to-slate-50/90 p-6 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.28)] backdrop-blur md:max-w-[28rem] md:p-8"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {showSessionExpiredNotice && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            Your session expired. Please sign in again.
          </div>
        )}

        <div className="mb-6 text-center">
          <motion.div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-blue-600 text-xl font-semibold text-white shadow-md"
            initial={{ opacity: 0, rotate: -8 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            AI
          </motion.div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Access AI Review Assistant
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use email and password for direct access without confirmation prompts, or use Google if that is already your primary identity.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mode === "login"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mode === "signup"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            Sign Up
          </button>
        </div>

        <form className="space-y-3" onSubmit={mode === "login" ? handlePasswordLogin : handlePasswordSignup}>
          {mode === "signup" && (
            <>
              <label className="block text-sm font-medium text-slate-700" htmlFor="fullName">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Jane Smith"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-blue-400 focus:ring-blue-200"
                autoComplete="name"
                required
              />
            </>
          )}

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

          {isGmailAddress && (
            <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
                <path fill="#4285F4" d="M21.805 12.041c0-.817-.066-1.412-.208-2.03H12.2v3.715h5.517c-.111.923-.711 2.313-2.045 3.247l-.019.124 2.972 2.258.206.02c1.89-1.712 2.974-4.23 2.974-7.334Z" />
                <path fill="#34A853" d="M12.2 21.75c2.703 0 4.973-.87 6.63-2.375l-3.159-2.402c-.844.579-1.978.986-3.471.986-2.647 0-4.89-1.712-5.689-4.08l-.119.01-3.09 2.345-.041.111C4.907 19.56 8.304 21.75 12.2 21.75Z" />
                <path fill="#FBBC05" d="M6.511 13.879A5.86 5.86 0 0 1 6.178 12c0-.653.111-1.287.311-1.879l-.006-.126-3.129-2.383-.102.048A9.63 9.63 0 0 0 2.178 12c0 1.55.378 3.016 1.074 4.34l3.259-2.461Z" />
                <path fill="#EA4335" d="M12.2 6.041c1.882 0 3.149.801 3.87 1.47l2.826-2.699C17.162 3.263 14.903 2.25 12.2 2.25c-3.896 0-7.293 2.19-8.948 5.41l3.237 2.46c.81-2.368 3.053-4.079 5.711-4.079Z" />
              </svg>
              <span className="flex-1">Gmail detected &mdash; sign in faster with Google.</span>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="shrink-0 font-semibold underline underline-offset-2 hover:text-blue-600"
              >
                Use Google
              </button>
            </div>
          )}

          <label className="block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === "login" ? "Enter your password" : "Create a strong password"}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-blue-400 focus:ring-blue-200"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />

          {mode === "signup" && (
            <>
              <label className="block text-sm font-medium text-slate-700" htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-blue-400 focus:ring-blue-200"
                autoComplete="new-password"
                required
              />
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {isSubmitting
              ? mode === "login"
                ? "Logging in..."
                : "Creating account..."
              : mode === "login"
                ? "Log In"
                : "Create Account"}
          </button>

          <p className="text-xs leading-5 text-slate-500">
            {mode === "login"
              ? "Use the account you already created. If you do not have one yet, switch to Sign Up."
              : "Your account will use this email and password for future sign-ins."}
          </p>

          {mode === "login" ? (
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
            >
              Need an account? Sign Up
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
            >
              Already have an account? Log In
            </button>
          )}
        </form>

        {authNotice && (
          <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            {authNotice}
          </div>
        )}

        {authError && (
          <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
            {authError}
          </div>
        )}

        <motion.button
          onClick={handleGoogleLogin}
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-slate-50/95 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-white transition hover:bg-white hover:shadow-md"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
          >
            <path
              fill="#4285F4"
              d="M21.805 12.041c0-.817-.066-1.412-.208-2.03H12.2v3.715h5.517c-.111.923-.711 2.313-2.045 3.247l-.019.124 2.972 2.258.206.02c1.89-1.712 2.974-4.23 2.974-7.334Z"
            />
            <path
              fill="#34A853"
              d="M12.2 21.75c2.703 0 4.973-.87 6.63-2.375l-3.159-2.402c-.844.579-1.978.986-3.471.986-2.647 0-4.89-1.712-5.689-4.08l-.119.01-3.09 2.345-.041.111C4.907 19.56 8.304 21.75 12.2 21.75Z"
            />
            <path
              fill="#FBBC05"
              d="M6.511 13.879A5.86 5.86 0 0 1 6.178 12c0-.653.111-1.287.311-1.879l-.006-.126-3.129-2.383-.102.048A9.63 9.63 0 0 0 2.178 12c0 1.55.378 3.016 1.074 4.34l3.259-2.461Z"
            />
            <path
              fill="#EA4335"
              d="M12.2 6.041c1.882 0 3.149.801 3.87 1.47l2.826-2.699C17.162 3.263 14.903 2.25 12.2 2.25c-3.896 0-7.293 2.19-8.948 5.41l3.237 2.46c.81-2.368 3.053-4.079 5.711-4.079Z"
            />
          </svg>
          <span>Continue with Google</span>
        </motion.button>

        <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

        <div className="mt-1 text-center">
          <motion.button
            onClick={() => router.push("/")}
            className="text-sm font-medium text-slate-600 transition hover:text-blue-600"
          >
            ← Back to home
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}