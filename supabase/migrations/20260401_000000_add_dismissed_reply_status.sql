-- Add 'dismissed' to the review_replies status check constraint
ALTER TABLE public.review_replies
  DROP CONSTRAINT review_replies_status_check;

ALTER TABLE public.review_replies
  ADD CONSTRAINT review_replies_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'approved'::text, 'posted'::text, 'failed'::text, 'deleted'::text, 'dismissed'::text]));
