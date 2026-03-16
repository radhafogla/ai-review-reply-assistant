import { ReviewWithAnalysis } from "../types/review"

interface ReviewCardProps {
  review: ReviewWithAnalysis;
  onSelect: (review: ReviewWithAnalysis) => void;
}

export default function ReviewCard({ review, onSelect }: ReviewCardProps) {

  const sentiment =
    review.review_analysis?.[0]?.sentiment

  return (

    <div
      onClick={() => onSelect(review)}
      className="border p-4 cursor-pointer hover:bg-gray-50"
    >

      <div className="flex justify-between">

        <span className="font-semibold">
          {review.author_name}
        </span>

        <span>⭐ {review.rating}</span>

      </div>

      <p className="text-sm mt-2">
        {review.review_text}
      </p>

      {sentiment && (

        <div className="text-xs mt-3 text-gray-500">

          Sentiment: {sentiment}

        </div>

      )}

    </div>
  )
}