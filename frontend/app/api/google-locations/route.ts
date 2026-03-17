// app/api/google-locations/route.ts

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getValidAccessToken } from "@/lib/googleAuth"
import { createServerClient } from "@/lib/supabaseServerClient"
import { Location } from "@/app/types/location"

export async function GET(req: NextRequest) {
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
    const locations: Location[] = (locationsData.locations || []).map((loc: Location) => ({
      locationId: loc.name.split("/").pop(),
      name: loc.title || loc.name,
      accountId,
      title: loc.title,
      address: loc.address,
    }))

    return NextResponse.json({ locations })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 })
  }
}