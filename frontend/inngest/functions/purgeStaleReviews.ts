/* eslint-disable @typescript-eslint/no-explicit-any */
import { inngest } from "@/inngest/client"
import { createServiceClient } from "@/lib/supabaseServerClient"

/**
 * Google API ToS: cached review data must not be retained beyond 30 days
 * without a fresh confirmation from the API.
 *
 * This job runs daily and:
 *  1. Hard-deletes reviews that were soft-deleted more than 7 days ago
 *     (gives a grace window in case of transient sync failures).
 *  2. Hard-deletes reviews whose last_confirmed_at is older than 30 days
 *     (review was never re-confirmed during syncs — stale cache).
 *
 * Cascading foreign keys handle review_replies, review_analysis, etc.
 */
export const purgeStaleReviews = inngest.createFunction(
  {
    id: "purge-stale-reviews",
    retries: 2,
    cron: "0 3 * * *", // daily at 03:00 UTC
  } as any,
  async ({ step }: any) => {
    const serviceSupabase = createServiceClient()
    const now = new Date()

    // 1. Hard-delete soft-deleted reviews older than 7 days
    const softDeleteCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { count: purgedSoftDeleted } = await step.run(
      "purge-soft-deleted",
      async () => {
        const { count, error } = await serviceSupabase
          .from("reviews")
          .delete({ count: "exact" })
          .not("deleted_at", "is", null)
          .lt("deleted_at", softDeleteCutoff)

        if (error) {
          throw new Error(`Failed to purge soft-deleted reviews: ${error.message}`)
        }

        return { count: count ?? 0 }
      }
    )

    // 2. Hard-delete reviews not confirmed by Google API within 30 days
    const staleCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { count: purgedStale } = await step.run(
      "purge-stale-unconfirmed",
      async () => {
        const { count, error } = await serviceSupabase
          .from("reviews")
          .delete({ count: "exact" })
          .lt("last_confirmed_at", staleCutoff)

        if (error) {
          throw new Error(`Failed to purge stale reviews: ${error.message}`)
        }

        return { count: count ?? 0 }
      }
    )

    return {
      purgedSoftDeleted: purgedSoftDeleted ?? 0,
      purgedStale: purgedStale ?? 0,
    }
  }
)
