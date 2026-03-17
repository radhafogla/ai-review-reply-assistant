import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabaseServerClient";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    console.error("get-reviews: no token in Authorization header");
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

  const body = await req.json().catch(() => ({}));
  const requestedBusinessId =
    typeof body?.businessId === "string" && body.businessId.trim().length > 0
      ? body.businessId.trim()
      : null;

  console.log("get-reviews: fetching reviews for user", { userId });

  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", userId)
    .order("id", { ascending: true });

  if (businessesError) {
    console.error("get-reviews: failed loading businesses", { userId, error: businessesError.message });
    return NextResponse.json(
      { error: "Failed to load businesses", detail: businessesError.message, reviews: null },
      { status: 500 },
    );
  }

  if (!businesses || businesses.length === 0) {
    console.error("get-reviews: no business found for user", { userId });
    return NextResponse.json({ reviews: [], businesses: [], selectedBusinessId: null });
  }

  const selectedBusiness = requestedBusinessId
    ? businesses.find((business) => business.id === requestedBusinessId) ?? businesses[0]
    : businesses[0];

  const selectedBusinessId = selectedBusiness.id;

  console.log("get-reviews: found business for user", {
    userId,
    businessCount: businesses.length,
    selectedBusinessId,
  });

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select(`
    id,
    author_name,
    rating,
    review_text,
    review_date,
    latest_reply:review_replies!reviews_latest_reply_id_fkey (
      id,
      reply_text,
      status,
      source,
      created_at
    )
  `)
    .eq("business_id", selectedBusinessId)
    .order("review_date", { ascending: false });

  if (error) {
    console.error("get-reviews error:", error);
  }
  console.log("get-reviews: fetched reviews for user", {
    userId,
    selectedBusinessId,
    reviewCount: reviews?.length,
  });

  return NextResponse.json({ reviews: reviews ?? [], businesses, selectedBusinessId });
}
