export default function Features() {
  const features = [
    {
      icon: "🤖",
      title: "AI Generated Replies",
      desc: "Generate professional, brand-friendly responses to customer reviews in seconds."
    },
    {
      icon: "📊",
      title: "Review Analytics",
      desc: "Track ratings, volume, and trends to understand how your business is performing."
    },
    {
      icon: "💡",
      title: "AI Improvement Suggestions",
      desc: "Turn customer feedback into practical suggestions to improve service quality."
    },
    {
      icon: "🔗",
      title: "Google Business Integration",
      desc: "Connect your business profile and pull reviews into one clean dashboard."
    },
    {
      icon: "😊",
      title: "Sentiment Detection",
      desc: "Quickly understand customer satisfaction with AI-powered sentiment insights."
    },
    {
      icon: "⚡",
      title: "Faster Team Workflow",
      desc: "Help teams review, draft, and post replies faster without wasting effort."
    }
  ]

  return (
    <section id="features" className="scroll-mt-24 px-4 pt-4 pb-14 md:pt-6 md:pb-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 md:mb-12">
          <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-4">
            Everything you need in one place
          </div>

          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-3">
            Powerful features for smarter review management
          </h2>

          <p className="max-w-2xl mx-auto text-slate-600 text-base md:text-lg leading-7">
            Save time, respond faster, and learn from customer feedback with a cleaner AI-powered workflow.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={i}
              className="group rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-xl">
                {f.icon}
              </div>

              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {f.title}
              </h3>

              <p className="text-sm md:text-base leading-6 text-slate-600">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}