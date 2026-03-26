import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient, createServiceClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { assertBusinessRole } from "@/lib/businessAccess"
import { trackUsageEvent } from "@/lib/usageTracking"

export async function POST(req: NextRequest) {
  const endpoint = "/api/delete-business"
  const requestId = createRequestId()
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    logApiError({ requestId, endpoint, status: 401, message: "Missing bearer token", error: "missing_token" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerClient(token)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token)

  if (userError || !user) {
    logApiError({ requestId, endpoint, status: 401, message: "Invalid or missing user", error: userError?.message ?? "no_user" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { businessId } = await req.json()

  if (!businessId || typeof businessId !== "string") {
    logApiError({ requestId, endpoint, userId: user.id, status: 400, message: "Missing businessId", error: "missing_business_id" })
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
  }

  logApiRequest({ requestId, endpoint, userId: user.id, businessId })

  const access = await assertBusinessRole(user.id, businessId, supabase, "owner")
  if (access.error) {
    logApiError({ requestId, endpoint, userId: user.id, status: 403, message: "Insufficient role for delete-business", error: access.error, businessId })
    return NextResponse.json({ error: "Only the business owner can delete a business" }, { status: 403 })
  }

  const serviceSupabase = createServiceClient()

  const { error: deleteError } = await serviceSupabase
    .from("businesses")
    .delete()
    .eq("id", businessId)

  if (deleteError) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to delete business", error: deleteError, businessId })
    return NextResponse.json({ error: "Failed to delete business" }, { status: 500 })
  }

  await trackUsageEvent({
    requestId,
    endpoint,
    eventType: "business_deleted",
    userId: user.id,
    businessId,
  })

  return NextResponse.json({ success: true })
}
