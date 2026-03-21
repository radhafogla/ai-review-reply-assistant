'use client'

import Image from "next/image"
import { useState, useEffect } from "react"

const VISUALS = [
  {
    title: "Reply flow",
    src: "/landing/feature-replies.svg",
    alt: "AI reply workflow preview",
  },
  {
    title: "Sentiment signal",
    src: "/landing/feature-sentiment.svg",
    alt: "Sentiment analysis preview",
  },
  {
    title: "Trend movement",
    src: "/landing/feature-trends.svg",
    alt: "Trend analytics preview",
  },
]

export default function Features() {
  const features = [
    {
      title: "Revora Inbox",
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
      desc: "Set reply tone to Professional, Friendly, or Apologetic and keep responses consistent.",
      status: "Live now",
    },
    {
      title: "Sentiment Radar",
      desc: "Run manual analysis across synced reviews and cache a fresh sentiment breakdown.",
      status: "Live now",
    },
    {
      title: "Action Coach",
      desc: "Premium analytics turn recurring review themes into AI suggestions and trend views.",
      status: "Live now",
    },
  ]

  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % VISUALS.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const goToImage = (index: number) => {
    setCurrentImageIndex(index)
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % VISUALS.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + VISUALS.length) % VISUALS.length)
  }

  const workflowSteps = [
    {
      title: "Connect",
      desc: "Link your Google Business profile and sync reviews into a single command center.",
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

        {/* Primary Visual Showcase */}
        <div className="mx-auto mb-16 max-w-3xl overflow-hidden rounded-2xl bg-white shadow-sm" style={{ borderColor: 'var(--neutral-200)', borderWidth: '1px' }}>
          <div className="relative aspect-[600/390] w-full overflow-hidden">
            {VISUALS.map((visual, index) => {
              let translateClass = "translate-x-full"
              if (index === currentImageIndex) {
                translateClass = "translate-x-0"
              } else if (index < currentImageIndex) {
                translateClass = "-translate-x-full"
              }
              return (
                <div
                  key={visual.title}
                  className={`absolute inset-0 transition-transform duration-500 ease-out ${translateClass}`}
                >
                  <Image
                    src={visual.src}
                    alt={visual.alt}
                    fill
                    className="h-auto w-full object-cover"
                  />
                </div>
              )
            })}
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full transition"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', color: 'var(--neutral-700)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary-500)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                e.currentTarget.style.color = 'var(--neutral-700)';
              }}
              aria-label="Previous image"
            >
              <span className="text-lg font-bold">&lt;</span>
            </button>

            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full transition"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', color: 'var(--neutral-700)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary-500)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                e.currentTarget.style.color = 'var(--neutral-700)';
              }}
              aria-label="Next image"
            >
              <span className="text-lg font-bold">&gt;</span>
            </button>

          </div>

          <div className="px-4 py-3" style={{ borderTopColor: 'var(--neutral-100)', borderTopWidth: '1px' }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: 'var(--neutral-700)' }}>{VISUALS[currentImageIndex].title}</p>
            </div>
            <div className="flex gap-2">
              {VISUALS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToImage(index)}
                  className="h-2 w-2 rounded-full transition-colors"
                  style={{
                    backgroundColor: index === currentImageIndex ? 'var(--primary-500)' : 'var(--neutral-300)'
                  }}
                  onMouseEnter={(e) => {
                    if (index !== currentImageIndex) {
                      e.currentTarget.style.backgroundColor = 'var(--neutral-400)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (index !== currentImageIndex) {
                      e.currentTarget.style.backgroundColor = 'var(--neutral-300)';
                    }
                  }}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
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
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide" style={{ borderColor: 'var(--neutral-200)', backgroundColor: 'var(--neutral-50)', color: 'var(--neutral-500)' }}>
                    Module
                  </span>
                  <span
                    className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      borderColor: f.status === "Live now" ? 'var(--success-200)' : 'var(--warning-200)',
                      backgroundColor: f.status === "Live now" ? 'var(--success-50)' : 'var(--warning-50)',
                      color: f.status === "Live now" ? 'var(--success-700)' : 'var(--warning-700)'
                    }}
                  >
                    {f.status}
                  </span>
                </div>

                <h4 className="mb-1 text-base font-bold" style={{ color: 'var(--neutral-900)' }}>{f.title}</h4>

                <p className="text-sm leading-5" style={{ color: 'var(--neutral-600)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Section */}
        <div className="mb-16 rounded-3xl p-6 shadow-md md:p-10" style={{ borderColor: 'var(--neutral-200)', borderWidth: '1px', backgroundImage: `linear-gradient(to bottom right, var(--neutral-50), color-mix(in srgb, var(--neutral-100) 50%, transparent))` }}>
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--primary-600)' }}>The Revora workflow</p>
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
                <p className="text-sm leading-5" style={{ color: 'var(--neutral-600)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="rounded-3xl p-8 text-center md:p-10" style={{ backgroundColor: 'var(--neutral-900)', color: 'white' }}>
          <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--primary-200)' }}>Ready to take control?</p>
          <h3 className="mx-auto mt-2 max-w-3xl text-2xl font-black tracking-tight md:text-3xl">
            Start your free trial and see how Revora transforms your review workflow.
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
