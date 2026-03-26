'use client'

// TODO: Restore image carousel (VISUALS) when real screenshots are ready
// const VISUALS = [
//   { title: "Reply flow", src: "/landing/feature-replies.svg", alt: "AI reply workflow preview" },
//   { title: "Sentiment signal", src: "/landing/feature-sentiment.svg", alt: "Sentiment analysis preview" },
//   { title: "Trend movement", src: "/landing/feature-trends.svg", alt: "Trend analytics preview" },
// ]

export default function Features() {
  const features = [
    {
      title: "Revidew Inbox",
      desc: "All incoming reviews in one clean queue.",
      status: "Live now",
    },
    {
      title: "Reply Studio",
      desc: "Generate, edit, and publish replies quickly.",
      status: "Live now",
    },
    {
      title: "Negative Review Alerts",
      desc: "Get email alerts for new low-star reviews so your team can respond fast.",
      status: "Live now",
    },
    {
      title: "Brand Voice Templates",
      desc: "Set reply tone to Professional, Friendly, Casual, or Apologetic and keep responses consistent.",
      status: "Live now",
    },
    {
      title: "Team Collaboration",
      desc: "Invite owners, managers, responders, and viewers so each business can work with the right access level.",
      status: "Live now",
    },
    {
      title: "Sentiment Radar and Action Coach",
      desc: "Run manual analysis across synced reviews and turn recurring review themes into AI suggestions and trend views.",
      status: "Live now",
    },
  ]

  const workflowSteps = [
    {
      title: "Connect",
      desc: "Link your Google Business profile and keep reviews flowing into one command center with manual and scheduled sync coverage.",
    },
    {
      title: "Respond",
      desc: "Create polished replies in seconds with your selected brand voice, then edit and publish with full control.",
    },
    {
      title: "Understand",
      desc: "Break down sentiment on demand and unlock recurring themes and premium insight layers as your review set grows.",
    },
    {
      title: "Improve",
      desc: "Apply AI suggestions from premium analytics to fix root issues and boost customer happiness over time.",
    },
  ]

  return (
    <section id="features" className="scroll-mt-24 px-4 pb-16 pt-8 md:pb-20 md:pt-12">
      <div className="mx-auto max-w-6xl">
        {/* Intro Section */}
        <div className="mb-14 text-center md:mb-16">
          <div className="mb-4 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold" style={{ borderColor: 'var(--primary-200)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)' }}>
            Meet your review command center
          </div>

          <h2 className="mb-3 text-3xl font-black tracking-tight md:text-5xl" style={{ color: 'var(--neutral-900)' }}>
            Respond faster. Understand deeper.
          </h2>

          <p className="mx-auto max-w-2xl text-base leading-7 md:text-lg" style={{ color: 'var(--neutral-600)' }}>
            One dashboard for managing reviews, applying your brand voice, running manual sentiment analysis, and acting quickly when negative feedback arrives.
          </p>
        </div>

        {/* Before / After Comparison */}
        <div className="mx-auto mb-16 grid max-w-4xl gap-4 md:grid-cols-2">
          <div className="rounded-2xl p-6 shadow-sm" style={{ borderColor: 'var(--neutral-200)', borderWidth: '1px', backgroundColor: 'var(--neutral-50)' }}>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--neutral-400)' }}>Without Revidew</p>
            <ul className="space-y-3 text-base leading-6" style={{ color: 'var(--neutral-500)' }}>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-base" style={{ color: 'var(--neutral-400)' }}>✗</span>
                Reviews scattered across tabs and apps
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-base" style={{ color: 'var(--neutral-400)' }}>✗</span>
                Negative feedback sits unanswered for days
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-base" style={{ color: 'var(--neutral-400)' }}>✗</span>
                Hours spent writing replies from scratch
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-base" style={{ color: 'var(--neutral-400)' }}>✗</span>
                No idea what themes keep coming up
              </li>
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm" style={{ borderColor: 'var(--primary-200)', borderWidth: '1px' }}>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--primary-500)' }}>With Revidew</p>
            <ul className="space-y-3 text-base leading-6" style={{ color: 'var(--neutral-700)' }}>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-base" style={{ color: 'var(--primary-500)' }}>✓</span>
                Every review in one clean dashboard
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-base" style={{ color: 'var(--primary-500)' }}>✓</span>
                Instant email alerts on low-star reviews
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-base" style={{ color: 'var(--primary-500)' }}>✓</span>
                AI-drafted replies in your brand voice, published in seconds
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-base" style={{ color: 'var(--primary-500)' }}>✓</span>
                Sentiment analysis surfaces recurring patterns
              </li>
            </ul>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mb-16">
          <h3 className="mb-6 text-2xl font-bold" style={{ color: 'var(--neutral-900)' }}>Available features</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl bg-white/95 p-5 shadow-sm transition duration-200"
                style={{ borderColor: 'var(--neutral-200)', borderWidth: '1px' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--primary-200)';
                  e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--neutral-200)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                }}
              >

                <h4 className="mb-1 text-base font-bold" style={{ color: 'var(--neutral-900)' }}>{f.title}</h4>

                <p className="text-base leading-6" style={{ color: 'var(--neutral-600)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Section */}
        <div className="mb-16 rounded-3xl p-6 shadow-md md:p-10" style={{ borderColor: 'var(--neutral-200)', borderWidth: '1px', backgroundImage: `linear-gradient(to bottom right, var(--neutral-50), color-mix(in srgb, var(--neutral-100) 50%, transparent))` }}>
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--primary-600)' }}>The Revidew workflow</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight md:text-3xl" style={{ color: 'var(--neutral-900)' }}>
                Four repeatable steps to running feedback smarter
              </h3>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="rounded-2xl bg-white p-5 shadow-sm" style={{ borderColor: 'var(--neutral-200)', borderWidth: '1px' }}>
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--primary-100)' }}>
                  <span className="text-sm font-bold" style={{ color: 'var(--primary-600)' }}>{index + 1}</span>
                </div>
                <h4 className="mb-2 text-base font-bold" style={{ color: 'var(--neutral-900)' }}>{step.title}</h4>
                <p className="text-base leading-6" style={{ color: 'var(--neutral-600)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="rounded-3xl p-8 text-center md:p-10" style={{ backgroundColor: 'var(--neutral-900)', color: 'white' }}>
          <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--primary-200)' }}>Ready to take control?</p>
          <h3 className="mx-auto mt-2 max-w-3xl text-2xl font-black tracking-tight md:text-3xl">
            Start your free trial and see how Revidew transforms your review workflow.
          </h3>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/login?mode=signup"
              className="inline-flex min-w-44 items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition"
              style={{ backgroundColor: 'var(--primary-500)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-400)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-500)')}
            >
              Start free
            </a>
            <a
              href="/contact"
              className="inline-flex min-w-44 items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition"
              style={{ borderColor: 'var(--neutral-400)', borderWidth: '1px', color: 'var(--neutral-100)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-300)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--neutral-400)';
                e.currentTarget.style.color = 'var(--neutral-100)';
              }}
            >
              Get in touch
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
