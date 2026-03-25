/* eslint-disable @typescript-eslint/no-explicit-any */
import { NonRetriableError } from "inngest"
import { inngest } from "@/inngest/client"
import { createServiceClient } from "@/lib/supabaseServerClient"
import { performBusinessSync } from "@/lib/syncReviewsCore"

const SYNC_REVIEWS_CRON = process.env.INNGEST_SYNC_REVIEWS_CRON || "0 */6 * * *"

/**
 * Syncs reviews for a single business in response to a "reviews/sync.requested" event.
 * Triggered after business connect and by the scheduled cron fan-out.
 * Retries up to 3 times on any transient failure; marks sync_status on the business.
 */
export const syncReviewsForBusiness = inngest.createFunction(
  {
    id: "sync-reviews-for-business",
    retries: 3,
    event: "reviews/sync.requested",
  } as any,
  async ({ event, step }: any) => {
    const { businessId, userId } = event.data

    if (!businessId || !userId) {
      throw new NonRetriableError("Missing businessId or userId in event data")
    }

    return await (step as any).run("perform-sync", async () =>
      performBusinessSync(businessId, userId)
    )
  }
)

/**
 * Scheduled job that fans out a "reviews/sync.requested" event for every connected
 * Google Business location. Defaults to every 6 hours.
 */
export const scheduledSyncAllBusinesses = inngest.createFunction(
  {
    id: "scheduled-sync-all-businesses",
    retries: 1,
    cron: SYNC_REVIEWS_CRON,
  } as any,
  async ({ step }: any) => {
    // Collect all (businessId, userId) pairs for active Google locations
    const pairs = await step.run("list-google-businesses", async () => {
      const serviceSupabase = createServiceClient()

      const { data: businesses, error: bizError } = await serviceSupabase
        .from("businesses")
        .select("id")
        .eq("platform", "google")

      if (bizError) {
        throw new Error(`Failed to list Google businesses: ${bizError.message}`)
      }

      const businessIds = (businesses ?? []).map((b: { id: string }) => b.id)

      if (businessIds.length === 0) {
        return []
      }

      const { data: memberships, error: memberError } = await serviceSupabase
        .from("business_members")
        .select("business_id, user_id")
        .in("business_id", businessIds)
        .eq("role", "owner")
        .eq("status", "active")

      if (memberError) {
        throw new Error(`Failed to list business memberships: ${memberError.message}`)
      }

      return (memberships ?? []).map((m: { business_id: string; user_id: string }) => ({
        businessId: m.business_id,
        userId: m.user_id,
      }))
    })

    if (pairs.length === 0) {
      return { queued: 0 }
    }

    // Fan out: one sync event per business so each gets independent retry tracking
    await step.sendEvent(
      "fan-out-sync-events",
      pairs.map((p: { businessId: string; userId: string }) => ({
        name: "reviews/sync.requested" as const,
        data: { businessId: p.businessId, userId: p.userId },
      }))
    )

    return { queued: pairs.length }
  }
)
