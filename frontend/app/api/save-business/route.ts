import { createServerClient } from "@/lib/supabaseServerClient"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {

  try {
    const authHeader = req.headers.get("Authorization") || ""
    const token = authHeader.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createServerClient(token)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    const { account_id, location_id, name } = body

    if (!account_id || !location_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("businesses")
      .upsert(
        {
          user_id: user.id,
          account_id,
          location_id,
          name
        },
        {
          onConflict: "user_id,location_id"
        }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      business: data
    })

  } catch (err) {

    console.error(err)

    return NextResponse.json(
      { error: "Failed to save business" },
      { status: 500 }
    )

  }
}