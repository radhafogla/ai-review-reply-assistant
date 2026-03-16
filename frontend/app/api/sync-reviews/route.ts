import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { getValidAccessToken } from "@/lib/googleAuth"
import { GoogleReview, GoogleReviewListResponse } from "@/app/types/googleReview"

interface StoredReview {
  review_id: string
  author_name: string | null
  rating: number | null
  review_text: string | null
  review_time: string | null
}

interface FormattedReview {
  business_id: string
  review_id: string
  author_name: string
  rating: number
  review_text: string
  review_time: string
  synced_at: string
}

const STAR_RATING_TO_NUMBER: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5
}

function normalizeStarRating(starRating: GoogleReview["starRating"]): number {
  if (typeof starRating === "number") {
    return starRating
  }

  const numericValue = Number(starRating)

  if (!Number.isNaN(numericValue)) {
    return numericValue
  }

  return STAR_RATING_TO_NUMBER[String(starRating).toUpperCase()] ?? 0
}

function toTimestamp(value?: string | null): number {
  if (!value) {
    return 0
  }

  const timestamp = Date.parse(value)

  return Number.isNaN(timestamp) ? 0 : timestamp
}

function normalizeReview(
  review: GoogleReview,
  businessId: string,
  syncedAt: string
): FormattedReview {
  return {
    business_id: businessId,
    review_id: review.reviewId,
    author_name: review.reviewer?.displayName ?? "Anonymous",
    rating: normalizeStarRating(review.starRating),
    review_text: review.comment ?? "",
    review_time: review.updateTime ?? review.createTime,
    synced_at: syncedAt
  }
}

function shouldUpsert(
  existingReview: StoredReview | undefined,
  nextReview: FormattedReview
): boolean {
  if (!existingReview) {
    return true
  }

  return (
    existingReview.author_name !== nextReview.author_name ||
    existingReview.rating !== nextReview.rating ||
    existingReview.review_text !== nextReview.review_text ||
    existingReview.review_time !== nextReview.review_time
  )
}

async function fetchGoogleReviews(
  accessToken: string,
  accountId: string,
  locationId: string,
  latestKnownTimestamp: number,
  existingByReviewId: Map<string, StoredReview>
): Promise<GoogleReview[]> {
  const collectedReviews: GoogleReview[] = []
  let nextPageToken: string | undefined
  let canStopEarly = false

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`
    )

    url.searchParams.set("pageSize", "100")

    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken)
    }

    const googleRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    if (!googleRes.ok) {
      const errorBody = await googleRes.text()
      throw new Error(`Google reviews fetch failed: ${googleRes.status} ${errorBody}`)
    }

    const googleData: GoogleReviewListResponse = await googleRes.json()
    const pageReviews = googleData.reviews ?? []

    collectedReviews.push(...pageReviews)
    nextPageToken = googleData.nextPageToken

    if (latestKnownTimestamp > 0 && pageReviews.length > 0) {
      canStopEarly = pageReviews.every((review) => {
        const existingReview = existingByReviewId.get(review.reviewId)

        if (!existingReview) {
          return false
        }

        return toTimestamp(review.updateTime ?? review.createTime) <= latestKnownTimestamp
      })
    }
  } while (nextPageToken && !canStopEarly)

  return collectedReviews
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace("Bearer ", "")

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerClient(token)

  const { data: { user } } = await supabase.auth.getUser(token)

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const userId = user.id

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, account_id, location_id")
    .eq("user_id", userId)
    .single()

  if (businessError || !business) {
    return NextResponse.json(
      { error: "No business connected" },
      { status: 400 }
    )
  }

  const { data: existingReviews, error: existingReviewsError } = await supabase
    .from("reviews")
    .select("review_id, author_name, rating, review_text, review_time")
    .eq("business_id", business.id)

  if (existingReviewsError) {
    console.error(existingReviewsError)

    return NextResponse.json(
      { error: "Failed to load existing reviews" },
      { status: 500 }
    )
  }

  const existingByReviewId = new Map<string, StoredReview>(
    (existingReviews ?? []).map((review) => [review.review_id, review])
  )

  const latestKnownTimestamp = Math.max(
    0,
    ...(existingReviews ?? []).map((review) => toTimestamp(review.review_time))
  )

  try {
    const accessToken = await getValidAccessToken(userId, supabase)
    const googleReviews = await fetchGoogleReviews(
      accessToken,
      business.account_id ?? "-",
      business.location_id,
      latestKnownTimestamp,
      existingByReviewId
    )

    const dedupedReviews = Array.from(
      new Map(googleReviews.map((review) => [review.reviewId, review])).values()
    )

    const syncedAt = new Date().toISOString()
    const formattedReviews = dedupedReviews.map((review) =>
      normalizeReview(review, business.id, syncedAt)
    )

    const reviewsToUpsert = formattedReviews.filter((review) =>
      shouldUpsert(existingByReviewId.get(review.review_id), review)
    )

    if (reviewsToUpsert.length > 0) {
      const { error: insertError } = await supabase
        .from("reviews")
        .upsert(reviewsToUpsert, {
          onConflict: "review_id"
        })

      if (insertError) {
        console.error(insertError)

        return NextResponse.json(
          { error: "Failed to save reviews" },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      fetchedCount: dedupedReviews.length,
      upsertedCount: reviewsToUpsert.length,
      skippedCount: formattedReviews.length - reviewsToUpsert.length,
      syncMode: latestKnownTimestamp > 0 ? "incremental" : "initial"
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Failed to sync Google reviews" },
      { status: 500 }
    )
  }
}