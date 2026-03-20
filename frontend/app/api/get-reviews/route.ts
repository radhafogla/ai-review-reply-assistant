import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabaseServerClient";
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger";
import { listAccessibleBusinesses } from "@/lib/businessAccess";
import { type BusinessMemberRole } from "@/lib/businessRoles";

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

  const { businesses: accessibleBusinesses, error: businessesError } = await listAccessibleBusinesses(userId, supabase)

  const businesses = accessibleBusinesses
    .map((business) => ({ id: business.id, name: business.name, role: business.role }))
    .sort((left, right) => left.id.localeCompare(right.id))

  if (businessesError) {
    logApiError({
      requestId,
      endpoint,
      userId,
      status: 500,
      message: "Failed loading businesses",
      error: typeof businessesError === 'string' ? businessesError : String(businessesError),
    });
    return NextResponse.json(
      { error: "Failed to load businesses", detail: typeof businessesError === 'string' ? businessesError : String(businessesError), reviews: null },
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
    return NextResponse.json({ reviews: [], businesses: [], selectedBusinessId: null, selectedBusinessRole: null });
  }

  const selectedBusiness = requestedBusinessId
    ? businesses.find((business) => business.id === requestedBusinessId) ?? businesses[0]
    : businesses[0];

  const selectedBusinessId = selectedBusiness.id;
  const selectedBusinessRole = selectedBusiness.role as BusinessMemberRole;
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

  const { data: allRatings, error: allRatingsError } = await supabase
    .from("reviews")
    .select("rating")
    .eq("business_id", selectedBusinessId);

  if (allRatingsError) {
    logApiError({
      requestId,
      endpoint,
      userId,
      status: 500,
      message: "Failed fetching all-review ratings",
      error: allRatingsError,
      selectedBusinessId,
    });
  }

  const numericRatings = (allRatings ?? [])
    .map((row) => Number(row.rating))
    .filter((value) => Number.isFinite(value));

  const allReviewsAverageRating =
    numericRatings.length > 0
      ? Number(
          (
            numericRatings.reduce((sum, value) => sum + value, 0) /
            numericRatings.length
          ).toFixed(1),
        )
      : null;

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
    allReviewsCount: numericRatings.length,
    allReviewsAverageRating,
    historicalBacklogCount: historicalBacklogCount ?? 0,
    includeHistoricalBacklog,
  });

  return NextResponse.json({
    reviews: reviews ?? [],
    businesses,
    selectedBusinessId,
    selectedBusinessRole,
    allReviewsAverageRating,
    historicalBacklogCount: historicalBacklogCount ?? 0,
    includeHistoricalBacklog,
  });
}
