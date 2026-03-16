import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"

export async function POST() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
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