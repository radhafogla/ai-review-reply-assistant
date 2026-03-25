import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { verifyGoogleOAuthState } from "@/lib/googleOAuthState"

function getAppBaseUrl(req: NextRequest) {
  return process.env.LOCALAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin
}

function connectBusinessUrl(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/connect-business", getAppBaseUrl(req))
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

export async function GET(req: NextRequest) {
  const endpoint = "/api/google-callback"
  const requestId = createRequestId()
  const { searchParams } = req.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const oauthError = searchParams.get("error")

  if (oauthError) {
    return NextResponse.redirect(connectBusinessUrl(req, { google: "error", reason: oauthError }))
  }

  if (!code || !state) {
    return NextResponse.redirect(connectBusinessUrl(req, { google: "error", reason: "missing_code_or_state" }))
  }

  try {
    const statePayload = verifyGoogleOAuthState(state)
    const userId = statePayload.uid
    logApiRequest({ requestId, endpoint, userId })

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = `${getAppBaseUrl(req)}/api/google-callback`

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth env vars are not configured")
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      const detail = typeof tokenData === "string" ? tokenData : JSON.stringify(tokenData)
      throw new Error(`Google token exchange failed: ${tokenRes.status} ${detail}`)
    }

    const expiresIn = Number(tokenData.expires_in || 3600)
    const expiresAtIso = new Date(Date.now() + expiresIn * 1000).toISOString()

    const supabase = createServiceClient()
    const { data: existingIntegration } = await supabase
      .from("integrations")
      .select("id, refresh_token")
      .eq("user_id", userId)
      .eq("provider", "google")
      .maybeSingle()

    const nextRefreshToken = tokenData.refresh_token || existingIntegration?.refresh_token || null

    if (existingIntegration?.id) {
      const { error: updateError } = await supabase
        .from("integrations")
        .update({
          access_token: tokenData.access_token,
          refresh_token: nextRefreshToken,
          expires_at: expiresAtIso,
        })
        .eq("id", existingIntegration.id)

      if (updateError) {
        throw updateError
      }
    } else {
      const { error: insertError } = await supabase
        .from("integrations")
        .insert({
          user_id: userId,
          provider: "google",
          access_token: tokenData.access_token,
          refresh_token: nextRefreshToken,
          expires_at: expiresAtIso,
        })

      if (insertError) {
        throw insertError
      }
    }

    return NextResponse.redirect(connectBusinessUrl(req, { google: "connected" }))

  } catch (err) {
    logApiError({
      requestId,
      endpoint,
      status: 500,
      message: "Failed to complete Google OAuth callback",
      error: err,
    })

    return NextResponse.redirect(connectBusinessUrl(req, { google: "error", reason: "callback_failed" }))

  }
}