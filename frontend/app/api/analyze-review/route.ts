import { NextResponse } from "next/server"
import OpenAI from "openai"
import { createServerClient } from "@/lib/supabaseServerClient"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { reviewId, reviewText, rating } = await req.json()

  const prompt = `
Analyze this Google review.

Return JSON with:
sentiment (positive/neutral/negative)
priority (low/medium/high)
topics (array)
summary (short sentence)
suggested_tone

Review:
"${reviewText}"

Rating: ${rating}
`

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  })

  const analysis = JSON.parse(
    completion.choices[0].message.content ?? "{}"
  )

  await supabase.from("review_analysis").insert({
    review_id: reviewId,
    sentiment: analysis.sentiment,
    priority: analysis.priority,
    topics: analysis.topics,
    summary: analysis.summary,
    suggested_tone: analysis.suggested_tone
  })

  return NextResponse.json(analysis)
}