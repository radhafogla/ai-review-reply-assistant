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
