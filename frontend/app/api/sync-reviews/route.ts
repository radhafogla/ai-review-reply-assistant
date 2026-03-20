import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { assertBusinessRole, listAccessibleBusinesses } from "@/lib/businessAccess"
import { performBusinessSync } from "@/lib/syncReviewsCore"

export async function POST(req: NextRequest) {
  const endpoint = "/api/sync-reviews"
  const requestId = createRequestId()
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace("Bearer ", "")

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = user.id
  logApiRequest({ requestId, endpoint, userId })

  const body = await req.json().catch(() => ({}))
  const requestedBusinessId =
    typeof body?.businessId === "string" && body.businessId.trim().length > 0
      ? body.businessId.trim()
      : null

  const { businesses: accessibleBusinesses, error: accessibleBusinessesError } =
    await listAccessibleBusinesses(userId, supabase)

  if (accessibleBusinessesError) {
    logApiError({
      requestId,
      endpoint,
      userId,
      status: 500,
      message: "Failed to load accessible businesses",
      error: accessibleBusinessesError,
    })
    return NextResponse.json({ error: "Failed to load businesses" }, { status: 500 })
  }

  const googleBusinesses = accessibleBusinesses.filter(
    (business) => business.platform === "google"
  )

  if (googleBusinesses.length === 0) {
    return NextResponse.json({ error: "No google business connected" }, { status: 400 })
  }

  const selectedBusinessId = requestedBusinessId ?? googleBusinesses[0].id
  const access = await assertBusinessRole(userId, selectedBusinessId, supabase, "manager")

  if (access.error) {
    logApiError({
      requestId,
      endpoint,
      userId,
      businessId: selectedBusinessId,
      status: 403,
      message: "Insufficient business role for sync-reviews",
      error: access.error,
    })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const result = await performBusinessSync(selectedBusinessId, userId)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    logApiError({
      requestId,
      endpoint,
      userId,
      status: 500,
      message: "Sync failed",
      error,
    })
    return NextResponse.json({ error: "Failed to sync Google reviews" }, { status: 500 })
  }
}
