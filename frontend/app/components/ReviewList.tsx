import ReviewCard from "./ReviewCard"
import { ReviewWithAnalysis } from "../types/review"

type ReviewListProps = {
  reviews: ReviewWithAnalysis[]
  onSelect: (review: ReviewWithAnalysis) => void
}

export default function ReviewList({
  reviews,
  onSelect
}: ReviewListProps) {

  return (

    <div className="w-96 border-r overflow-y-scroll">

      {reviews.map((review: ReviewWithAnalysis) => (

        <ReviewCard
          key={review.id}
          review={review}
          onSelect={onSelect}
        />

      ))}

    </div>
  )
}