import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient, createServiceClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

export async function POST(req: NextRequest) {
  const endpoint = "/api/delete-account"
  const requestId = createRequestId()

  try {
    const authHeader = req.headers.get("Authorization") || ""
    const token = authHeader.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 🔐 Verify user with normal client
    const supabase = await createServerClient(token)
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id
    logApiRequest({ requestId, endpoint, userId })

    // 🔥 Use admin client for deletion
    const admin = createServiceClient()

    const { error } = await admin.auth.admin.deleteUser(userId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logApiError({
      requestId,
      endpoint,
      status: 500,
      message: "Delete account failed",
      error,
    })

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}