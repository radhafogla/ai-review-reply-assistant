import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

interface Business {
  id: string
}

interface Review {
  id: string
}

export async function POST(req: NextRequest) {
  const endpoint = "/api/delete-data"
  const requestId = createRequestId()
  try {
    const authHeader = req.headers.get("Authorization") || ""
    const token = authHeader.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createServerClient(token)
    const {
      data: { user }
    } = await supabase.auth.getUser(token)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id
  logApiRequest({ requestId, endpoint, userId })

    // Get all businesses for this user
    const { data: businesses, error: businessesError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", userId)

    if (businessesError) {
      throw businessesError
    }

    const businessIds = (businesses || []).map((b: Business) => b.id)

    if (businessIds.length > 0) {
      // Get all reviews for these businesses
      const { data: reviews, error: reviewsError } = await supabase
        .from("reviews")
        .select("id")
        .in("business_id", businessIds)

      if (reviewsError) {
        throw reviewsError
      }

      const reviewIds = (reviews || []).map((r: Review) => r.id)

      // Delete in reverse order of foreign key dependencies
      if (reviewIds.length > 0) {
        // Delete review replies (latest_reply_id FK is ON DELETE SET NULL)
        const { error: deleteRepliesError } = await supabase
          .from("review_replies")
          .delete()
          .in("review_id", reviewIds)

        if (deleteRepliesError) {
          throw deleteRepliesError
        }

        // Delete review analysis
        const { error: deleteAnalysisError } = await supabase
          .from("review_analysis")
          .delete()
          .in("review_id", reviewIds)

        if (deleteAnalysisError) {
          throw deleteAnalysisError
        }
      }

      // Delete reviews
      const { error: deleteReviewsError } = await supabase
        .from("reviews")
        .delete()
        .in("business_id", businessIds)

      if (deleteReviewsError) {
        throw deleteReviewsError
      }

      // Delete sentiment cache
      const { error: deleteSentimentError } = await supabase
        .from("sentiment_cache")
        .delete()
        .in("business_id", businessIds)

      if (deleteSentimentError) {
        throw deleteSentimentError
      }

      // Delete usage events linked to businesses
      const { error: deleteUsageEventsError } = await supabase
        .from("usage_events")
        .delete()
        .in("business_id", businessIds)

      if (deleteUsageEventsError) {
        throw deleteUsageEventsError
      }
    }

    // Delete remaining usage events linked to user
    const { error: deleteUserUsageError } = await supabase
      .from("usage_events")
      .delete()
      .eq("user_id", userId)

    if (deleteUserUsageError) {
      throw deleteUserUsageError
    }

    // Delete subscriptions
    const { error: deleteSubsError } = await supabase
      .from("subscriptions")
      .delete()
      .eq("user_id", userId)

    if (deleteSubsError) {
      throw deleteSubsError
    }

    // Delete businesses (cascades business_members)
    const { error: deleteBusinessesError } = await supabase
      .from("businesses")
      .delete()
      .eq("user_id", userId)

    if (deleteBusinessesError) {
      throw deleteBusinessesError
    }

    // Delete integrations
    const { error: deleteIntegrationsError } = await supabase
      .from("integrations")
      .delete()
      .eq("user_id", userId)

    if (deleteIntegrationsError) {
      throw deleteIntegrationsError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logApiError({
      requestId,
      endpoint,
      status: 500,
      message: "Delete data failed",
      error,
    })
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
