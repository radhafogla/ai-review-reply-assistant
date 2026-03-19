import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabaseServerClient";
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger";

export async function POST(req: NextRequest) {
  const endpoint = "/api/get-reviews";
  const requestId = createRequestId();
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    logApiError({
      requestId,
      endpoint,
      status: 401,
      message: "Missing bearer token",
      error: "missing_token",
    });
    return NextResponse.json(
      { error: "Unauthorized", reviews: null },
      { status: 401 },
    );
  }

  // Create client with user's token
  const supabase = await createServerClient(token);

  // Get user info from token
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { error: "Unauthorized", reviews: null },
      { status: 401 },
    );
  }

  const userId = user.id;
  logApiRequest({ requestId, endpoint, userId });

  const body = await req.json().catch(() => ({}));
  const includeHistoricalBacklog = body?.includeHistoricalBacklog === true;
  const requestedBusinessId =
    typeof body?.businessId === "string" && body.businessId.trim().length > 0
      ? body.businessId.trim()
      : null;

  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", userId)
    .order("id", { ascending: true });

  if (businessesError) {
    logApiError({
      requestId,
      endpoint,
      userId,
      status: 500,
      message: "Failed loading businesses",
      error: businessesError.message,
    });
    return NextResponse.json(
      { error: "Failed to load businesses", detail: businessesError.message, reviews: null },
      { status: 500 },
    );
  }

  if (!businesses || businesses.length === 0) {
    logApiRequest({
      requestId,
      endpoint,
      userId,
      message: "No businesses connected",
      businessCount: 0,
    });
    return NextResponse.json({ reviews: [], businesses: [], selectedBusinessId: null });
  }

  const selectedBusiness = requestedBusinessId
    ? businesses.find((business) => business.id === requestedBusinessId) ?? businesses[0]
    : businesses[0];

  const selectedBusinessId = selectedBusiness.id;
  logApiRequest({
    requestId,
    endpoint,
    userId,
    message: "Selected business for reviews fetch",
    businessCount: businesses.length,
    selectedBusinessId,
    includeHistoricalBacklog,
  });

  const { count: historicalBacklogCount, error: backlogCountError } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("business_id", selectedBusinessId)
    .eq("needs_ai_reply", true)
    .eq("is_actionable", false);

  if (backlogCountError) {
    logApiError({
      requestId,
      endpoint,
      userId,
      status: 500,
      message: "Failed counting historical backlog",
      error: backlogCountError,
      selectedBusinessId,
    });
  }

  let reviewsQuery = supabase
    .from("reviews")
    .select(`
    id,
    author_name,
    rating,
    review_text,
    review_time,
    needs_ai_reply,
    is_actionable,
    ai_reply_attempts,
    latest_reply:review_replies!reviews_latest_reply_id_fkey (
      id,
      reply_text,
      tone_base,
      tone_effective,
      tone_adapted,
      status,
      source,
      created_at
    )
  `)
    .eq("business_id", selectedBusinessId);

  if (!includeHistoricalBacklog) {
    reviewsQuery = reviewsQuery.or("is_actionable.eq.true,needs_ai_reply.eq.false");
  }

  const { data: reviews, error } = await reviewsQuery.order("review_time", { ascending: false });

  if (error) {
    logApiError({
      requestId,
      endpoint,
      userId,
      status: 500,
      message: "Failed fetching reviews",
      error,
      selectedBusinessId,
    });
  }
  logApiRequest({
    requestId,
    endpoint,
    userId,
    message: "Fetched reviews",
    selectedBusinessId,
    reviewCount: reviews?.length ?? 0,
    historicalBacklogCount: historicalBacklogCount ?? 0,
    includeHistoricalBacklog,
  });

  return NextResponse.json({
    reviews: reviews ?? [],
    businesses,
    selectedBusinessId,
    historicalBacklogCount: historicalBacklogCount ?? 0,
    includeHistoricalBacklog,
  });
}
