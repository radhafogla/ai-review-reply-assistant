  "use client"

import { useRouter } from "next/navigation"

const VerifyEmail = () => {
  const router = useRouter()

  return (
    <div className="flex items-center justify-center h-screen">

      <div className="text-center">

        <h2 className="text-3xl font-bold mb-4">
          Verify Your Email
        </h2>

        <p className="text-gray-600 mb-8">
          Please verify your email before continuing.
        </p>

        <button
          onClick={() => router.push("/connect-business")}
          className="bg-black text-white px-6 py-3 rounded-lg"
        >
          I Verified My Email
        </button>

      </div>

    </div>
  )
}

export default VerifyEmail