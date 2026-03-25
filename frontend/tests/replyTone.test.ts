import { describe, expect, it } from "vitest"
import {
  DEFAULT_REPLY_TONE,
  buildReplyPrompt,
  normalizeReplyTone,
  normalizeReviewSentiment,
  resolveAdaptiveReplyTone,
} from "../lib/replyTone"

describe("replyTone", () => {
  it("falls back to the default reply tone for empty or invalid values", () => {
    expect(normalizeReplyTone(null)).toBe(DEFAULT_REPLY_TONE)
    expect(normalizeReplyTone(undefined)).toBe(DEFAULT_REPLY_TONE)
    expect(normalizeReplyTone("invalid")).toBe(DEFAULT_REPLY_TONE)
  })

  it("normalizes supported reply tones case-insensitively", () => {
    expect(normalizeReplyTone("PROFESSIONAL")).toBe("professional")
    expect(normalizeReplyTone("Casual")).toBe("casual")
  })

  it("normalizes review sentiment values and rejects unsupported ones", () => {
    expect(normalizeReviewSentiment("NEGATIVE")).toBe("negative")
    expect(normalizeReviewSentiment("neutral")).toBe("neutral")
    expect(normalizeReviewSentiment("mixed")).toBeNull()
  })

  it("forces apologetic tone for negative sentiment or low ratings", () => {
    expect(resolveAdaptiveReplyTone({ baseTone: "casual", sentiment: "negative", rating: 5 })).toBe("apologetic")
    expect(resolveAdaptiveReplyTone({ baseTone: "friendly", sentiment: "positive", rating: 2 })).toBe("apologetic")
  })

  it("moves apologetic tone back to professional for positive reviews", () => {
    expect(resolveAdaptiveReplyTone({ baseTone: "apologetic", sentiment: "positive", rating: 5 })).toBe("professional")
  })

  it("builds a prompt with the review details and tone instruction", () => {
    const prompt = buildReplyPrompt({
      rating: 1,
      reviewText: "The service was slow.",
      toneInstruction: "Tone preference: empathetic and apologetic while remaining constructive.",
    })

    expect(prompt).toContain("Rating: 1 stars")
    expect(prompt).toContain('Review: "The service was slow."')
    expect(prompt).toContain("Tone preference: empathetic and apologetic while remaining constructive.")
    expect(prompt).toContain("Avoid friendly filler phrases")
  })
})