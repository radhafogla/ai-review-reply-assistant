import { createClient } from "@supabase/supabase-js"

/**
 * Create a Supabase server client for route handlers.
 * Authenticates via Authorization header token (passed from client).
 */
export async function createServerClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  )
}

/**
 * Service-role client — bypasses RLS.
 * Use only for trusted server-side writes (e.g. updating reviews.latest_reply_id)
 * where the user token lacks an UPDATE policy on the target table.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
