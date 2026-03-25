export const DEFAULT_REPLY_TONE = "casual" as const

export const REPLY_TONE_VALUES = ["professional", "friendly", "casual", "apologetic"] as const

export type ReplyTone = (typeof REPLY_TONE_VALUES)[number]
export type ReviewSentiment = "positive" | "neutral" | "negative"

export const REPLY_TONE_LABELS: Record<ReplyTone, string> = {
  professional: "Professional",
  friendly: "Friendly",
  casual: "Casual",
  apologetic: "Apologetic",
}

export const REPLY_TONE_DESCRIPTIONS: Record<ReplyTone, string> = {
  professional: "Balanced and courteous with a polished business tone.",
  friendly: "Warm and conversational while staying respectful.",
  casual: "Relaxed and informal, like chatting with a regular customer.",
  apologetic: "Empathetic, ownership-driven wording for service recovery.",
}

const REPLY_TONE_PROMPT_GUIDANCE: Record<ReplyTone, string> = {
  professional: "Tone preference: professional and courteous.",
  friendly: "Tone preference: warm, friendly, and conversational.",
  casual: "Tone preference: casual and relaxed, informal and laid-back without being unprofessional.",
  apologetic: "Tone preference: empathetic and apologetic while remaining constructive.",
}

export function normalizeReplyTone(value: string | null | undefined): ReplyTone {
  if (!value) {
    return DEFAULT_REPLY_TONE
  }

  const lower = value.toLowerCase()

  if (REPLY_TONE_VALUES.includes(lower as ReplyTone)) {
    return lower as ReplyTone
  }

  return DEFAULT_REPLY_TONE
}

export function getReplyTonePromptGuidance(tone: ReplyTone): string {
  return REPLY_TONE_PROMPT_GUIDANCE[tone]
}

export function normalizeReviewSentiment(value: string | null | undefined): ReviewSentiment | null {
  if (!value) {
    return null
  }

  const lower = value.toLowerCase()

  if (lower === "positive" || lower === "neutral" || lower === "negative") {
    return lower
  }

  return null
}

export function resolveAdaptiveReplyTone({
  baseTone,
  sentiment,
  rating,
}: {
  baseTone: ReplyTone
  sentiment?: string | null
  rating?: number | null
}): ReplyTone {
  const normalizedSentiment = normalizeReviewSentiment(sentiment)
  const numericRating = Number(rating)
  const hasRating = !Number.isNaN(numericRating) && numericRating > 0
  const isLowRating = hasRating && numericRating <= 2

  if (normalizedSentiment === "negative" || isLowRating) {
    return "apologetic"
  }

  if (normalizedSentiment === "positive" && baseTone === "apologetic") {
    return "professional"
  }

  return baseTone
}

export function buildReplyPrompt({
  rating,
  reviewText,
  toneInstruction,
}: {
  rating: number | string
  reviewText: string
  toneInstruction: string
}): string {
  return `
You are replying to a review as a business owner.

Rating: ${rating} stars
Review: "${reviewText}"
Use Tone: ${toneInstruction}

Avoid friendly filler phrases like:
"hey there"
"thanks for your honest take"
"hope you find..."
"we appreciate you pointing this out"

Do not over-apologize or sound overly polite.

Keep the tone slightly direct and grounded, like a real business owner writing quickly.

Avoid explaining intentions like "we want to do better" or "we aim to improve".

Focus on:
- Acknowledging the issue
- Reacting to it naturally
- Keeping it concise and real
Keep sentences slightly varied in length and avoid overly polished wording.
It's okay if the reply feels a bit imperfect as long as it feels real.`
}
