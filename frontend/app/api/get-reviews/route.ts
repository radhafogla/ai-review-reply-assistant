import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace("Bearer ", "")

  if (!token) {
    console.error("get-reviews: no token in Authorization header")
    return NextResponse.json(
      { error: "Unauthorized", reviews: null },
      { status: 401 }
    )
  }

  // Create client with user's token
  const supabase = await createServerClient(token)

  // Get user info from token
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json(
      { error: "Unauthorized", reviews: null },
      { status: 401 }
    )
  }
  
  const userId = user.id

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .single()

  if (!business) {
    return NextResponse.json({ reviews: null })
  }

  const { data: reviews } = await supabase
  .from("reviews")
  .select(`
    id,
    author_name,
    rating,
    review_text,
    review_time,
    review_analysis (*),
    latest_reply:review_replies (
      id,
      reply_text,
      status,
      source,
      created_at
    )
  `)
  .eq("business_id", business.id)
  .order("review_time", { ascending: false })

  return NextResponse.json({ reviews })
}