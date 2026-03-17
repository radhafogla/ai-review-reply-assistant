CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  endpoint text,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  review_id uuid REFERENCES public.reviews(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user ON public.usage_events (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_business ON public.usage_events (business_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_review ON public.usage_events (review_id);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'usage_events'
      AND policyname = 'Users can read their own usage events'
  ) THEN
    CREATE POLICY "Users can read their own usage events"
      ON public.usage_events
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;
