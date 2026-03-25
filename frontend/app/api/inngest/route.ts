import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { syncReviewsForBusiness, scheduledSyncAllBusinesses } from "@/inngest/functions/syncReviews"
import { purgeStaleReviews } from "@/inngest/functions/purgeStaleReviews"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncReviewsForBusiness, scheduledSyncAllBusinesses, purgeStaleReviews],
})
