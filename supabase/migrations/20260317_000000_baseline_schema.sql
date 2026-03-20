


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TYPE public.business_member_role AS ENUM ('owner', 'manager', 'responder', 'viewer');


CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "external_business_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "connected_at" timestamp with time zone DEFAULT "now"(),
    "account_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_synced_at" timestamp with time zone,
    "sync_status" "text" DEFAULT 'pending'::"text",
    "sync_error" "text",
    "reply_tone" "text" DEFAULT 'professional'::"text",
    "platform" "text" DEFAULT 'google'::"text" NOT NULL,
    CONSTRAINT "businesses_platform_check" CHECK (("platform" = ANY (ARRAY['google'::"text", 'yelp'::"text", 'facebook'::"text"])))
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contact_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "provider" "text",
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_analysis" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "review_id" "uuid",
    "sentiment" "text",
    "priority" "text",
    "topics" "text"[],
    "summary" "text",
    "suggested_tone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."review_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_replies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "review_id" "uuid",
    "reply_text" "text",
    "tone_base" "text",
    "tone_effective" "text",
    "tone_adapted" boolean DEFAULT false,
    "source" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "posted_at" timestamp without time zone,
    "posted_to_google" boolean DEFAULT false,
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "review_replies_source_check" CHECK (("source" = ANY (ARRAY['ai'::"text", 'user'::"text", 'system'::"text"]))),
    CONSTRAINT "review_replies_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'posted'::"text", 'failed'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."review_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "review_id" "text" NOT NULL,
    "author_name" "text",
    "rating" integer,
    "review_text" "text",
    "review_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "latest_reply_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "needs_ai_reply" boolean DEFAULT true,
    "is_actionable" boolean DEFAULT true,
    "last_ai_attempt_at" timestamp with time zone,
    "ai_reply_attempts" integer DEFAULT 0,
    "platform" "text" DEFAULT 'google'::"text" NOT NULL,
    CONSTRAINT "reviews_platform_check" CHECK (("platform" = ANY (ARRAY['google'::"text", 'yelp'::"text", 'facebook'::"text"])))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sentiment_cache" (
        "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
        "business_id" "uuid" NOT NULL,
        "analyzed_review_count" integer NOT NULL,
        "analyzed_at" timestamp with time zone NOT NULL,
        "sentiment_positive" integer DEFAULT 0,
        "sentiment_neutral" integer DEFAULT 0,
        "sentiment_negative" integer DEFAULT 0,
        "themes" "jsonb" DEFAULT '{}'::"jsonb",
        "suggestions" "jsonb" DEFAULT '{}'::"jsonb",
        "sentiment_trend_by_day" "jsonb" DEFAULT '{}'::"jsonb",
        "created_at" timestamp with time zone DEFAULT "now"(),
        "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sentiment_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "plan" "text",
    "status" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ends_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "endpoint" "text",
    "business_id" "uuid",
    "review_id" "uuid",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."usage_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "google_id" "text",
    "image" "text",
    "trial_start" timestamp with time zone DEFAULT "now"(),
    "trial_end" timestamp with time zone,
    "plan" "text" DEFAULT 'free'::"text",
    "premium_auto_reply_enabled" boolean DEFAULT false NOT NULL,
    "premium_auto_reply_min_rating" integer DEFAULT 5 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" public.business_member_role NOT NULL,
    "status" "text" NOT NULL DEFAULT 'active'::"text" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text"]))),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_members" OWNER TO "postgres";


ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_user_platform_unique" UNIQUE ("user_id", "external_business_id", "platform");



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_business_user_unique" UNIQUE ("business_id", "user_id");



ALTER TABLE ONLY "public"."contact_submissions"
    ADD CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_analysis"
    ADD CONSTRAINT "review_analysis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_review_id_key" UNIQUE ("review_id");


