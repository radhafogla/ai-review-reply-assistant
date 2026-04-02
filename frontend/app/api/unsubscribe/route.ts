import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

const VALID_TYPES = ["negative_alerts", "weekly_digest"] as const
type UnsubscribeType = (typeof VALID_TYPES)[number]

const COLUMN_MAP: Record<UnsubscribeType, string> = {
  negative_alerts: "email_negative_review_alerts",
  weekly_digest:   "email_weekly_digest",
}

const LABEL_MAP: Record<UnsubscribeType, string> = {
  negative_alerts: "negative review alert emails",
  weekly_digest:   "weekly digest emails",
}

function htmlPage(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} – Revidew</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 40px 48px; max-width: 480px; text-align: center; }
    h1 { font-size: 22px; color: #0f172a; margin: 0 0 12px; }
    p  { font-size: 15px; color: #475569; margin: 0 0 20px; line-height: 1.6; }
    a  { color: #2563eb; font-weight: 600; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    ${body}
  </div>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}

export async function GET(req: NextRequest) {
  const endpoint = "/api/unsubscribe"
  const requestId = createRequestId()

  const { searchParams } = new URL(req.url)
  const uid  = searchParams.get("uid")?.trim() ?? ""
  const type = searchParams.get("type")?.trim() ?? ""

  logApiRequest({ requestId, endpoint, message: "Unsubscribe link clicked", uid: uid.slice(0, 8), type })

  if (!uid || !VALID_TYPES.includes(type as UnsubscribeType)) {
    return htmlPage(
      "Invalid unsubscribe link",
      `<p>This unsubscribe link is invalid or has already been used. Visit your <a href="/settings">account settings</a> to manage email preferences.</p>`
    )
  }

  const column = COLUMN_MAP[type as UnsubscribeType]
  const label  = LABEL_MAP[type as UnsubscribeType]
  const supabase = createServiceClient()

  // Verify the user exists before updating
  const { data: userRow, error: lookupError } = await supabase
    .from("users")
    .select("id")
    .eq("id", uid)
    .maybeSingle()

  if (lookupError || !userRow) {
    logApiError({ requestId, endpoint, status: 404, message: "User not found for unsubscribe", error: lookupError?.message ?? "not_found", uid: uid.slice(0, 8) })
    return htmlPage(
      "Invalid unsubscribe link",
      `<p>We couldn't find an account matching this link. Visit your <a href="/settings">account settings</a> to manage email preferences.</p>`
    )
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ [column]: false, updated_at: new Date().toISOString() })
    .eq("id", uid)

  if (updateError) {
    logApiError({ requestId, endpoint, status: 500, message: "Failed to apply unsubscribe", error: updateError.message, uid: uid.slice(0, 8) })
    return htmlPage(
      "Something went wrong",
      `<p>We couldn't process your unsubscribe request. Please try again or visit <a href="/settings">account settings</a> to manage preferences manually.</p>`
    )
  }

  return htmlPage(
    "You've been unsubscribed",
    `<p>You will no longer receive ${label} from Revidew.</p>
     <p>You can re-enable this at any time in your <a href="/settings">account settings</a>.</p>`
  )
}
