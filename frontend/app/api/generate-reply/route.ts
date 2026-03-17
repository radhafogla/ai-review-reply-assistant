import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { createServerClient } from "@/lib/supabaseServerClient";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    console.error("generate-reply: missing bearer token");
    return NextResponse.json({ error: "Unauthorized", reason: "missing_token" }, { status: 401 });
  }

  const supabase = await createServerClient(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("generate-reply: invalid token", userError.message);
    return NextResponse.json(
      { error: "Unauthorized", reason: "invalid_token", detail: userError.message },
      { status: 401 },
    );
  }

  if (!user) {
    console.error("generate-reply: no user in session");
    return NextResponse.json({ error: "Unauthorized", reason: "no_user" }, { status: 401 });
  }

  const { reviewId, review_text, rating } = await req.json();

  const prompt = `
You are replying to a Google review as a business owner.

Rating: ${rating} stars
Review: "${review_text}"

Write a professional and friendly reply under 80 words. You dont need to address/greet the user or add regards at the end. Just the message itself is good.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const reply = completion.choices[0].message.content;

  const { data: existing } = await supabase
    .from("review_replies")
    .select()
    .eq("review_id", reviewId)
    .eq("source", "ai")
    .eq("status", "draft")
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from("review_replies")
      .update({ reply_text: reply })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    if (error) {
      console.error("Generate reply update failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
      .from("reviews")
      .update({ latest_reply_id: data.id })
      .eq("id", reviewId);
  } else {
    const { data, error } = await supabase
      .from("review_replies")
      .insert({
        review_id: reviewId,
        user_id: user.id,
        reply_text: reply,
        source: "ai",
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      console.error("Generate reply insert failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
      .from("reviews")
      .update({ latest_reply_id: data.id })
      .eq("id", reviewId);
  }

  return NextResponse.json({ reply });
}
