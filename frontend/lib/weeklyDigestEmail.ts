import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

export interface WeeklyDigestBusiness {
  name: string
  needsReplyCount: number
}

export async function sendWeeklyDigestEmail({
  toEmail,
  userId,
  businesses,
}: {
  toEmail: string
  userId: string
  businesses: WeeklyDigestBusiness[]
}): Promise<{ sent: boolean; error?: string }> {
  if (!resend) {
    return { sent: false, error: "RESEND_API_KEY is not configured" }
  }

  const totalNeedsReply = businesses.reduce((sum, b) => sum + b.needsReplyCount, 0)

  if (totalNeedsReply === 0) {
    return { sent: false, error: "No reviews need replies — skipping digest" }
  }

  const fromEmail = process.env.REVIEW_ALERT_FROM_EMAIL || "Revidew <noreply@mail.revidew.com>"
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  const dashboardUrl = `${siteUrl}/dashboard`
  const unsubscribeUrl = `${siteUrl}/api/unsubscribe?uid=${encodeURIComponent(userId)}&type=weekly_digest`

  const businessRows = businesses
    .filter((b) => b.needsReplyCount > 0)
    .map(
      (b) => `
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${escapeHtml(b.name)}</td>
        <td style="padding: 8px 0; font-size: 14px; color: #0f172a; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 700;">
          ${b.needsReplyCount} review${b.needsReplyCount === 1 ? "" : "s"}
        </td>
      </tr>`
    )
    .join("")

  const subject =
    totalNeedsReply === 1
      ? `1 review is waiting for your reply`
      : `${totalNeedsReply} reviews are waiting for your reply`

  const result = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color: #0f172a; margin-bottom: 8px;">Your weekly review digest</h2>
        <p style="color: #475569; font-size: 14px; margin: 0 0 20px;">
          You have <strong>${totalNeedsReply} review${totalNeedsReply === 1 ? "" : "s"}</strong> waiting for a reply.
          Responding quickly builds trust and improves your rating.
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr>
              <th style="text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0;">Business</th>
              <th style="text-align: right; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0;">Needs reply</th>
            </tr>
          </thead>
          <tbody>${businessRows}</tbody>
        </table>

        ${siteUrl ? `<a href="${dashboardUrl}" style="display: inline-block; margin-bottom: 20px; padding: 10px 20px; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px;">Open Revidew dashboard</a>` : ""}

        <p style="color: #94a3b8; font-size: 12px; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          You're receiving this because you have a Revidew account.
          <a href="${unsubscribeUrl}" style="color: #94a3b8;">Unsubscribe from weekly digests</a>
        </p>
      </div>
    `,
  })

  if (result.error) {
    return { sent: false, error: result.error.message }
  }

  return { sent: true }
}