ALTER TABLE ONLY "public"."sentiment_cache"
    ADD CONSTRAINT "sentiment_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_google_id_key" UNIQUE ("google_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_review_replies_review" ON "public"."review_replies" USING "btree" ("review_id");



CREATE INDEX "idx_business_members_business_id" ON "public"."business_members" USING "btree" ("business_id");



CREATE INDEX "idx_business_members_user_id" ON "public"."business_members" USING "btree" ("user_id");



CREATE INDEX "idx_reviews_business" ON "public"."reviews" USING "btree" ("business_id");



CREATE INDEX "idx_reviews_rating" ON "public"."reviews" USING "btree" ("rating");



CREATE INDEX "idx_reviews_reply" ON "public"."reviews" USING "btree" ("latest_reply_id");



CREATE INDEX "idx_reviews_time" ON "public"."reviews" USING "btree" ("review_time" DESC);


CREATE INDEX "idx_sentiment_cache_business_latest" ON "public"."sentiment_cache" USING "btree" ("business_id", "analyzed_at" DESC);



CREATE INDEX "idx_usage_events_business" ON "public"."usage_events" USING "btree" ("business_id");



CREATE INDEX "idx_usage_events_review" ON "public"."usage_events" USING "btree" ("review_id");



CREATE INDEX "idx_usage_events_user" ON "public"."usage_events" USING "btree" ("user_id");



CREATE UNIQUE INDEX "review_ai_unique" ON "public"."review_replies" USING "btree" ("review_id", "source", "status");



CREATE OR REPLACE TRIGGER "set_updated_at_businesses" BEFORE UPDATE ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_business_members" BEFORE UPDATE ON "public"."business_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_integrations" BEFORE UPDATE ON "public"."integrations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_review_analysis" BEFORE UPDATE ON "public"."review_analysis" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_review_replies" BEFORE UPDATE ON "public"."review_replies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_reviews" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


CREATE OR REPLACE TRIGGER "set_updated_at_sentiment_cache" BEFORE UPDATE ON "public"."sentiment_cache" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_subscriptions" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_usage_events" BEFORE UPDATE ON "public"."usage_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_users" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_members"
    ADD CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_analysis"
    ADD CONSTRAINT "review_analysis_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_latest_reply_id_fkey" FOREIGN KEY ("latest_reply_id") REFERENCES "public"."review_replies"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can submit contact form" ON "public"."contact_submissions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users access analysis via ownership" ON "public"."review_analysis" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."reviews" "r"
     JOIN "public"."businesses" "b" ON (("r"."business_id" = "b"."id")))
  WHERE (("r"."id" = "review_analysis"."review_id") AND ("b"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users access own integrations" ON "public"."integrations" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users access own subscriptions" ON "public"."subscriptions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can access their own businesses" ON "public"."businesses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert replies to their own reviews" ON "public"."review_replies" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."reviews" "r"
     JOIN "public"."businesses" "b" ON (("r"."business_id" = "b"."id")))
  WHERE (("r"."id" = "review_replies"."review_id") AND ("b"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their businesses" ON "public"."businesses" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read replies to their own reviews" ON "public"."review_replies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."reviews" "r"
     JOIN "public"."businesses" "b" ON (("r"."business_id" = "b"."id")))
  WHERE (("r"."id" = "review_replies"."review_id") AND ("b"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can read their own reviews" ON "public"."reviews" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "reviews"."business_id") AND ("b"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can read their own usage events" ON "public"."usage_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read/update themselves" ON "public"."users" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_analysis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update_ai_drafts" ON "public"."review_replies" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."usage_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."businesses" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."businesses" TO "authenticated";



GRANT ALL ON TABLE "public"."contact_submissions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."contact_submissions" TO "authenticated";
GRANT INSERT ON TABLE "public"."contact_submissions" TO "anon";



GRANT ALL ON TABLE "public"."integrations" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."integrations" TO "authenticated";



GRANT ALL ON TABLE "public"."review_analysis" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."review_analysis" TO "authenticated";



GRANT ALL ON TABLE "public"."review_replies" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."review_replies" TO "authenticated";



GRANT ALL ON TABLE "public"."reviews" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."reviews" TO "authenticated";



GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."subscriptions" TO "authenticated";



GRANT ALL ON TABLE "public"."usage_events" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."usage_events" TO "authenticated";



GRANT ALL ON TABLE "public"."users" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."users" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







