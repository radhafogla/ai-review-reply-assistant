// app/api/google-locations/route.ts

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getValidAccessToken } from "@/lib/googleAuth"
import { createServerClient } from "@/lib/supabaseServerClient"
import { GoogleLocation } from "@/app/types/location"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

export async function GET(req: NextRequest) {
  const endpoint = "/api/google-locations"
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
  logApiRequest({ requestId, endpoint, userId: user.id })

  try {

    const accessToken = await getValidAccessToken(user.id, supabase)

    // Step 1: get accounts
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const accountsData = await accountsRes.json()

    const account = accountsData.accounts?.[0]

    if (!account) {
      return NextResponse.json({ locations: [] })
    }

    // Step 2: get locations
    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const locationsData = await locationsRes.json()

    const accountId = account.name.split("/").pop() || ""
    const locations: GoogleLocation[] = (locationsData.locations || []).map((loc: GoogleLocation) => ({
      locationId: loc.name.split("/").pop(),
      name: loc.title || loc.name,
      accountId,
      title: loc.title,
      address: loc.address,
    }))

    return NextResponse.json({ locations })

  } catch (err) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      status: 500,
      message: "Failed to fetch Google locations",
      error: err,
    })
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 })
  }
}