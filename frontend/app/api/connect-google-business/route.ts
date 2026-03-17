// app/api/connect-google-business/route.ts

import { NextResponse } from "next/server"
import { createRequestId, logApiRequest } from "@/lib/apiLogger"

export async function GET(req: Request) {
  const requestId = createRequestId()
  const endpoint = "/api/connect-google-business"
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  logApiRequest({ requestId, endpoint, userId })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = `${process.env.LOCALAUTH_URL}/api/google-callback`

  const scope = [
    "https://www.googleapis.com/auth/business.manage",
  ].join(" ")

  const url =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&access_type=offline` +
    `&state=${userId}`

  return NextResponse.redirect(url)
}