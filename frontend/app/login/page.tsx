import { Suspense } from "react"
import LoginContent from "./login-content"

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">Loading...</div>}>
      <LoginContent />
    </Suspense>
  )
}