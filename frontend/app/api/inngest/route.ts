import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { syncReviewsForBusiness, scheduledSyncAllBusinesses } from "@/inngest/functions/syncReviews"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncReviewsForBusiness, scheduledSyncAllBusinesses],
})
