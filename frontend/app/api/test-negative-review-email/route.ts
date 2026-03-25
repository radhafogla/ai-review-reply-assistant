import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { requireTrialOrPaidAccess } from "@/lib/subscriptionAccess"
import {
  sendNegativeReviewNotificationEmail,
  type NegativeReviewNotificationReview,
} from "@/lib/syncReviewsCore"

function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === "production"
  }

  return process.env.NODE_ENV === "production"
}

function getDefaultTestReviews(): NegativeReviewNotificationReview[] {
  return [
    {
      author_name: "Krishna Fogla",
      rating: 1,
      review_text:
        "Waited 35 minutes for a coffee. Staff looked completely overwhelmed.",
      review_time: new Date("2026-03-23T17:09:00.000Z").toISOString(),
    }
  ]
}

export async function POST(req: NextRequest) {
  const endpoint = "/api/test-negative-review-email"
  const requestId = createRequestId()

  if (isProductionRuntime()) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServerClient(token)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.email) {
    logApiError({
      requestId,
      endpoint,
      status: 401,
      message: "Unable to resolve authenticated user for test negative review email",
      error: userError?.message ?? "missing_user_email",
    })

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessCheck = await requireTrialOrPaidAccess(user.id, supabase)
  if (accessCheck.response) {
    return accessCheck.response
  }

  let body: {
    businessName?: string
    reviews?: NegativeReviewNotificationReview[]
  } = {}

  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const businessName = body.businessName?.trim() || "Revidew Test Business"
  const reviews = Array.isArray(body.reviews) && body.reviews.length > 0 ? body.reviews : getDefaultTestReviews()

  logApiRequest({
    requestId,
    endpoint,
    userId: user.id,
    email: user.email,
    businessName,
    reviewCount: reviews.length,
  })

  const result = await sendNegativeReviewNotificationEmail({
    toEmail: user.email,
    businessName,
    reviews,
  })

  if (!result.sent) {
    logApiError({
      requestId,
      endpoint,
      userId: user.id,
      status: 500,
      message: "Failed to send test negative review email",
      error: result.error ?? "unknown_error",
    })

    return NextResponse.json(
      { error: "Failed to send test email", detail: result.error ?? null },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, sentTo: user.email, businessName, reviewCount: reviews.length })
}