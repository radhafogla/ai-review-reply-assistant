# Production Readiness Checklist

Last updated: 2026-03-18

This checklist is intentionally split into Mandatory and Nice to Have so you can ship safely without losing momentum.

## Mandatory (Ship Blockers)

### 1) Environments and Project Separation

- Create a separate Supabase project for production.
- Keep dev and prod credentials fully isolated.
- Create a separate Vercel project (or clearly separated env sets) for production deployment.

Done when:
- Production app never points to dev Supabase.
- Production secrets are only stored in Vercel project environment variables.

### 2) Required Production Environment Variables

Set all required variables in Vercel Production environment.

Required:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- NEXTAUTH_SECRET
- NEXTAUTH_URL

Required if the feature is enabled in production:
- RESEND_API_KEY (contact form)
- NEXT_PUBLIC_SENTRY_DSN (error monitoring)

Done when:
- A production deployment can complete and start without runtime missing-env failures.

### 3) Supabase Schema and RLS Validation

- Apply schema.sql to the production Supabase database.
- Apply migrations from supabase/migrations in order.
- Validate Row Level Security policies for users, businesses, reviews, and replies.
- Verify service-role usage remains server-side only.

Done when:
- Schema parity between expected tables and production database is confirmed.
- Authenticated users can only read/write their own tenant-scoped data.

### 4) Auth and Redirect Configuration

- In Supabase Auth settings, add production site URL.
- Add production redirect URLs for login callbacks and password recovery.
- Ensure forgot-password flow redirects to production reset page.

Done when:
- Email/password login works in production.
- Forgot-password email opens production app and reset completes successfully.

### 5) Google OAuth and Google Business Profile Setup

- Configure Google OAuth consent screen for production.
- Add production callback URL in Google Cloud OAuth credentials.
- Ensure required Google Business Profile APIs are enabled in production Google project.

Done when:
- Connect Google completes in production.
- Locations can be fetched and saved from production app.

### 6) Build and Deploy Gate

Before promoting release:
- Run npm run lint in frontend.
- Run npm run build in frontend.
- Verify key user journeys in production deployment:
  - signup/login
  - connect business
  - sync reviews
  - generate reply
  - save/post reply

Done when:
- Build succeeds and smoke tests pass for core flows.

### 7) Basic Security and Operational Controls

- Rotate all placeholder or previously shared secrets.
- Ensure no secrets are committed in repository.
- Configure Vercel preview deployments to use non-production secrets.
- Restrict internal analytics endpoint access to admin-only logic.

Done when:
- Secret scanning and runtime behavior confirm no sensitive leakage.

## Nice to Have (Post-Launch Hardening)

### 1) Observability Maturity

- Configure Sentry release tracking and source map upload.
- Add alerting thresholds for API failures and auth errors.
- Track key business metrics with dashboards (reply success rate, sync failures, auto-reply outcomes).

### 2) Reliability Hardening

- Add retry strategy for failed post-reply operations.
- Add idempotency protection around high-risk write endpoints.
- Add background job visibility and dead-letter style handling for automation tasks.

### 3) Compliance and Governance Enhancements

- Expand privacy policy language for consent, data subject rights, retention, and processors.
- Add a simple GDPR request workflow with audit trail.
- Add documented incident response runbook.

### 4) Delivery and Quality Automation

- Add CI checks for lint and build on pull requests.
- Add integration tests for auth, Google connect, and reply posting flows.
- Add staged rollout strategy (for example, canary deployment) before full release.

### 5) Performance and Scale

- Add caching strategy for analytics-heavy views.
- Add rate limiting and abuse protection on public API surfaces.
- Load test key routes before major customer onboarding.

## Suggested Launch Sequence

1. Provision production Supabase and Vercel projects.
2. Configure production env vars from frontend/.env.production.example.
3. Apply schema and migrations to production database.
4. Configure Supabase + Google OAuth redirect URLs for production domain.
5. Run lint/build and execute smoke tests.
6. Go live with mandatory checklist complete.
7. Execute nice-to-have hardening in weekly iterations.
