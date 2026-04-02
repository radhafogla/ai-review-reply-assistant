import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { Resend } from "resend"

type SignupPayload = {
  fullName?: string
  email?: string
  password?: string
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const endpoint = "/api/auth/signup"
  const requestId = createRequestId()

  let body: SignupPayload
  try {
    body = (await req.json()) as SignupPayload
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const fullName = body.fullName?.trim() || ""
  const email = body.email?.trim().toLowerCase() || ""
  const password = body.password || ""

  if (!fullName) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 })
  }

  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const supabase = createServiceClient()

  logApiRequest({ requestId, endpoint, email, message: "Password signup requested" })

  try {
    // Check if email already exists in public.users to prevent orphaned auth records
    const { data: existingByEmail, error: emailCheckError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (emailCheckError) {
      logApiError({
        requestId,
        endpoint,
        status: 500,
        message: "Failed checking email uniqueness",
        error: emailCheckError,
        email,
      })
      return NextResponse.json({ error: "Failed to validate email." }, { status: 500 })
    }

    if (existingByEmail) {
      return NextResponse.json(
        { error: "An account already exists for this email. Please sign in or use a different email." },
        { status: 409 },
      )
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

    const { data: linkData, error: createAuthError } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        data: {
          name: fullName,
          full_name: fullName,
        },
        redirectTo: `${siteUrl}/login?verified=true`,
      },
    })

    if (createAuthError) {
      const normalized = createAuthError.message.toLowerCase()
      if (normalized.includes("already") || normalized.includes("exists")) {
        return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 })
      }

      return NextResponse.json({ error: createAuthError.message }, { status: 400 })
    }

    const authUser = linkData.user
    if (!authUser) {
      return NextResponse.json({ error: "Failed to create account." }, { status: 500 })
    }

    const actionLink = linkData.properties?.action_link
    if (actionLink && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: "Revidew <noreply@mail.revidew.com>",
        to: email,
        subject: "Verify your email - Revidew",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
            <h2 style="color: #0f172a; margin-bottom: 8px;">Welcome to Revidew</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              Hi ${fullName}, thanks for signing up! Please confirm your email address to get started.
            </p>
            <div style="margin: 28px 0;">
              <a href="${actionLink}" style="display: inline-block; background: #0f172a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                Verify my email
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px;">If you didn't create this account, you can ignore this email.</p>
          </div>
        `,
      })
    }

    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const { error: upsertUserError } = await supabase.from("users").upsert(
      {
        id: authUser.id,
        email,
        name: fullName,
        plan: "free",
        trial_end: trialEnd,
      },
      { onConflict: "id" },
    )

    if (upsertUserError) {
      return NextResponse.json({ error: upsertUserError.message }, { status: 500 })
    }

    const { data: existingSubscription, error: subscriptionLookupError } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", authUser.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()

    if (subscriptionLookupError) {
      return NextResponse.json({ error: subscriptionLookupError.message }, { status: 500 })
    }

    if (!existingSubscription) {
      const { error: insertSubscriptionError } = await supabase.from("subscriptions").insert({
        user_id: authUser.id,
        plan: "free",
        status: "active",
      })

      if (insertSubscriptionError) {
        return NextResponse.json({ error: insertSubscriptionError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ requiresVerification: true })
  } catch (err) {
    logApiError({
      requestId,
      endpoint,
      status: 500,
      message: "Password signup failed",
      error: err,
      email,
    })

    return NextResponse.json({ error: "Failed to create account." }, { status: 500 })
  }
}
