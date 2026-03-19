-- Add sentiment_cache table for storing aggregated sentiment analysis results

CREATE TABLE IF NOT EXISTS "public"."sentiment_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    
    -- Metadata: what data was analyzed
    "analyzed_review_count" integer NOT NULL,
    "analyzed_at" timestamp with time zone NOT NULL,
    
    -- Basic: Sentiment breakdown (all tiers)
    "sentiment_positive" integer DEFAULT 0,
    "sentiment_neutral" integer DEFAULT 0,
    "sentiment_negative" integer DEFAULT 0,
    
    -- Premium only: Themes (top topics from reviews)
    "themes" "jsonb" DEFAULT '{}'::"jsonb",
    
    -- Premium only: AI suggestions
    "suggestions" "jsonb" DEFAULT '{}'::"jsonb",
    
    -- Premium only: Sentiment trends (30 days, grouped by day)
    "sentiment_trend_by_day" "jsonb" DEFAULT '{}'::"jsonb",
    
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."sentiment_cache" OWNER TO "postgres";

-- Primary key
ALTER TABLE ONLY "public"."sentiment_cache"
    ADD CONSTRAINT "sentiment_cache_pkey" PRIMARY KEY ("id");

-- Index for fast lookup by business
CREATE INDEX "idx_sentiment_cache_business_latest" ON "public"."sentiment_cache" ("business_id", "analyzed_at" DESC);

-- Set updated_at trigger
CREATE TRIGGER "set_sentiment_cache_updated_at"
BEFORE UPDATE ON "public"."sentiment_cache"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
