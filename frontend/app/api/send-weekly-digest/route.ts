import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { sendWeeklyDigestEmail, type WeeklyDigestBusiness } from "@/lib/weeklyDigestEmail"
import { trackUsageEvent } from "@/lib/usageTracking"

function isAuthorized(req: NextRequest): boolean {
  if (!process.env.CRON_SECRET) return false
  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization") ?? ""
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  // Manual invocation via x-cron-secret header
  return (req.headers.get("x-cron-secret") ?? "") === process.env.CRON_SECRET
}

async function runDigest(req: NextRequest): Promise<NextResponse> {
  const endpoint = "/api/send-weekly-digest"
  const requestId = createRequestId()

  if (!isAuthorized(req)) {
    logApiError({ requestId, endpoint, status: 401, message: "Invalid or missing cron secret", error: "unauthorized" })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  logApiRequest({ requestId, endpoint, message: "Weekly digest cron started" })

  const supabase = createServiceClient()

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email")
    .eq("email_weekly_digest", true)

  if (usersError) {
    logApiError({ requestId, endpoint, status: 500, message: "Failed to fetch users", error: usersError.message })
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const user of users ?? []) {
    if (!user.email) {
      skipped++
      continue
    }

    const { data: businesses, error: bizError } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("user_id", user.id)

    if (bizError || !businesses?.length) {
      skipped++
      continue
    }

    const digestBusinesses: WeeklyDigestBusiness[] = []

    for (const biz of businesses) {
      // Step 1: get review IDs for this business that already have a posted or dismissed reply
      const { data: bizReviews } = await supabase
        .from("reviews")
        .select("id")
        .eq("business_id", biz.id)

      const bizReviewIds = bizReviews?.map((r) => r.id) ?? []

      let handledReviewIds: string[] = []
      if (bizReviewIds.length > 0) {
        const { data: handledReplies } = await supabase
          .from("review_replies")
          .select("review_id")
          .in("status", ["posted", "dismissed"])
          .in("review_id", bizReviewIds)

        handledReviewIds = handledReplies?.map((r) => r.review_id) ?? []
      }

      // Step 2: count actionable reviews that haven't been handled yet
      let countQuery = supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("business_id", biz.id)
        .eq("needs_ai_reply", true)
        .eq("is_actionable", true)
        .is("deleted_at", null)

      if (handledReviewIds.length > 0) {
        countQuery = countQuery.not("id", "in", `(${handledReviewIds.join(",")})`)
      }

      const { count, error: countError } = await countQuery

      if (countError) continue

      if ((count ?? 0) > 0) {
        digestBusinesses.push({ name: biz.name ?? "Your business", needsReplyCount: count ?? 0 })
      }
    }

    if (digestBusinesses.length === 0) {
      skipped++
      continue
    }

    const result = await sendWeeklyDigestEmail({
      toEmail: user.email,
      userId: user.id,
      businesses: digestBusinesses,
    })

    if (result.sent) {
      sent++
      await trackUsageEvent({
        requestId,
        endpoint,
        eventType: "weekly_digest_sent",
        userId: user.id,
        metadata: {
          businessCount: digestBusinesses.length,
          totalNeedsReply: digestBusinesses.reduce((s, b) => s + b.needsReplyCount, 0),
        },
      })
    } else {
      failed++
      logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to send weekly digest", error: result.error })
    }
  }

  return NextResponse.json({ success: true, sent, skipped, failed })
}

// Vercel Cron invokes via GET
export async function GET(req: NextRequest) {
  return runDigest(req)
}

// Manual invocation via POST (e.g. curl for testing)
export async function POST(req: NextRequest) {
  return runDigest(req)
}
