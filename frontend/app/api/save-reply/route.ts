import { NextResponse } from "next/server";
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

  const { data: draft } = await supabase
    .from("review_replies")
    .select("*")
    .eq("review_id", reviewId)
    .eq("status", "draft")
    .limit(1)
    .single();

  if (draft) {
    await supabase
      .from("review_replies")
      .update({
        reply_text: replyText,
        source: "user",
      })
      .eq("id", draft.id);
  } else {
    const { data } = await supabase
      .from("review_replies")
      .update({
        reply_text: replyText,
        source: "user",
      })
      .eq("id", draft.id)
      .select()
      .single();

    await supabase
      .from("reviews")
      .update({ latest_reply_id: data.id })
      .eq("id", reviewId);
  }

  return NextResponse.json({ success: true });
}
