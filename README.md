# AI Review Reply Assistant

AI Review Reply Assistant is a Next.js application for connecting Google Business Profile locations, syncing reviews, generating AI-assisted replies, posting responses back to Google, and tracking review workflow state in Supabase.

## What It Does

- Connects one or more Google Business Profile locations to a user account
- Syncs Google reviews into Supabase
- Generates draft replies with OpenAI
- Lets users edit drafts before posting them
- Tracks reply source and status across `draft`, `posted`, `failed`, and `deleted`
- Surfaces analytics and workflow views for reviews that need attention versus already posted replies
- Includes subscription-based feature gating for analytics, bulk actions, and multi-business support
- Captures structured API logs and Sentry error reports for server-side failures
- Provides a contact form backed by Supabase and Resend

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

1. A user signs in with Supabase-authenticated Google login.
2. The app ensures a matching row exists in the local `users` table.
3. The user connects a Google Business Profile account and saves one or more locations.
4. Reviews are synced into Supabase.
5. AI-generated draft replies are created with OpenAI.
6. The user can edit the draft, save it as a user-authored draft, or post it directly.
7. Posted replies are persisted with the correct source (`ai` or `user`) and shown in the dashboard.
8. Deleted replies can be reviewed and re-posted.

## Feature Tiers

The app currently supports three plans:

- `free`: AI generation only
- `basic`: AI generation, analytics, bulk actions
- `premium`: AI generation, analytics, bulk actions, multi-business support

The feature gates live in [frontend/lib/subscription.ts](frontend/lib/subscription.ts).

## API Surface

The app currently exposes 18 route handlers under [frontend/app/api](frontend/app/api):

- `analytics`
- `analyze-review`
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
- `post-reply`
- `save-business`
- `save-reply`
- `subscription`
- `sync-reviews`

All API routes use structured request/error logging through [frontend/lib/apiLogger.ts](frontend/lib/apiLogger.ts).

## Database Overview

The baseline schema is in [schema.sql](schema.sql). The main tables are:

- `users`: application-level user profile and plan state
- `subscriptions`: current and historical subscription records
- `integrations`: provider tokens and token metadata
- `businesses`: connected business locations
- `reviews`: synced Google reviews
- `review_replies`: generated, edited, posted, failed, and deleted replies
- `review_analysis`: AI sentiment and summary results
- `usage_events`: authoritative server-side usage tracking for key product actions
- `contact_submissions`: contact form submissions

There is also a Supabase migration in [supabase/migrations/20260317_add_deleted_review_reply_status.sql](supabase/migrations/20260317_add_deleted_review_reply_status.sql).

## Environment Variables

Create `frontend/.env.local` with values for the following:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_SENTRY_DSN=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

Notes:

- `NEXT_PUBLIC_SENTRY_DSN` is enough for Sentry error capture.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are optional and only needed if you want source map upload during builds.
- `RESEND_API_KEY` is required for the contact form email notification flow.
- `SUPABASE_SERVICE_ROLE_KEY` is used by privileged server-side flows.

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

## Deployment Notes

This project is structured to deploy the Next.js app from the `frontend` directory.

Before production deployment, make sure:

- Supabase environment variables are set in your host
- Google OAuth redirect URIs match the deployed URL
- Resend is configured with a valid sender strategy
- Sentry DSN is set in production
- Optional Sentry source map variables are added if you want readable production stack traces

## Current Documentation Scope

This README covers the application as it exists in the repository today. If you add billing, background jobs, cron sync, or admin tooling later, extend this document so setup and operational expectations stay accurate.
