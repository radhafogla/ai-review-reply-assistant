"use client"

import { useState, useEffect, type FormEvent } from "react"
import { supabase } from "@/lib/supabaseClient"

const SUBJECTS = [
  "General Question",
  "Bug Report",
  "Billing & Subscription",
  "Feature Request",
  "Privacy & Data",
  "Other",
]

export default function ContactPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    async function prefill() {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user?.email) {
        setEmail(data.session.user.email)
      }
    }
    prefill()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setStatus("idle")
    setErrorMsg("")

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong.")
        setStatus("error")
      } else {
        setStatus("success")
        setName("")
        setMessage("")
        setSubject(SUBJECTS[0])
      }
    } catch {
      setErrorMsg("Network error. Please try again or email us directly.")
      setStatus("error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <div style={{ maxWidth: 1680, margin: "0 auto", padding: "32px 24px 40px" }}>
        {/* Header Card */}
        <section
          style={{
            marginBottom: 24,
            borderRadius: 20,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
          }}
        >
          {/* Dark banner */}
          <div style={{ backgroundColor: "#0f172a", padding: "24px 32px" }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#fcd34d",
                margin: 0,
              }}
            >
              We&apos;re here to help
            </p>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: "#ffffff",
                margin: "8px 0 0",
                letterSpacing: "-0.5px",
              }}
            >
              Contact Us
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "#94a3b8",
                marginTop: 6,
                maxWidth: 560,
              }}
            >
              Fill in the form below and we&apos;ll get back to you as soon as possible.
            </p>
          </div>

          {/* Two-column layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 340px",
              gap: 32,
              padding: "32px",
            }}
          >
            {/* Left: Form */}
            <div>
              {status === "success" ? (
                <div
                  style={{
                    borderRadius: 14,
                    border: "1.5px solid #bbf7d0",
                    backgroundColor: "#f0fdf4",
                    padding: "28px 24px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      backgroundColor: "#22c55e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 16px",
                    }}
                  >
                    <svg
                      width={24}
                      height={24}
                      fill="none"
                      stroke="#fff"
                      strokeWidth={2.5}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#15803d",
                      margin: "0 0 8px",
                    }}
                  >
                    Message sent!
                  </h3>
                  <p style={{ fontSize: 14, color: "#16a34a", margin: 0 }}>
                    Thanks for reaching out. We&apos;ll get back to you shortly.
                  </p>
                  <button
                    onClick={() => setStatus("idle")}
                    style={{
                      marginTop: 20,
                      padding: "8px 20px",
                      borderRadius: 10,
                      border: "none",
                      backgroundColor: "#22c55e",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Name + Email row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          color: "#64748b",
                          marginBottom: 8,
                        }}
                      >
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Smith"
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          border: "1.5px solid #e2e8f0",
                          borderRadius: 10,
                          fontSize: 14,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #2563eb")}
                        onBlur={(e) => (e.currentTarget.style.border = "1.5px solid #e2e8f0")}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          color: "#64748b",
                          marginBottom: 8,
                        }}
                      >
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          border: "1.5px solid #e2e8f0",
                          borderRadius: 10,
                          fontSize: 14,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #2563eb")}
                        onBlur={(e) => (e.currentTarget.style.border = "1.5px solid #e2e8f0")}
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#64748b",
                        marginBottom: 8,
                      }}
                    >
                      Subject
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "1.5px solid #e2e8f0",
                        borderRadius: 10,
                        fontSize: 14,
                        backgroundColor: "#ffffff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                      onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #2563eb")}
                      onBlur={(e) => (e.currentTarget.style.border = "1.5px solid #e2e8f0")}
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#64748b",
                        marginBottom: 8,
                      }}
                    >
                      Message
                    </label>
                    <textarea
                      required
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your question or issue in detail..."
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "1.5px solid #e2e8f0",
                        borderRadius: 10,
                        fontSize: 14,
                        outline: "none",
                        resize: "vertical",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                      onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #2563eb")}
                      onBlur={(e) => (e.currentTarget.style.border = "1.5px solid #e2e8f0")}
                    />
                  </div>

                  {status === "error" && (
                    <div
                      style={{
                        borderRadius: 10,
                        border: "1.5px solid #fecaca",
                        backgroundColor: "#fef2f2",
                        padding: "12px 16px",
                        fontSize: 13,
                        color: "#dc2626",
                      }}
                    >
                      {errorMsg}
                    </div>
                  )}

                  <div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        padding: "11px 28px",
                        borderRadius: 10,
                        border: "none",
                        backgroundColor: isSubmitting ? "#94a3b8" : "#2563eb",
                        color: "#ffffff",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSubmitting)
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1d4ed8"
                      }}
                      onMouseLeave={(e) => {
                        if (!isSubmitting)
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#2563eb"
                      }}
                    >
                      {isSubmitting ? "Sending..." : "Send Message"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Right: Info sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Email fallback */}
              <div
                style={{
                  borderRadius: 14,
                  border: "1.5px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  padding: "20px",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#64748b",
                    margin: "0 0 10px",
                  }}
                >
                  Email us directly
                </p>
                <a
                  href="mailto:support@revidew.com"
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#2563eb",
                    textDecoration: "none",
                  }}
                >
                  support@revidew.com
                </a>
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
                  We typically respond within 1 business day.
                </p>
              </div>

              {/* Response time */}
              <div
                style={{
                  borderRadius: 14,
                  border: "1.5px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  padding: "20px",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#64748b",
                    margin: "0 0 10px",
                  }}
                >
                  Common topics
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "Billing & subscription changes",
                    "Connecting Google Business",
                    "AI reply quality",
                    "Account deletion requests",
                    "Privacy & data questions",
                  ].map((topic) => (
                    <li
                      key={topic}
                      style={{ fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: "#2563eb",
                          flexShrink: 0,
                        }}
                      />
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
