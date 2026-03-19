export const DEFAULT_REPLY_TONE = "professional" as const

export const REPLY_TONE_VALUES = ["professional", "friendly", "apologetic"] as const

export type ReplyTone = (typeof REPLY_TONE_VALUES)[number]
export type ReviewSentiment = "positive" | "neutral" | "negative"

export const REPLY_TONE_LABELS: Record<ReplyTone, string> = {
  professional: "Professional",
  friendly: "Friendly",
  apologetic: "Apologetic",
}

export const REPLY_TONE_DESCRIPTIONS: Record<ReplyTone, string> = {
  professional: "Balanced and courteous with a polished business tone.",
  friendly: "Warm and conversational while staying respectful.",
  apologetic: "Empathetic, ownership-driven wording for service recovery.",
}

const REPLY_TONE_PROMPT_GUIDANCE: Record<ReplyTone, string> = {
  professional: "Tone preference: professional and courteous.",
  friendly: "Tone preference: warm, friendly, and conversational.",
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
