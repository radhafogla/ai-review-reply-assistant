import Link from "next/link"

const PrivacyPolicyPage = () => {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-10 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-600">Last updated: March 18, 2026</p>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1. Information We Collect</h2>
          <p className="leading-7 text-slate-700">
            We collect account details such as your name, email address, and authentication identifiers. If you connect
            Google Business Profile, we also process business profile metadata and customer review content needed to
            generate and post replies.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2. How We Use Information</h2>
          <p className="leading-7 text-slate-700">
            We use your information to provide core product features, including syncing reviews, generating AI-assisted
            reply suggestions, saving drafts, and posting approved responses. We may also use aggregated analytics to
            improve product performance and reliability.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">3. Legal Bases For Processing (GDPR)</h2>
          <p className="leading-7 text-slate-700">
            Where the General Data Protection Regulation (GDPR) applies, we process personal data under one or more
            legal bases: performance of a contract (to provide the service you request), legitimate interests (for
            security, fraud prevention, and service reliability), compliance with legal obligations, and consent where
            required.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Data Sharing and Third-Party Services</h2>
          <p className="leading-7 text-slate-700">
            We do not sell your personal data. We share data only with service providers required to operate the app,
            such as hosting, authentication, and AI processing providers, and only for business purposes aligned with
            this policy.
          </p>
          <p className="leading-7 text-slate-700">
            Depending on enabled features, these providers can include Supabase (authentication and database), Google
            Business Profile APIs (business and review access), OpenAI (AI-assisted reply generation), Resend (email
            workflows), and Sentry (error monitoring).
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Data Retention</h2>
          <p className="leading-7 text-slate-700">
            We retain data while your account is active or as needed to provide the service, comply with legal
            obligations, resolve disputes, and enforce agreements.
          </p>
          <p className="leading-7 text-slate-700">
            Review text, generated replies, and related analytics may be retained until account deletion or until you
            request deletion, subject to legal and operational requirements.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. International Data Transfers</h2>
          <p className="leading-7 text-slate-700">
            Your data may be processed in countries outside your own. Where required, we use appropriate safeguards for
            cross-border transfers, such as contractual protections and provider commitments.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Security</h2>
          <p className="leading-7 text-slate-700">
            We use reasonable administrative, technical, and organizational safeguards to protect your data. No system
            is completely secure, but we continuously monitor and improve our security practices.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">8. Your Rights and Choices</h2>
          <p className="leading-7 text-slate-700">
            You can request access, correction, or deletion of your account data, subject to applicable law. You may
            also disconnect integrations at any time.
          </p>
          <p className="leading-7 text-slate-700">
            If GDPR applies, you may also have rights to portability, objection, and restriction of processing. You can
            also lodge a complaint with your local supervisory authority.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">9. Contact Us</h2>
          <p className="leading-7 text-slate-700">
            For privacy-related questions, contact us at privacy@reviewai.com.
          </p>
          <p className="text-sm text-slate-600">
            For product support, billing, or technical help, use our {" "}
            <Link href="/contact" className="font-semibold text-blue-700 hover:text-blue-800">
              Contact Us form
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  )
}

export default PrivacyPolicyPage