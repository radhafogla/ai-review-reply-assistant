import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Suppresses Sentry CLI output during builds
  silent: !process.env.CI,

  // Upload source maps so Sentry can show un-minified stack traces
  // Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT in env (optional)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  // Automatically instrument Next.js data-fetching and API routes
  webpack: {
    autoInstrumentServerFunctions: true,
    autoInstrumentAppDirectory: true,
  },
});
