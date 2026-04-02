-- Add email notification preference columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_negative_review_alerts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_weekly_digest boolean NOT NULL DEFAULT true;
