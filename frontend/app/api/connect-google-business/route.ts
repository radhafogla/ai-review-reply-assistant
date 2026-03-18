import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiRequest } from "@/lib/apiLogger"
import { createGoogleOAuthState } from "@/lib/googleOAuthState"

function getAppBaseUrl(req: NextRequest) {
  return process.env.LOCALAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId()
  const endpoint = "/api/connect-google-business"
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerClient(token)
  const {
    data: { user },
  } = await supabase.auth.getUser(token)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  logApiRequest({ requestId, endpoint, userId: user.id })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = `${getAppBaseUrl(req)}/api/google-callback`
  const state = createGoogleOAuthState(user.id)

  const scope = [
    "https://www.googleapis.com/auth/business.manage",
  ].join(" ")

  const oauthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&include_granted_scopes=true` +
    `&state=${encodeURIComponent(state)}`

  return NextResponse.json({ url: oauthUrl })
}