// app/api/google-callback/route.ts

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getValidAccessToken } from "@/lib/googleAuth"
import { createServerClient } from "@/lib/supabaseServerClient"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace("Bearer ", "")

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  try {

    const accessToken =
      await getValidAccessToken(user.id, supabase)

    // 1️⃣ Get all accounts
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    )

    const accountsData = await accountsRes.json()

    const locations: {
      accountId: string
      locationId: string
      name: string
    }[] = []

    // 2️⃣ Loop through every account
    for (const account of accountsData.accounts || []) {

      const accountId =
        account.name.split("/")[1]

      const locationsRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      const locationsData =
        await locationsRes.json()

      for (const loc of locationsData.locations || []) {

        locations.push({
          accountId,
          locationId: loc.name.split("/").pop(),
          name: loc.title || "Unnamed location"
        })

      }
    }

    return NextResponse.json({ locations })

  } catch (err) {

    console.error(err)

    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    )

  }
}