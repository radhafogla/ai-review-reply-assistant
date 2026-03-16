import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization") || ""
    const token = authHeader.replace("Bearer ", "")

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

    const email = user.email
    const name = user.user_metadata?.full_name || user.user_metadata?.name || null

    if (!email) {
      return NextResponse.json({ error: "User email missing" }, { status: 400 })
    }

    const { data: existingUser, error: lookupError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 })
    }

    if (existingUser) {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          name,
          google_id: user.id,
        })
        .eq("id", existingUser.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, action: "updated" })
    }

    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase
      .from("users")
      .insert({
        id: user.id,
        email,
        name,
        google_id: user.id,
        trial_end: trialEnd,
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, action: "inserted" })
  } catch (err) {
    console.error("ensure-user error", err)
    return NextResponse.json({ error: "Failed to ensure user" }, { status: 500 })
  }
}
