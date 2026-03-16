import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/googleAuth";
import { createServerClient } from "@/lib/supabaseServerClient";

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reviewId, replyText } = await req.json();
  const { data: review, error } = await supabase
    .from("reviews")
    .select(
      `*,
      businesses (
        account_id,
        google_location_id
      )
    `,
    )
    .eq("id", reviewId)
    .eq("status", "draft")
    .single();

  if (error || !review || !review.businesses?.length) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const business = review.businesses?.[0];
  const accountId = business?.account_id;
  const locationId = business?.google_location_id;
  const googleReviewId = review.google_review_id;

  const token = await getValidAccessToken(user.id, supabase);

  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${googleReviewId}/reply`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      comment: replyText,
    }),
  });

  if (!res.ok) {
    await supabase
      .from("review_replies")
      .update({
        status: "failed",
      })
      .eq("review_id", reviewId);

    return NextResponse.json(
      { error: "Failed to post reply" },
      { status: 500 },
    );
  }

  const { data } = await supabase
    .from("review_replies")
    .insert({
      review_id: reviewId,
      reply_text: review.reply_text,
      source: review.source,
      status: "posted",
      posted_at: new Date(),
    })
    .select()
    .single();

  await supabase
    .from("reviews")
    .update({ latest_reply_id: data.id })
    .eq("id", reviewId);

  return NextResponse.json({ success: true });
}
