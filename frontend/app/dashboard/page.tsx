"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

import Sidebar from "../components/Sidebar"
import ReviewList from "../components/ReviewList"
import ReplyPanel from "../components/ReplyPanel"
import EmptyState from "../components/EmptyState"

import { ReviewWithAnalysis } from "../types/review"

export default function Dashboard() {

    const [reviews, setReviews] =
        useState<ReviewWithAnalysis[]>([])

    const [selectedReview, setSelectedReview] =
        useState<ReviewWithAnalysis | null>(null)

    const [hasBusiness, setHasBusiness] =
        useState(true)


    async function loadReviews() {

        const { data: { session } } =
            await supabase.auth.getSession()

        const userId = session?.user?.id
        const accessToken = session?.access_token

        if (!userId || !accessToken) {
            setHasBusiness(false)
            return
        }

        // First, sync reviews from Google Business
        await fetch("/api/sync-reviews", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        })

        // Then fetch the reviews
        const res = await fetch("/api/get-reviews", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
        })

        const data = await res.json()

        console.log("Dashboard: fetched reviews", { data })

        if (!data.reviews) {
            setHasBusiness(false)
            return
        }

        setReviews(data.reviews)

        if (data.reviews.length > 0) {
            setSelectedReview(data.reviews[0])
        }

    }

    useEffect(() => {

        const fetchReviews = async () => {
            await loadReviews()
        }

        fetchReviews()

    }, [])

    if (!hasBusiness) {
        return <EmptyState />
    }

    return (
        <div className="flex h-screen">

            <div className="w-64">
                <Sidebar />
            </div>

            <div className="flex-1">
                <ReviewList
                    reviews={reviews}
                    onSelect={setSelectedReview}
                />
            </div>

            <div className="w-1/3">
                <ReplyPanel
                    review={selectedReview}
                    onReplyPosted={loadReviews}
                />
            </div>

        </div>

    )

}