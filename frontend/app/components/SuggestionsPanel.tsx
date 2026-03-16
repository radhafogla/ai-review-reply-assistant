"use client";

import { useState } from "react";
import { Review } from "../types/review"

interface SuggestionsPanelProps {
    reviews: Review[];
}

export default function SuggestionsPanel({ reviews }: SuggestionsPanelProps) {

    const [selectedBusiness, setSelectedBusiness] = useState("");
    const [suggestions, setSuggestions] = useState("");
    const [loading, setLoading] = useState(false);

    const businesses = [...new Set(reviews.map(r => r.business_id))]

    const businessReviews = reviews.filter(
        (r) => r.business_id === selectedBusiness
    )
    //const businessReviews = businessReviewsData.map(r => r.review);

   const averageRating: number | null =
  businessReviews.length > 0
    ? businessReviews.reduce((sum, r) => sum + r.rating, 0) / businessReviews.length
    : null;
    
    const ratingColor =
        averageRating !== null && averageRating >= 4
            ? "text-green-600"
            : averageRating !== null && averageRating >= 3
                ? "text-yellow-600"
                : "text-red-600";
    async function generateSuggestions() {

        setLoading(true);

        const res = await fetch("http://localhost:5000/generate-suggestions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ reviews: businessReviews.map(r => r.review_text) }),
        });

        const data = await res.json();

        setSuggestions(data.suggestions);
        setLoading(false);
    }

    return (
        <div className="bg-white shadow p-6 rounded">

            <h2 className="text-xl font-bold mb-4">
                AI Business Improvement Suggestions
            </h2>

            <select
                className="border p-2 rounded"
                onChange={(e) => setSelectedBusiness(e.target.value)}
            >
                <option>Select Business</option>

                {businesses.map((b) => (
                    <option key={b}>{b}</option>
                ))}

            </select>
            
            <button
                onClick={generateSuggestions}
                className="ml-3 bg-blue-600 text-white px-4 py-2 rounded"
            >
                Generate Suggestions
            </button>

            {selectedBusiness && (
                <div className="mt-4 p-4 bg-gray-50 rounded border">

                    <div className="flex gap-6 mt-2">
                        <div>
                            <p className="text-gray-500 text-sm">Average Rating</p>
                            <p className={`text-xl font-bold ${ratingColor}`}>
                                ⭐ {averageRating !== null ? averageRating.toFixed(2) : "N/A"}
                            </p>
                        </div>

                        <div>
                            <p className="text-gray-500 text-sm">Total Reviews</p>
                            <p className="text-xl font-bold">
                                {businessReviews.length}
                            </p>
                        </div>

                    </div>

                </div>
            )}

            {loading && <p className="mt-4">Analyzing reviews...</p>}

            {suggestions && (
                <div className="mt-6 whitespace-pre-wrap">
                    {suggestions}
                </div>
            )}

        </div>
    );
}