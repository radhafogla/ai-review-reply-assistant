import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"

export async function GET(req: NextRequest) {

  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace("Bearer ", "")

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const reviewId = searchParams.get("reviewId")

  const supabase = await createServerClient(token)

  const { data } = await supabase
    .from("review_replies")
    .select("*")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ reply: data })
}