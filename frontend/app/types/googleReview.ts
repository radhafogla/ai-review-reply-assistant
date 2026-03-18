export interface GoogleReviewer {
  displayName?: string
}

export interface GoogleReply {
  comment?: string
  createTime?: string
  updateTime?: string
}

export interface GoogleReview {
  reviewId: string
  reviewer: GoogleReviewer
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE" | number | string
  comment?: string
  createTime: string
  updateTime?: string
  reply?: GoogleReply
}

export interface GoogleReviewListResponse {
  reviews?: GoogleReview[]
  nextPageToken?: string
}
