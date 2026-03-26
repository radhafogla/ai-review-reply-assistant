import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

export async function GET(req: NextRequest) {
  const endpoint = "/api/export-data"
  const requestId = createRequestId()

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

    const userId = user.id
    logApiRequest({ requestId, endpoint, userId })

    // Fetch businesses
    const { data: businesses, error: businessesError } = await supabase
      .from("businesses")
      .select("id, name, external_business_id, platform, account_id, connected_at")
      .eq("user_id", userId)

    if (businessesError) throw businessesError

    const businessIds = (businesses || []).map((b) => b.id)

    // Fetch reviews for user's businesses
    let reviews: Record<string, unknown>[] = []
    if (businessIds.length > 0) {
      const { data: reviewData, error: reviewsError } = await supabase
        .from("reviews")
        .select("id, business_id, external_review_id, reviewer_name, star_rating, review_text, review_date, created_at")
        .in("business_id", businessIds)
        .is("deleted_at", null)

      if (reviewsError) throw reviewsError
      reviews = reviewData || []
    }

    const reviewIds = reviews.map((r) => r.id as string)

    // Fetch replies
    let replies: Record<string, unknown>[] = []
    if (reviewIds.length > 0) {
      const { data: replyData, error: repliesError } = await supabase
        .from("review_replies")
        .select("id, review_id, reply_text, tone, status, posted_at, created_at")
        .in("review_id", reviewIds)

      if (repliesError) throw repliesError
      replies = replyData || []
    }

    // Fetch analysis
    let analysis: Record<string, unknown>[] = []
    if (reviewIds.length > 0) {
      const { data: analysisData, error: analysisError } = await supabase
        .from("review_analysis")
        .select("id, review_id, sentiment, keywords, summary, created_at")
        .in("review_id", reviewIds)

      if (analysisError) throw analysisError
      analysis = analysisData || []
    }

    // Fetch integrations
    const { data: integrations, error: integrationsError } = await supabase
      .from("integrations")
      .select("id, provider, created_at")
      .eq("user_id", userId)

    if (integrationsError) throw integrationsError

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      businesses: businesses || [],
      reviews,
      replies,
      analysis,
      integrations: integrations || [],
    }

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="revidew-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (error) {
    logApiError({
      requestId,
      endpoint,
      status: 500,
      message: "Data export failed",
      error,
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
