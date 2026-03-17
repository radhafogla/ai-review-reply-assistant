export interface Review {
    id: string;
    business_id: string;
    author_name: string;
    rating: number;
    review_text: string;
    created_at: string;
    review_date: string;
  review_time?: string;
    latest_reply_id?: string;
    latest_reply?: ReviewReply
}

export interface ReviewReply {
  id: string
  review_id: string
  reply_text: string
  source: "ai" | "user" | "system"
  status: "draft" | "approved" | "posted" | "failed" | "deleted"
  created_at: string
}

export interface ReviewAnalysis {
    summary: string;
    sentiment: string
}

/* Supabase query result type */
export interface ReviewWithReplies extends Review {
  review_replies?: ReviewReply[]
}

export interface ReviewWithAnalysis extends Review {
  review_analysis?: ReviewAnalysis[]
}