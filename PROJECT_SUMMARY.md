# AI Review Reply Assistant - Project Summary

Last updated: 2026-03-23

## Executive Summary

AI Review Reply Assistant is a Next.js application for Google Business review operations: connect locations, sync reviews, automated email alerts for negative reviews, generate AI-assisted replies, edit drafts, post to Google, and analyze sentiment with premium insight layers. The product now includes team-member collaboration with DB-level roles and role-enforced dashboard/API actions.

Current production readiness assessment:
- Core product flows are implemented and role-hardened.
- Team members backend and frontend are implemented.
- Automated sync orchestration is implemented with Inngest.
- Main remaining production work is release hardening: migration workflow, CI coverage, monitoring polish, and rollout validation.

## Product Scope

- Connect one or more Google Business Profile locations
- Sync reviews from Google into Supabase
- Generate AI draft replies using OpenAI
- Edit drafts before posting
- Post replies to Google from the app
- Track reply lifecycle states (draft, posted, failed, deleted)
- Run sentiment analysis from analytics
- Apply subscription-based feature gating
- Support team collaboration with role-based access (owner, manager, responder, viewer)
- Offer premium automation controls for high-rating review replies
- Surface premium-only themes, AI suggestions, and sentiment trend views
- Capture structured API logs and Sentry error reporting

## Current Architecture

Frontend and API:
- Next.js App Router with React and TypeScript
- Route handlers under frontend/app/api
- UI components in frontend/app/components

Data and auth:
- Supabase Auth for authentication
- Supabase Postgres for application data
- Core tables include users, subscriptions, integrations, businesses, business_members, reviews, review_replies, review_analysis, sentiment_cache, usage_events
- Baseline migration is used as production bootstrap source
- schema.sql can be regenerated from live Supabase DB dump

External integrations:
- Google Business Profile APIs
- OpenAI for reply generation
- Resend for contact/email workflows
- Sentry for server-side error monitoring

## Authentication and User Provisioning (Completed)

Implemented:
- Email/password login and signup
- Google OAuth login
- Server-side signup endpoint
- ensure-user provisioning guard

Flow:
1. User signs up or logs in
2. App ensures local user profile exists
3. User is routed by business existence:
   - At least one business: /dashboard
   - No business: /connect-business

## Subscription System and Feature Gating (Completed)

Implemented:
- Centralized plan definitions and limits in frontend/lib/subscription.ts
- Three plans: Free Trial, Basic, Premium
- Subscription hook and API backing

Feature gating:
- Analytics and manual sentiment analysis: Basic and Premium
- Bulk actions: Basic and Premium
- Multi-business access: Basic and Premium
- Premium auto-reply: Premium only
- Themes, AI suggestions, sentiment trend views: Premium only
- Negative review email alerts: all plans

Limits:
- Free Trial: 1 connected business
- Basic: 5 connected businesses
- Premium: 20 connected businesses
- Per-review AI draft generations: max 5 attempts

## Team Members and Role Access (Completed)

Database model:
- business_member_role enum: owner, manager, responder, viewer
- business_members table with unique (business_id, user_id)
- FK to businesses and users

Team workflows:
- Team management API implemented (list/add/update/remove)
- Settings Team tab implemented with business-scoped member management
- Current add-member behavior: add existing signed-up users by email

Role enforcement:
- get-reviews: membership-based access
- post-reply: responder+
- sync-reviews: manager+
- generate-reply: responder+
- save-reply: responder+
- delete-reply: responder+
- team-member mutations: owner only

Dashboard UI behavior:
- Selected business role is returned by get-reviews
- Reply actions are disabled for non-responder roles
- View-only behavior is shown for insufficient role

## Analytics and Sentiment Insights (Completed)

Implemented:
- Manual sentiment analysis action on analytics page
- Cached sentiment results in sentiment_cache
- Staleness detection when new reviews arrive
- Premium-only themes, suggestions, and trend views

## API Surface Snapshot

Current route handlers under frontend/app/api: 24

Includes:
- auth/signup
- analytics
- analytics/internal
- analyze-review
- analyze-reviews
- connect-google-business
- contact
- delete-account
- delete-data
- delete-reply
- ensure-user
- generate-reply
- get-latest-reply
- get-reviews
- google-callback
- google-locations
- post-reply
- premium-auto-reply
- save-business
- save-reply
- sentiment-cache
- subscription
- sync-reviews
- team-members

## Migration Status

Completed:
- Team-member schema is consolidated into baseline migration:
  - supabase/migrations/20260317_000000_baseline_schema.sql
- Incremental migration removed:
  - supabase/migrations/20260319_000000_add_business_members_and_sync_queue.sql

Note:
- This aligns with fresh production bootstrap from baseline.

## Sync Reviews Status (Current)

Current state in repo:
- frontend/lib/syncReviewsCore.ts contains the shared sync, upsert, negative-review alert, and premium auto-reply logic
- frontend/app/api/sync-reviews/route.ts is the authenticated HTTP wrapper for manual sync
- frontend/inngest/functions/syncReviews.ts handles event-driven and scheduled sync orchestration
- frontend/app/api/inngest/route.ts exposes the Inngest serve endpoint

Implication:
- Manual sync and automated recurring sync are both implemented; remaining work is operational hardening and production rollout discipline.

## Remaining Work Before Production

Primary remaining task:
1. Standardize Supabase production migration workflow outside Vercel deploys
2. Add broader test coverage for critical integration and smoke paths
3. Finalize monitoring, alert routing, and release verification in production
4. Validate Google Business production credentials, callback UX, and sync reliability
5. Tighten deployment/runbook documentation for production operations

## Key Files To Review

- README.md
- frontend/lib/businessAccess.ts
- frontend/lib/businessRoles.ts
- frontend/app/api/team-members/route.ts
- frontend/app/settings/page.tsx
- frontend/app/api/get-reviews/route.ts
- frontend/app/api/post-reply/route.ts
- frontend/app/api/generate-reply/route.ts
- frontend/app/api/save-reply/route.ts
- frontend/app/api/delete-reply/route.ts
- frontend/app/api/sync-reviews/route.ts
- frontend/app/dashboard/page.tsx
- frontend/app/components/ReviewList.tsx
- frontend/app/components/ReviewCard.tsx
- supabase/migrations/20260317_000000_baseline_schema.sql
