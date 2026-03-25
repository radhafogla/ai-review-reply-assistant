# Revidew

Revidew is a review operations workspace for Google Business Profile teams. It helps businesses connect locations, sync reviews into one dashboard, generate AI-assisted replies, post responses back to Google, and track review workflow state in Supabase.

The current product is strongest for single-location businesses and growing teams, with support for multi-business accounts, role-based collaboration, negative review alerts, and premium analytics layers.

## Product Snapshot

- Connect one or more Google Business Profile locations to a user account
- Sign in with email/password or Google OAuth
- Sync Google reviews into a central review inbox
- Generate AI draft replies with configurable brand voice
- Edit drafts before posting them live to Google
- Track reply source and status across `draft`, `posted`, `failed`, and `deleted`
- Separate reviews that need attention from already posted and deleted work
- Run sentiment analysis and unlock premium themes, suggestions, and trend views
- Send negative review email alerts with direct dashboard CTA links
- Support business-scoped team collaboration with owner, manager, responder, and viewer access
- Apply subscription gating for analytics, bulk actions, multi-business support, and premium auto-reply
- Capture structured API logs and Sentry error reports for server-side failures

## Who It's For

- Local businesses that want a faster review response workflow
- Small teams that need shared access to review operations without losing control over permissions
- Multi-location operators who want one place to sync, review, and respond across connected businesses

## Tech Stack

- Frontend: Next.js App Router, React, TypeScript
- Styling: Tailwind utilities plus inline dashboard styling
- Auth and database: Supabase
- AI: OpenAI
- Email: Resend
- Monitoring: Structured JSON API logs and Sentry
- Charts: Recharts

## Repository Layout

```text
.
|-- README.md
|-- schema.sql
|-- frontend/
|   |-- app/
|   |   |-- api/
|   |   |-- components/
|   |   |-- dashboard/
|   |   |-- connect-business/
|   |   |-- login/
|   |   `-- verify-email/
|   |-- lib/
|   |-- public/
|   |-- sentry.client.config.ts
|   |-- sentry.server.config.ts
|   `-- sentry.edge.config.ts
`-- supabase/
	`-- migrations/
```

## Main User Flow

1. A user signs in with Supabase using either email/password or Google OAuth.
2. The app ensures a matching row exists in the local `users` table.
3. After auth, the app routes users with at least one connected business to `/dashboard`; otherwise to `/connect-business`.
4. Reviews are synced into Supabase.
5. AI-generated draft replies are created with OpenAI.
6. The user can edit the draft, save it as a user-authored draft, or post it directly.
7. Posted replies are persisted with the correct source (`ai` or `user`) and shown in the dashboard.
8. Deleted replies can be reviewed and re-posted.

## Feature Tiers

The app currently supports three plans:

- `free`: AI generation, negative review email alerts, single-business setup
- `basic`: AI generation, analytics, bulk actions, and multi-business support
- `premium`: AI generation, analytics, bulk actions, multi-business support, premium insights, and premium auto-reply

The feature gates live in [frontend/lib/subscription.ts](frontend/lib/subscription.ts).

## API Surface

The app currently exposes route handlers under [frontend/app/api](frontend/app/api) for:

- `analytics`
- `analytics/internal`
- `analyze-review`
- `analyze-reviews`
- `auto-generate-reply`
- `auth/signup`
- `connect-google-business`
- `contact`
- `delete-account`
- `delete-data`
- `delete-reply`
- `ensure-user`
- `generate-reply`
- `get-latest-reply`
- `get-reviews`
- `google-callback`
- `google-locations`
- `inngest` (webhook for Inngest orchestration)
- `post-reply`
- `premium-auto-reply`
- `reply-tone`
- `save-business`
- `save-reply`
- `sentiment-cache`
- `subscription`
- `sync-reviews`
- `team-members`
- `test-negative-review-email` (non-production only)

## Recent Auth And UX Updates

- Replaced passwordless-only entry with first-class email/password login and signup in [frontend/app/login/page.tsx](frontend/app/login/page.tsx)
- Added server-side signup route at [frontend/app/api/auth/signup/route.ts](frontend/app/api/auth/signup/route.ts) using Supabase admin create-user flow with immediate account usability
- Hardened user provisioning in [frontend/app/api/ensure-user/route.ts](frontend/app/api/ensure-user/route.ts) to better handle duplicate-email and initialization edge cases
- Added smart post-auth routing so users with an existing business land on `/dashboard`, otherwise on `/connect-business`
- Added forgot-password entry from login and a dedicated reset flow at `/reset-password`
- Improved login card layout to reduce vertical scrolling and tighten top spacing

All API routes use structured request/error logging through [frontend/lib/apiLogger.ts](frontend/lib/apiLogger.ts).

## Database Overview

The baseline schema is in [schema.sql](schema.sql). The main tables are:

- `users`: application-level user profile and plan state
- `subscriptions`: current and historical subscription records
- `integrations`: provider tokens and token metadata
- `businesses`: connected business locations (includes `sync_status`, `sync_error`, and `last_synced_at` for tracking automated syncs)
- `reviews`: synced Google reviews
- `review_replies`: generated, edited, posted, failed, and deleted replies
- `review_analysis`: AI sentiment and summary results
- `usage_events`: authoritative server-side usage tracking for key product actions
- `business_members`: per-business team membership and roles
- `contact_submissions`: contact form submissions

The current baseline migration is [supabase/migrations/20260317_000000_baseline_schema.sql](supabase/migrations/20260317_000000_baseline_schema.sql).

## Environment Variables

Create `frontend/.env.local` with values for the following:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
SENTRY_ENVIRONMENT=development

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_STATE_SECRET=

NEXT_PUBLIC_SITE_URL=http://localhost:3000
REVIEW_ALERT_FROM_EMAIL=

INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
INNGEST_SYNC_REVIEWS_CRON=0 */6 * * *
```

Notes:

- `NEXT_PUBLIC_SENTRY_DSN` is enough for Sentry error capture.
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT` and `SENTRY_ENVIRONMENT` should be set per environment (`development`, `preview`, `production`) so Sentry alerts can be filtered correctly.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are optional and only needed if you want source map upload during builds.
- `RESEND_API_KEY` is required for the contact form email notification flow.
- `REVIEW_ALERT_FROM_EMAIL` is optional but recommended for branded negative-review alert emails.
- `SUPABASE_SERVICE_ROLE_KEY` is used by privileged server-side flows.
- `NEXT_PUBLIC_SITE_URL` is used for absolute links in emails and callbacks.
- `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are obtained from your [Inngest dashboard](https://app.inngest.com) and required for background sync jobs. Set these for production deployments to Vercel.
- `INNGEST_SYNC_REVIEWS_CRON` controls the recurring sync schedule (cron expression). If omitted, the default is `0 */6 * * *` (every 6 hours).

## Local Development

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure Supabase

Apply the schema in [schema.sql](schema.sql) to your Supabase project. If you are using Supabase CLI migrations, also apply the files in [supabase/migrations](supabase/migrations).

### 3. Configure Google Business Profile OAuth

Set the Google client ID and secret in `frontend/.env.local`, and ensure your Google OAuth redirect URI matches the callback route used by the app.

### 4. Start the app

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
cd frontend
npm run dev
npm run build
npm run start
npm run lint
npm test
```

## Monitoring And Logging

- Server-side API errors are sent to Sentry via the shared logger in [frontend/lib/apiLogger.ts](frontend/lib/apiLogger.ts)
- API request and error logs are also written as structured JSON to the runtime console
- Core business actions are persisted into `usage_events` via [frontend/lib/usageTracking.ts](frontend/lib/usageTracking.ts)
- `requestId` is included to make it easier to correlate failures across logs

## Important Implementation Notes

- `generate-reply` creates AI drafts in `review_replies`
- `save-reply` converts the reply source to `user` when the draft is edited
- `post-reply` now persists the actual submitted text and preserves `ai` only when the text is unchanged
- The dashboard separates reviews into `needs attention`, `posted`, and `deleted` lanes
- `reply-tone` stores the default business reply tone, which now defaults to `casual` in app logic
- Negative review email alerts are generated from `syncReviewsCore` and can be test-triggered outside production from Settings

## Automated Review Sync with Inngest

The app uses [Inngest](https://inngest.com) for orchestrated background sync of Google reviews and premium auto-reply generation. This replaces manual polling with event-driven and scheduled automation.

### How It Works

- **Initial sync on connect**: When a user connects a Google Business location via `/api/save-business`, an Inngest event `reviews/sync.requested` is queued, triggering an immediate review sync ([frontend/inngest/functions/syncReviews.ts](frontend/inngest/functions/syncReviews.ts)).
- **Scheduled recurring sync**: Every 6 hours, a cron job queries all connected Google locations and fans out individual sync events, ensuring reviews stay current.
- **Retry & backoff**: Each sync event retries up to 3 times with automatic backoff, and includes failure observability via structured logs and sync status tracked on the `businesses` table.

### Core Implementation

- **Sync function**: [frontend/lib/syncReviewsCore.ts](frontend/lib/syncReviewsCore.ts) contains the shared sync logic (review fetch, dedup, upsert, premium auto-reply, and email notifications).
- **HTTP route wrapper**: [frontend/app/api/sync-reviews/route.ts](frontend/app/api/sync-reviews/route.ts) is now a thin auth layer that delegates to the core function.
- **Inngest functions**: [frontend/inngest/functions/syncReviews.ts](frontend/inngest/functions/syncReviews.ts) defines the event handler and scheduled cron.
- **Inngest serve route**: [frontend/app/api/inngest/route.ts](frontend/app/api/inngest/route.ts) exposes the Inngest webhook handler.

### Local Development

Inngest dev mode runs in your terminal. To test background jobs locally:

```bash
cd frontend
npm run dev

# In another terminal
npx inngest-cli dev
```

Events sent from `/api/save-business` or manually via the dashboard will appear in the dev UI at `http://localhost:8288`.

### Production Deployment (Vercel)

1. **Create an Inngest account**: Visit [app.inngest.com](https://app.inngest.com), sign up, and create a workspace.
2. **Get signing keys**: In your Inngest workspace → Settings → API Keys, copy the `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`.
3. **Set environment variables**: Add both keys to your Vercel production environment variables.
4. **Connect Vercel app**: Point your Inngest integration to the deployed Vercel URL (e.g., `https://your-app.vercel.app`), which will serve the webhook at `/api/inngest`.
5. **Verify**: After deploy, Inngest will automatically discover your functions and begin executing scheduled jobs.

## Deployment Notes

This project is structured to deploy the Next.js app from the `frontend` directory.

Before production deployment, make sure:

- Supabase environment variables are set in your host
- Supabase schema migrations are applied separately from the Vercel app deploy
- Google OAuth redirect URIs match the deployed URL
- Resend is configured with a valid sender strategy
- Sentry DSN is set in production
- Sentry environment variables are set so production and non-production events are separated
- Optional Sentry source map variables are added if you want readable production stack traces

## Production Rollout Guide

- Prioritized launch checklist: [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md)
- Production env template: [frontend/.env.production.example](frontend/.env.production.example)

The production checklist is split into:

- Mandatory (ship blockers)
- Nice to have (post-launch hardening)

## Current Documentation Scope

This README covers the application as it exists in the repository today. If you add billing, background jobs, cron sync, or admin tooling later, extend this document so setup and operational expectations stay accurate.
