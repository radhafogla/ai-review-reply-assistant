import { SupabaseClient } from "@supabase/supabase-js"

export async function getValidAccessToken(userId: string, supabase: SupabaseClient) {

  const { data } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .single()

  if (!data) throw new Error("No Google token found")

  const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : 0
  if (expiresAtMs > Date.now() + 60_000 && data.access_token) {
    return data.access_token
  }

  if (!data.refresh_token) {
    throw new Error("Google refresh token missing. Reconnect Google Business.")
  }

  // refresh token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  })

  const refreshed = await res.json()

  if (!res.ok || !refreshed.access_token) {
    throw new Error("Failed to refresh Google access token")
  }

  const newAccessToken = refreshed.access_token
  const expiresIn = Number(refreshed.expires_in || 3600)
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  const newRefreshToken = refreshed.refresh_token || data.refresh_token

  await supabase
    .from("integrations")
    .update({
      access_token: newAccessToken,
      expires_at: newExpiresAt,
      refresh_token: newRefreshToken,
    })
    .eq("id", data.id)

  return newAccessToken
}