import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerClient } from "@/lib/supabaseServerClient";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reviewId, review_text, rating } = await req.json();

  const { data: existing } = await supabase
    .from("review_replies")
    .select("*")
    .eq("review_id", reviewId)
    .eq("status", "draft")
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({
      reply: existing.reply_text,
    });
  } else {
    const prompt = `
You are replying to a Google review as a business owner.

Rating: ${rating} stars
Review: "${review_text}"

Write a professional and friendly reply under 80 words.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const reply = completion.choices[0].message.content;

    const { data, error } = await supabase
      .from("review_replies")
      .insert({
        review_id: reviewId,
        reply_text: reply,
        source: "ai",
        status: "draft",
      })
      .select()
      .single();

    await supabase
      .from("reviews")
      .update({ latest_reply_id: data.id })
      .eq("id", reviewId);

    return NextResponse.json({ reply });
  }
}
