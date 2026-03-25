import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabaseServerClient"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"

export async function POST(req: NextRequest) {
  const endpoint = "/api/ensure-user"
  const requestId = createRequestId()
  try {
    const authHeader = req.headers.get("Authorization") || ""
    const token = authHeader.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createServerClient(token)
    const {
      data: { user },
    } = await supabase.auth.getUser(token)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const email = user.email
    const name = user.user_metadata?.full_name || user.user_metadata?.name || null
  logApiRequest({ requestId, endpoint, userId: user.id, email })

    if (!email) {
      return NextResponse.json({ error: "User email missing" }, { status: 400 })
    }

    const { data: existingUser, error: lookupError } = await supabase
      .from("users")
      .select("id, plan, trial_end")
      .eq("id", user.id)
      .maybeSingle()

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 })
    }

    if (existingUser) {
      const nextPlan = existingUser.plan || "free"
      const shouldSetTrialEnd = nextPlan === "free" && !existingUser.trial_end
      const computedTrialEnd = shouldSetTrialEnd
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        : existingUser.trial_end

      const { error: updateError } = await supabase
        .from("users")
        .update({
          name,
          email,
          trial_end: computedTrialEnd,
        })
        .eq("id", existingUser.id)

      if (updateError) {
        logApiError({
          requestId,
          endpoint,
          status: 500,
          message: "Failed updating existing user",
          error: updateError,
          userId: user.id,
          email,
        })
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      const { data: activeSubscription, error: subscriptionLookupError } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()

      if (subscriptionLookupError) {
        logApiError({
          requestId,
          endpoint,
          status: 500,
          message: "Failed looking up subscription",
          error: subscriptionLookupError,
          userId: user.id,
        })
        return NextResponse.json({ error: subscriptionLookupError.message }, { status: 500 })
      }

      if (!activeSubscription) {
        const { error: createSubscriptionError } = await supabase
          .from("subscriptions")
          .insert({
            user_id: existingUser.id,
            plan: nextPlan,
            status: "active",
          })

        if (createSubscriptionError) {
          logApiError({
            requestId,
            endpoint,
            status: 500,
            message: "Failed creating subscription for existing user",
            error: createSubscriptionError,
            userId: user.id,
          })
          return NextResponse.json({ error: createSubscriptionError.message }, { status: 500 })
        }
      }

      return NextResponse.json({ success: true, action: "updated" })
    }

    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase
      .from("users")
      .insert({
        id: user.id,
        email,
        name,
        plan: "free",
        trial_end: trialEnd,
      })

    if (insertError) {
      if (insertError.code === "23505" && /users_email_key/i.test(insertError.message)) {
        logApiError({
          requestId,
          endpoint,
          status: 409,
          message: "Duplicate email in public.users - possible orphaned auth user or multi-provider account",
          error: insertError,
          email,
          userId: user.id,
        })
        return NextResponse.json(
          {
            error: "An account already exists for this email with a different sign-in method. Use your original provider (for example Google) for this email, or contact support.",
          },
          { status: 409 },
        )
      }

      logApiError({
        requestId,
        endpoint,
        status: 500,
        message: "Failed inserting new user record",
        error: insertError,
        email,
        userId: user.id,
      })
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const { error: insertSubscriptionError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: user.id,
        plan: "free",
        status: "active",
      })

    if (insertSubscriptionError) {
      logApiError({
        requestId,
        endpoint,
        status: 500,
        message: "Failed creating subscription for new user",
        error: insertSubscriptionError,
        userId: user.id,
      })
      return NextResponse.json({ error: insertSubscriptionError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, action: "inserted" })
  } catch (err) {
    logApiError({
      requestId,
      endpoint,
      status: 500,
      message: "Failed ensuring user",
      error: err,
    })
    return NextResponse.json({ error: "Failed to ensure user" }, { status: 500 })
  }
}
