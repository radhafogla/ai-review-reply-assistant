"use client"

import { useState } from "react"
import { ReviewWithAnalysis } from "../types/review"
import { useEffect } from "react"

type Props = {
  review: ReviewWithAnalysis | null
  onReplyPosted: () => void
}

export default function ReplyPanel({ review, onReplyPosted }: Props) {

  const [reply, setReply] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const [isPosted, setIsPosted] = useState(false)
  

  useEffect(() => {
    if (!review) return

    async function loadReply() {

      const res = await fetch(
        `/api/get-latest-reply?reviewId=${review?.id}`
      )

      const data = await res.json()

      if (data.reply) {
        setReply(data.reply.reply_text)
        setIsPosted(data.reply.status === "posted")
      } else {
        setReply("")
        setIsPosted(false)
      }

    }

    loadReply()

  }, [review])

  if (!review) {
    return (
      <div className="w-1/3 p-6">
        Select a review
      </div>
    )
  }

  async function generateReply() {

    setLoading(true)

    if (!review) return;

    try {

      const res = await fetch("/api/generate-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reviewId: review.id,
          review_text: review.review_text,
          rating: review.rating
        })
      })

      const data = await res.json()

      setReply(data.reply)
    } catch (err) {
      console.error("Generate reply failed", err)
    }

    setLoading(false)

  }

  async function saveReply() {

    if (!review) return;

    setSaving(true)
    try {
      await fetch("/api/save-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reviewId: review.id,
          replyText: reply
        })
      })
    } catch (err) {
      console.error("Save reply failed", err)
    }

    setSaving(false)

  }

  async function saveAndPost() {

    if (!review) return;

    setPosting(true)

    try {

      const res = await fetch("/api/post-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reviewId: review.id,
          replyText: reply
        })
      })

      if (!res.ok) {
        throw new Error("Failed to post reply")
      }

      // refresh reviews in dashboard
      onReplyPosted()

    } catch (err) {
      console.error("Post reply failed", err)
    }

    setPosting(false)

  }

  return (
    <div className="w-1/3 border-l p-6 flex flex-col gap-4">

      <div>
        <h2 className="font-semibold">
          {review.author_name}
        </h2>

        <p className="text-sm text-gray-500">
          Rating: {review.rating}⭐
        </p>

        <p className="mt-2">
          {review.review_text}
        </p>
      </div>

      <button
        onClick={generateReply}
        disabled={loading || isPosted}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? "Generating..." : "Generate AI Reply"}
      </button>

      <textarea
        className="border rounded p-3 h-40"
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        disabled={loading || isPosted}
      />

      <div className="flex gap-3">

        <button
          onClick={saveReply}
          disabled={saving}
          className="bg-gray-300 px-4 py-2 rounded"
        >
          {saving ? "Saving..." : "Save"}
        </button>

        <button
          onClick={saveAndPost}
          disabled={posting}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          {posting ? "Posting..." : "Save & Post"}
        </button>

      </div>

    </div>
  )
}

