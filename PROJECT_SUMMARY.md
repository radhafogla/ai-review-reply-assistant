# AI Review Reply Assistant - Project Summary

Last updated: 2026-03-18

## Executive Summary

AI Review Reply Assistant is a Next.js application that helps businesses manage Google reviews end-to-end: connect Google Business Profile locations, sync reviews into Supabase, generate AI-assisted replies, edit drafts, and post responses back to Google. The app now supports both email/password auth and Google OAuth, improved user provisioning reliability, smarter post-auth routing, centralized subscription gating, and premium auto-reply controls with analytics visibility.

## Product Scope

- Connect one or more Google Business Profile locations
- Sync reviews from Google into Supabase
- Generate AI draft replies using OpenAI
- Edit drafts before posting
- Post replies to Google from the app
- Track reply lifecycle states (draft, posted, failed, deleted)
- Provide analytics and workflow filtering
- Apply subscription-based feature gating
- Support single-business workflows first, with multi-business expansion on higher plans
- Offer premium automation controls for high-rating review replies
- Capture structured API logs and Sentry error reporting

## Current Architecture

Frontend and API:
- Next.js App Router with React and TypeScript
- Route handlers under frontend/app/api
- UI components in frontend/app/components

Data and auth:
- Supabase Auth for authentication
- Supabase Postgres for application data
- Core tables include users, subscriptions, integrations, businesses, reviews, review_replies, review_analysis, usage_events
- schema.sql is treated as the source of truth and should stay aligned with baseline migrations

External integrations:
- Google Business Profile APIs
- OpenAI for reply generation
- Resend for contact/email workflows
- Sentry for server-side error monitoring

## Authentication and User Provisioning (Completed)

Implemented:
- Email/password login and signup in frontend/app/login/page.tsx
- Google OAuth login remains available
- Server-side signup endpoint at frontend/app/api/auth/signup/route.ts

Flow:
1. User signs up or logs in
2. App ensures local user profile exists via frontend/app/api/ensure-user/route.ts
3. App routes user based on business existence:
   - At least one business: /dashboard
   - No business: /connect-business

Reliability improvements:
- Duplicate-email safeguards before creating auth users
- Hardened ensure-user behavior and clearer error handling for initialization edge cases
- Signup path designed for immediate account usability without blocking email confirmation

## Subscription System and Feature Gating (Completed)

Implemented:
- Centralized plan definitions, limits, labels, and feature flags in frontend/lib/subscription.ts
- Three plans: Free Trial, Basic, Premium
- Subscription state hook in frontend/app/hooks/useSubscription.ts backed by frontend/app/api/subscription/route.ts
- Signup flow ensures a subscription row exists for new users

Feature gating:
- Analytics available on Basic and Premium
- Bulk actions available on Basic and Premium
- Multi-business access available on Premium
- Premium auto-reply available only on Premium

Limits and enforcement:
- Monthly AI generations and connected-business limits are centralized in shared constants
- Limit handling currently uses soft warnings rather than hard blocking
- Warning events are tracked in usage_events when users approach or exceed plan limits
- Current limits:
   - Free Trial: 100 AI generations/month, 1 connected business
   - Basic: 1000 AI generations/month, 1 connected business
   - Premium: 5000 AI generations/month, 3 connected businesses

## Premium Auto-Reply (Completed)

Implemented:
- Premium users can enable auto-reply from frontend/app/subscriptions/page.tsx
- Settings are stored on users via premium_auto_reply_enabled and premium_auto_reply_min_rating
- Default state is OFF, with a default minimum rating of 5 stars
- Premium auto-reply configuration is exposed via frontend/app/api/premium-auto-reply/route.ts

Observed analytics support:
- Premium analytics now report auto-reply attempted, posted, failed, and success rate metrics
- Auto-reply metrics are segmented per selected business in the analytics view

## UX Updates (Completed)

Login/signup improvements in frontend/app/login/page.tsx:
- Reduced excessive vertical spacing
- Iteratively tuned card width for better visual balance
- Preserved responsive behavior for mobile and desktop
- Added clearer spacing around primary and secondary auth actions
- Navbar auth links now open the correct auth mode on the shared login page

Forgot-password flow:
- Login now includes a "Forgot password?" action that links to `/reset-password`
- Reset requests use Supabase secure recovery email links
- Recovery links land on `/reset-password` where users can set a new password
- On successful reset, users are routed back to `/login?mode=login`

## API Surface Snapshot

Current route handlers under frontend/app/api: 21

Includes:
- auth/signup
- analytics
- analytics/internal
- analyze-review
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
- subscription
- sync-reviews

Notes:
- frontend/app/api/analytics/internal/route.ts is intended for internal admin usage analytics
- frontend/app/api/analytics/route.ts is the plan-gated customer-facing analytics endpoint

## What Was Recently Delivered

- Password-based signup/login implementation
- Google OAuth compatibility retained
- Signup endpoint and provisioning hardening
- Smart post-auth redirect by business count
- Centralized subscription config and plan-based feature gating
- Soft-limit subscription warnings and usage tracking
- Premium auto-reply settings with default-off behavior
- Premium analytics card for auto-reply attempted/posted/failed/success-rate metrics
- Login card layout and spacing refinements
- Forgot-password and reset-password flow implementation
- README updates to reflect the current implementation state

## Suggested Next Milestones

- Expand analytics depth beyond current KPI cards and pie charts
- Add callback success/failure toast states for Google connection flow
- Harden reliability around background automation and retry/failure workflows

## Key Files To Review

- README.md
- frontend/app/login/page.tsx
- frontend/app/reset-password/page.tsx
- frontend/app/api/auth/signup/route.ts
- frontend/app/api/ensure-user/route.ts
- frontend/lib/subscription.ts
- frontend/app/hooks/useSubscription.ts
- frontend/app/api/subscription/route.ts
- frontend/app/api/premium-auto-reply/route.ts
- frontend/app/dashboard/analytics/page.tsx
- frontend/app/subscriptions/page.tsx
- frontend/app/api/connect-google-business/route.ts
- frontend/app/api/google-callback/route.ts
- schema.sql
