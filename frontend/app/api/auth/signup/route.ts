import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

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

    const { data: created, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: fullName,
        full_name: fullName,
      },
    })

    if (createAuthError) {
      const normalized = createAuthError.message.toLowerCase()
      if (normalized.includes("already") || normalized.includes("exists")) {
        return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 })
      }

      return NextResponse.json({ error: createAuthError.message }, { status: 400 })
    }

    const authUser = created.user
    if (!authUser) {
      return NextResponse.json({ error: "Failed to create account." }, { status: 500 })
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

    return NextResponse.json({ success: true })
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
