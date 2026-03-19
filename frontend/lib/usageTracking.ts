import { createClient } from "@supabase/supabase-js"
import { logApiRequest } from "@/lib/apiLogger"

export type UsageEventType =
  | "auto_reply_attempted"
  | "auto_reply_failed"
  | "auto_reply_posted"
  | "business_connected"
  | "limit_warning_shown"
  | "negative_review_notification_failed"
  | "negative_review_notification_sent"
  | "reply_deleted"
  | "reply_generated"
  | "reply_posted"
  | "reply_saved"
  | "reviews_synced"
  | "subscription_changed"

type UsageMetadata = Record<string, unknown>

type TrackUsageEventInput = {
  requestId: string
  endpoint: string
  eventType: UsageEventType
  userId?: string | null
  businessId?: string | null
  reviewId?: string | null
  metadata?: UsageMetadata
}

type UsageEventInsert = {
  user_id: string | null
  event_type: UsageEventType
  endpoint: string
  business_id: string | null
  review_id: string | null
  metadata: UsageMetadata
}

let usageClient:
  | ReturnType<typeof createClient>
  | null = null
let usageTrackingDisabledReason: string | null = null

function getUsageClient() {
  if (usageClient) {
    return usageClient
  }

  usageClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  return usageClient
}

export async function trackUsageEvent({
  requestId,
  endpoint,
  eventType,
  userId,
  businessId,
  reviewId,
  metadata = {},
}: TrackUsageEventInput) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return
  }

  if (usageTrackingDisabledReason) {
    logApiRequest({
      requestId,
      endpoint,
      userId,
      message: `Skipping usage event ${eventType}; tracking disabled`,
      usageEventType: eventType,
      usageTrackingDisabledReason,
      nonBlocking: true,
    })
    return
  }

  try {
    const supabase = getUsageClient()
    const row: UsageEventInsert = {
      user_id: userId ?? null,
      event_type: eventType,
      endpoint,
      business_id: businessId ?? null,
      review_id: reviewId ?? null,
      metadata,
    }
    const { error } = await supabase.from("usage_events" as never).insert(row as never)

    if (error) {
      const normalizedError = typeof error.message === "string" ? error.message : JSON.stringify(error)
      if (normalizedError.toLowerCase().includes("invalid api key")) {
        usageTrackingDisabledReason = "invalid_service_role_key"
      }

      logApiRequest({
        requestId,
        endpoint,
        userId,
        message: `Non-blocking usage tracking failed for ${eventType}`,
        usageEventType: eventType,
        usageTrackingError: normalizedError,
        nonBlocking: true,
      })
    }
  } catch (error) {
    const normalizedError =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error)

    if (normalizedError.toLowerCase().includes("invalid api key")) {
      usageTrackingDisabledReason = "invalid_service_role_key"
    }

    logApiRequest({
      requestId,
      endpoint,
      userId,
      message: `Non-blocking usage tracking threw while persisting ${eventType}`,
      usageEventType: eventType,
      usageTrackingError: normalizedError,
      nonBlocking: true,
    })
  }
}
