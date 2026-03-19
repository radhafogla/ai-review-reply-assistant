import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError } from "@/lib/apiLogger"
import { normalizeReplyTone, REPLY_TONE_VALUES, type ReplyTone } from "@/lib/replyTone"

async function getCurrentBusiness(userId: string, supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name, reply_tone")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { business: null, error }
  }

  return { business, error: null }
}

function getBearerToken(req: NextRequest): string {
  const authHeader = req.headers.get("Authorization") || ""
  return authHeader.replace(/^Bearer\s+/i, "").trim()
}

export async function GET(req: NextRequest) {
  const endpoint = "/api/reply-tone"
  const requestId = createRequestId()
  const token = getBearerToken(req)

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerClient(token)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { business, error } = await getCurrentBusiness(user.id, supabase)

  if (error) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      status: 500,
      message: "Failed to load business tone",
      error,
    })

    return NextResponse.json({ error: "Failed to load reply tone" }, { status: 500 })
  }

  if (!business) {
    return NextResponse.json({ error: "No business connected" }, { status: 404 })
  }

  return NextResponse.json({
    tone: normalizeReplyTone(business.reply_tone),
    businessName: business.name,
  })
}

export async function POST(req: NextRequest) {
  const endpoint = "/api/reply-tone"
  const requestId = createRequestId()
  const token = getBearerToken(req)

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const requestedTone = normalizeReplyTone((body as { tone?: string })?.tone)

  if (!REPLY_TONE_VALUES.includes(requestedTone as ReplyTone)) {
    return NextResponse.json({ error: "Invalid tone" }, { status: 400 })
  }

  const supabase = await createServerClient(token)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { business, error } = await getCurrentBusiness(user.id, supabase)

  if (error) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      status: 500,
      message: "Failed to load business before tone update",
      error,
    })

    return NextResponse.json({ error: "Failed to update reply tone" }, { status: 500 })
  }

  if (!business) {
    return NextResponse.json({ error: "No business connected" }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from("businesses")
    .update({ reply_tone: requestedTone })
    .eq("id", business.id)

  if (updateError) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      status: 500,
      message: "Failed to persist reply tone",
      error: updateError,
      businessId: business.id,
    })

    return NextResponse.json({ error: "Failed to save reply tone" }, { status: 500 })
  }

  return NextResponse.json({ tone: requestedTone, businessName: business.name })
}
