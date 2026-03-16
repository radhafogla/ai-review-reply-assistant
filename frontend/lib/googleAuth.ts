import { SupabaseClient } from "@supabase/supabase-js"

export async function getValidAccessToken(userId: string, supabase: SupabaseClient) {

  const { data } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (!data) throw new Error("No Google token found")

  const now = Math.floor(Date.now() / 1000)

  if (data.expires_at > now) {
    return data.access_token
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

  const newAccessToken = refreshed.access_token
  const expiresIn = refreshed.expires_in

  await supabase
    .from("business_tokens")
    .update({
      access_token: newAccessToken,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    })
    .eq("user_id", userId)

  return newAccessToken
}