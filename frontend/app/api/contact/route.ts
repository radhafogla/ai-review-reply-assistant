import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const endpoint = "/api/contact"
  const requestId = createRequestId()
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const { name, email, subject, message } = body as Record<string, string>
  logApiRequest({ requestId, endpoint, message: "Contact form submitted", email, subject })

  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 })
  }

  if (message.trim().length < 10) {
    return NextResponse.json({ error: "Message must be at least 10 characters." }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error: dbError } = await supabase.from("contact_submissions").insert([
    {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    },
  ])

  if (dbError) {
    logApiError({
      requestId,
      endpoint,
      status: 500,
      message: "Failed storing contact submission",
      error: dbError,
      email,
      subject,
    })
    return NextResponse.json(
      { error: "Failed to submit. Please email us directly at support@reviewai.com" },
      { status: 500 }
    )
  }

  // Send admin notification email
  const adminEmailResult = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "radha_aeie2000@yahoo.com",
    subject: `Review AI Contact Form: ${subject.trim()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0f172a;">New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin-top: 16px;">
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap; color: #475569;">${escapeHtml(message)}</p>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Submitted at ${new Date().toLocaleString()}</p>
      </div>
    `,
  })

  if (adminEmailResult.error) {
    logApiError({
      requestId,
      endpoint,
      status: 500,
      message: "Failed sending admin notification email",
      error: adminEmailResult.error,
      email,
      subject,
    })
  }

  // Send confirmation email to user
  // const confirmationEmailResult = await resend.emails.send({
  //   from: "onboarding@resend.dev",
  //   to: email.trim(),
  //   subject: "We received your message - ReviewAI",
  //   html: `
  //     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  //       <h2 style="color: #0f172a;">Thanks for reaching out!</h2>
  //       <p>Hi ${escapeHtml(name)},</p>
  //       <p>We received your message and will get back to you as soon as possible. Our team typically responds within 1 business day.</p>
  //       <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 24px 0;">
  //         <p><strong>Your message:</strong></p>
  //         <p style="white-space: pre-wrap; color: #475569;">${escapeHtml(message)}</p>
  //       </div>
  //       <p style="color: #94a3b8;">If you need immediate assistance, please reply to this email or visit our <a href="https://reviewai.com" style="color: #2563eb;">website</a>.</p>
  //       <p style="margin-top: 24px; color: #64748b;">Best regards,<br/>ReviewAI Support Team</p>
  //     </div>
  //   `,
  // })

  return NextResponse.json({ success: true })
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return text.replace(/[&<>"']/g, (char) => map[char] || char)
}
