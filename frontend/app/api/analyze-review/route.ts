import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import OpenAI from "openai"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { requireTrialOrPaidAccess } from "@/lib/subscriptionAccess"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: NextRequest) {
  const endpoint = "/api/analyze-review"
  const requestId = createRequestId()
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace("Bearer ", "")

  if (!token) {
    logApiError({ requestId, endpoint, status: 401, message: "Missing bearer token", error: "missing_token" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)

  if (!user) {
    logApiError({ requestId, endpoint, status: 401, message: "No user in session", error: "no_user" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessCheck = await requireTrialOrPaidAccess(user.id, supabase)
  if (accessCheck.response) {
    return accessCheck.response
  }

  const { reviewId, reviewText, rating } = await req.json()
  logApiRequest({ requestId, endpoint, userId: user.id, reviewId })

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

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })

    const analysis = JSON.parse(
      completion.choices[0].message.content ?? "{}"
    )

    const { error: insertError } = await supabase.from("review_analysis").insert({
      review_id: reviewId,
      sentiment: analysis.sentiment,
      priority: analysis.priority,
      topics: analysis.topics,
      summary: analysis.summary,
      suggested_tone: analysis.suggested_tone
    })

    if (insertError) {
      logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to save analysis", error: insertError, reviewId })
    }

    return NextResponse.json(analysis)
  } catch (err) {
    logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Analysis generation failed", error: err, reviewId })
    return NextResponse.json({ error: "Failed to analyze review" }, { status: 500 })
  }
}