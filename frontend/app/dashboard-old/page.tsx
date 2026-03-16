"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import SuggestionsPanel from "../components/SuggestionsPanel";

import { Review, ReviewWithReplies } from "../types/review"
import {
    XAxis, YAxis, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend, CartesianGrid,
    ReferenceLine, Area, AreaChart
} from "recharts";
import dayjs from "dayjs";
import { useRouter } from "next/navigation"
import { useCallback } from "react";

export default function DashboardPage() {
    const router = useRouter()

    const [authUser, setAuthUser] = useState<{
        id: string;
        email: string;
        name: string;
    } | null>(null)
    const [checkingSession, setCheckingSession] = useState(true)
    const [reviews, setReviews] = useState<Review[]>([]);
    const [reviewReplies, setReviewReplies] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<"pending" | "posted">("pending");
    const [mainTab, setMainTab] = useState<"reviews" | "analysis" | "suggestions">("reviews");


    const pendingReviews = reviews.filter(r => !r.latest_reply || r.latest_reply.status !== "posted").length;
    const postedReviews = reviews.filter(r => r.latest_reply && r.latest_reply.status === "posted").length;

    const pendingReviewsList = reviews.filter((r) => !r.latest_reply || r.latest_reply.status !== "posted");
    const postedReviewsList = reviews.filter((r) => r.latest_reply && r.latest_reply.status === "posted");
    const currentReviews = activeTab === "pending" ? pendingReviewsList : postedReviewsList;

    const [collapsedBusinesses, setCollapsedBusinesses] = useState<{ [key: string]: boolean }>({});

    // Filters
    const [businessFilter, setBusinessFilter] = useState<string>("All");
    const [ratingFilter, setRatingFilter] = useState<number | null>(null);

    const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null)

    // 0️⃣ Check Supabase session
    useEffect(() => {
        async function fetchUser() {
            const { data: { session } } = await supabase.auth.getSession()

            if (session?.user?.email) {
                setAuthUser({
                    id: session.user.id,
                    email: session.user.email,
                    name:
                        (session.user.user_metadata?.name as string | undefined) ||
                        (session.user.user_metadata?.full_name as string | undefined) ||
                        session.user.email
                })
            }

            setCheckingSession(false)
        }

        fetchUser()
    }, [])

    // 1️⃣ Fetch Reviews
    const fetchReviews = useCallback(
        async (businessId: string) => {
            setLoading(true)

            const { data, error } = await supabase
                .from("reviews")
                .select(`
                            *,
                            review_replies (
                            id,
                            reply_text,
                            source,
                            status,
                            created_at
                            )
      `         )
                .eq("business_id", businessId)
                .order("created_at", { ascending: false })

            if (error) {
                console.error("Error fetching reviews:", error)
            } else if (data) {

                const formatted: Review[] = (data as ReviewWithReplies[]).map((r) => ({
                    ...r,
                    latest_reply:
                        r.review_replies && r.review_replies.length > 0
                            ? r.review_replies.sort(
                                (a, b) =>
                                    new Date(b.created_at).getTime() -
                                    new Date(a.created_at).getTime()
                            )[0]
                            : undefined
                }))

                setReviews(formatted)

                const initialReplies: { [key: string]: string } = {}

                formatted.forEach((r) => {
                    initialReplies[r.id] = r.latest_reply?.reply_text || ""
                })

                setReviewReplies(initialReplies)
            }

            setLoading(false)
        },
        []
    )


    // 2️⃣ Check User & Business
    const checkUserAndBusiness = useCallback(async () => {
        if (!authUser?.email) return

        try {
            // Ensure user exists
            let { data: userData } = await supabase
                .from("users")
                .select("*")
                .eq("email", authUser.email)
                .single()

            if (!userData) {
                const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                const { data: newUser } = await supabase
                    .from("users")
                    .insert({
                        email: authUser.email,
                        name: authUser.name,
                        google_id: authUser.id,
                        trial_end: trialEnd
                    })
                    .select()
                    .single()
                userData = newUser
            }

            // Ensure user has businesses
            const { data: businesses } = await supabase
                .from("businesses")
                .select("*")
                .eq("user_id", userData.id)

            if (!businesses || businesses.length === 0) {
                router.push("/connect-business")
                return
            }

            // Pick first business as current (or allow user selection later)
            const businessId = businesses[0].id
            setCurrentBusinessId(businessId)

            // Fetch reviews for this business
            await fetchReviews(businessId)
        } catch (err) {
            console.error("Error checking user/business:", err)
        }
    }, [authUser, router, fetchReviews])

    // 3️⃣ Run on mount / session change
    useEffect(() => {
        if (checkingSession) return
        if (!authUser) {
            router.push("/login")
            return
        }

        ; (async () => {
            await checkUserAndBusiness()
        })()
    }, [checkingSession, authUser, router, checkUserAndBusiness])

    if (checkingSession) return <p>Loading session...</p>

    if (loading) return <p>Loading...</p>

    function groupByBusiness(reviews: Review[]) {
        return reviews.reduce((acc: Record<string, Review[]>, review) => {
            if (!acc[review.business_id]) {
                acc[review.business_id] = [];
            }
            acc[review.business_id].push(review);
            return acc;
        }, {} as Record<string, Review[]>);
    }

    const groupedReviews = groupByBusiness(currentReviews);

    function toggleBusiness(business: string) {
        setCollapsedBusinesses((prev) => ({
            ...prev,
            [business]: !prev[business],
        }));
    }

    // Handle reply text change
    const handleReplyChange = (id: string, value: string) => {
        setReviewReplies((prev) => ({ ...prev, [id]: value }));
    };

    async function postReply(reviewId: string) {
        const reply = reviewReplies[reviewId]

        const { error } = await supabase
            .from("review_replies")
            .insert({
                review_id: reviewId,
                reply_text: reply,
                source: "user",
                status: "posted"
            })

        if (error) {
            alert("Error posting reply")
        } else {
            alert("Reply posted successfully")

            if (currentBusinessId) {
                fetchReviews(currentBusinessId)
            }
        }
    }


    // Filtered reviews
    const filteredReviews = reviews.filter((r) => {
        if (businessFilter !== "All" && r.business_id !== businessFilter) return false;
        if (ratingFilter && r.rating !== ratingFilter) return false;
        return true;
    });

    // Summary Metrics
    const totalReviews = reviews.length;
    const avgRating =
        reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
            : 0;
    const repliesGenerated = reviews.filter((r) => r.latest_reply?.reply_text).length;

    // Chart data
    const reviewVolumeData = Object.values(
        filteredReviews.reduce(
            (acc: Record<string, { date: string; count: number }>, r) => {
                const date = dayjs(r.created_at).format("YYYY-MM-DD");
                if (!acc[date]) acc[date] = { date, count: 0 };
                acc[date].count += 1;
                return acc;
            },
            {}
        )
    );

    const filteredReviewCount = filteredReviews.length;
    const ratingDistributionData = [
        { name: "5★", value: filteredReviews.filter((r) => r.rating === 5).length },
        { name: "4★", value: filteredReviews.filter((r) => r.rating === 4).length },
        { name: "3★", value: filteredReviews.filter((r) => r.rating === 3).length },
        { name: "2★", value: filteredReviews.filter((r) => r.rating === 2).length },
        { name: "1★", value: filteredReviews.filter((r) => r.rating === 1).length }
    ];

    const avgRatingPerBusiness = Object.values(
        filteredReviews.reduce((acc: Record<string, { name: string; total: number; count: number }>, r) => {
            if (!acc[r.business_id]) acc[r.business_id] = { name: r.business_id, total: 0, count: 0 };
            acc[r.business_id].total += r.rating;
            acc[r.business_id].count += 1;
            return acc;
        }, {})
    ).map((b: { name: string; total: number; count: number }) => ({ name: b.name, rating: b.total / b.count }));

    // Unique business options for filter
    const businessOptions = ["All", ...Array.from(new Set(reviews.map((r) => r.business_id)))];

    const autoResizeTextarea = (el: HTMLTextAreaElement) => {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="mx-auto max-w-screen-2xl p-6 md:p-8">

                {/* Top Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                    <button
                        type="button"
                        onClick={() => {
                            setMainTab("reviews");
                            setActiveTab("pending");
                        }}
                        className="text-left bg-white/90 backdrop-blur shadow-md hover:shadow-lg transition rounded-xl p-4 border border-red-100"
                    >
                        <h2 className="text-slate-500 text-sm">Needs Action</h2>
                        <p className="text-2xl font-bold text-red-500">{pendingReviews}</p>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setMainTab("reviews");
                            setActiveTab("posted");
                        }}
                        className="text-left bg-white/90 backdrop-blur shadow-md hover:shadow-lg transition rounded-xl p-4 border border-green-100"
                    >
                        <h2 className="text-slate-500 text-sm">Completed</h2>
                        <p className="text-2xl font-bold text-green-600">{postedReviews}</p>
                    </button>

                    <div className="bg-white/90 backdrop-blur shadow-md rounded-xl p-4 border border-slate-100">
                        <h2 className="text-slate-500 text-sm">Total Reviews</h2>
                        <p className="text-2xl font-bold text-slate-800">{totalReviews}</p>
                    </div>

                    <div className="bg-white/90 backdrop-blur shadow-md rounded-xl p-4 border border-slate-100">
                        <h2 className="text-slate-500 text-sm">Avg Rating</h2>
                        <p className="text-2xl font-bold text-slate-800">{avgRating}</p>
                    </div>

                    <div className="bg-white/90 backdrop-blur shadow-md rounded-xl p-4 border border-slate-100">
                        <h2 className="text-slate-500 text-sm">Replies Generated</h2>
                        <p className="text-2xl font-bold text-slate-800">{repliesGenerated}</p>
                    </div>
                </div>

                {/* Main Tabs */}
                <div className="flex gap-2 mb-4">
                    <button
                        type="button"
                        onClick={() => setMainTab("reviews")}
                        className={`px-4 py-2 rounded-lg font-medium transition ${mainTab === "reviews"
                            ? "bg-blue-600 text-white shadow"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                            }`}
                    >
                        Reviews
                    </button>
                    <button
                        type="button"
                        onClick={() => setMainTab("analysis")}
                        className={`px-4 py-2 rounded-lg font-medium transition ${mainTab === "analysis"
                            ? "bg-indigo-600 text-white shadow"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                            }`}
                    >
                        Analysis
                    </button>
                    <button
                        type="button"
                        onClick={() => setMainTab("suggestions")}
                        className={`px-4 py-2 rounded-lg font-medium transition ${mainTab === "suggestions"
                            ? "bg-indigo-600 text-white shadow"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                            }`}
                    >
                        AI Suggestions
                    </button>
                </div>

                {/* REVIEWS TAB */}
                {mainTab === "reviews" && (
                    <>
                        {/* Review sub-tabs */}
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={() => setActiveTab("pending")}
                                className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === "pending"
                                    ? "bg-blue-500 text-white shadow"
                                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                    }`}
                            >
                                Needs Action ({pendingReviews})
                            </button>

                            <button
                                onClick={() => setActiveTab("posted")}
                                className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === "posted"
                                    ? "bg-emerald-500 text-white shadow"
                                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                    }`}
                            >
                                Completed ({postedReviews})
                            </button>
                        </div>

                        {/* Review List */}
                        {Object.entries(groupedReviews).map(([business, businessReviews]) => {
                            const isCollapsed = collapsedBusinesses[business];

                            return (
                                <div key={business} className="mb-4">
                                    <div
                                        className="cursor-pointer bg-white/90 p-2.5 rounded-lg flex justify-between border border-slate-200 shadow-sm"
                                        onClick={() => toggleBusiness(business)}
                                    >
                                        {/* ...existing code... */}
                                    </div>

                                    {!isCollapsed && (
                                        <div className="mt-2.5 space-y-2.5">
                                            {businessReviews.map((review: Review) => {
                                                const isPosted = review.latest_reply?.status === "posted"

                                                return (
                                                    <div key={review.id} className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                                                        <div className="flex justify-between">
                                                            {/* ...existing code... */}
                                                        </div>

                                                        <p className="italic mt-1.5 text-slate-700 whitespace-pre-wrap break-words">
                                                            {review.review_text}
                                                        </p>

                                                        <textarea
                                                            className="w-full border rounded-lg p-2 mt-2 min-h-[44px] resize-none overflow-hidden"
                                                            value={reviewReplies[review.id] || ""}
                                                            onInput={(e) => autoResizeTextarea(e.currentTarget)}
                                                            onChange={(e) => handleReplyChange(review.id, e.target.value)}
                                                            disabled={isPosted}
                                                            rows={1}
                                                        />

                                                        {!isPosted && (
                                                            <button
                                                                onClick={() => postReply(review.id)}
                                                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg mt-2 transition"
                                                            >
                                                                Post Reply
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </>
                )}

                {/* ANALYSIS TAB */}
                {mainTab === "analysis" && (
                    <>
                        {/* Filters */}
                        <div className="flex gap-3 mb-4 flex-wrap bg-white/90 rounded-xl p-3 shadow-sm border border-slate-100">
                            <select
                                className="border rounded-lg p-2 bg-white"
                                value={businessFilter}
                                onChange={(e) => setBusinessFilter(e.target.value)}
                            >
                                {businessOptions.map((b) => (
                                    <option key={b}>{b}</option>
                                ))}
                            </select>

                            <select
                                className="border rounded-lg p-2 bg-white"
                                value={ratingFilter ?? ""}
                                onChange={(e) => setRatingFilter(e.target.value ? parseInt(e.target.value) : null)}
                            >
                                <option value="">All Ratings</option>
                                {[5, 4, 3, 2, 1].map((r) => (
                                    <option key={r} value={r}>
                                        {r}★
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="bg-white shadow p-4 rounded-xl">
                                <h3 className="font-bold mb-2 text-gray-700">📈 Review Volume Over Time</h3>
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={reviewVolumeData}>
                                        <defs>
                                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(val) => dayjs(val).format("MMM D")} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <Tooltip
                                            formatter={(value) => [`${Number(value ?? 0)} reviews`, "Count"]}
                                            labelFormatter={(label) => dayjs(label).format("MMM D, YYYY")}
                                        />
                                        <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} fill="url(#colorCount)" dot={{ r: 4, fill: "#3B82F6" }} activeDot={{ r: 6 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="bg-white shadow p-4 rounded-xl">
                                <h3 className="font-bold mb-1 text-gray-700">⭐ Rating Distribution</h3>
                                <p className="text-xs text-gray-400 mb-3">Based on {reviews.length} total reviews</p>

                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie
                                            data={ratingDistributionData.filter((item) => item.value > 0)}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={3}
                                            stroke="#ffffff"
                                            strokeWidth={2}
                                            isAnimationActive
                                        >
                                            {ratingDistributionData.filter((item) => item.value > 0).map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={
                                                        entry.name === "5★" ? "#34D399"
                                                            : entry.name === "4★" ? "#86EFAC"
                                                                : entry.name === "3★" ? "#FBBF24"
                                                                    : entry.name === "2★" ? "#FB923C"
                                                                        : "#EF4444"
                                                    }
                                                />
                                            ))}
                                        </Pie>

                                        <Tooltip
                                            formatter={(value) => {
                                                const count = Number(value ?? 0);
                                                const percent = filteredReviewCount > 0 ? ((count / filteredReviewCount) * 100).toFixed(0) : "0";
                                                return [`${count} reviews (${percent}%)`, "Count"];
                                            }}
                                        />

                                        <Legend
                                            verticalAlign="bottom"
                                            height={36}
                                            iconType="circle"
                                            formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                                        />

                                        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-gray-400 text-[11px]">
                                            Total
                                        </text>
                                        <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" className="fill-gray-700 text-lg font-bold">
                                            {filteredReviewCount}
                                        </text>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="bg-white shadow p-4 rounded-xl md:col-span-2">
                                <h3 className="font-bold mb-2 text-gray-700">🏢 Average Rating per Business</h3>
                                <ResponsiveContainer width="100%" height={270}>
                                    <BarChart data={avgRatingPerBusiness} barSize={40}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            formatter={(value) => [Number(value ?? 0).toFixed(2), "Avg Rating"]}
                                            cursor={{ fill: "rgba(0,0,0,0.05)" }}
                                        />
                                        <ReferenceLine y={4} stroke="#FBBF24" strokeDasharray="4 4" label={{ value: "Good", position: "insideTopRight", fontSize: 11, fill: "#FBBF24" }} />
                                        <Bar dataKey="rating" radius={[6, 6, 0, 0]}>
                                            {avgRatingPerBusiness.map((entry, index) => (
                                                <Cell key={`bar-${index}`} fill={entry.rating >= 4 ? "#34D399" : entry.rating >= 3 ? "#FBBF24" : "#EF4444"} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}

                {/* AI Suggestions TAB */}
                {mainTab === "suggestions" && (
                    <SuggestionsPanel reviews={reviews} />
                )}
            </div>
        </div>
    );
    // ...existing code...
}