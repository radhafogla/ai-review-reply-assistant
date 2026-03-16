import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"

export async function GET(req: Request) {

  const { searchParams } = new URL(req.url)
  const reviewId = searchParams.get("reviewId")

  const supabase = await createServerClient()

  const { data } = await supabase
    .from("review_replies")
    .select("*")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ reply: data })
}