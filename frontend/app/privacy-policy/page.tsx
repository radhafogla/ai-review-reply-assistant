import Link from "next/link"

const PrivacyPolicyPage = () => {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-10 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-600">Last updated: January 1, 2026</p>

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
          <h2 className="text-xl font-semibold text-slate-900">3. Data Sharing and Third-Party Services</h2>
          <p className="leading-7 text-slate-700">
            We do not sell your personal data. We share data only with service providers required to operate the app,
            such as hosting, authentication, and AI processing providers, and only for business purposes aligned with
            this policy.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">4. Data Retention</h2>
          <p className="leading-7 text-slate-700">
            We retain data while your account is active or as needed to provide the service, comply with legal
            obligations, resolve disputes, and enforce agreements.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">5. Security</h2>
          <p className="leading-7 text-slate-700">
            We use reasonable administrative, technical, and organizational safeguards to protect your data. No system
            is completely secure, but we continuously monitor and improve our security practices.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">6. Your Choices</h2>
          <p className="leading-7 text-slate-700">
            You can request access, correction, or deletion of your account data, subject to applicable law. You may
            also disconnect integrations at any time.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">7. Contact Us</h2>
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