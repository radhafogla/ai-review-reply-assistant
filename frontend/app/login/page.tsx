"use client"

import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter()

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/connect-business",
      },
    })

    if (error) {
      console.error("Login error:", error.message)
    }
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
        className="relative w-full max-w-md rounded-3xl border border-slate-300/80 bg-gradient-to-b from-white/95 to-slate-50/90 p-8 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.28)] backdrop-blur md:p-10"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
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
            Login to AI Review Assistant
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in with Google to manage reviews, generate replies, and view insights.
          </p>
        </div>

        <motion.button
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-slate-50/95 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-white transition hover:bg-white hover:shadow-md"
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