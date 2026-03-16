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

  console.log("get-reviews: fetching reviews for user", { userId });

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!business) {
    console.error("get-reviews: no business found for user", { userId });
    return NextResponse.json({ reviews: null });
  }

  console.log("get-reviews: found business for user", {
    userId,
    businessId: business.id,
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
  .eq("business_id", business.id)
  .order("review_date", { ascending: false });

  if (error) {
    console.error("get-reviews error:", error);
  }
  console.log("get-reviews: fetched reviews for user", {
    userId,
    reviewCount: reviews?.length,
  });

  return NextResponse.json({ reviews });
}
