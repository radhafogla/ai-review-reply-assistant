'use client'

import Link from "next/link"

const Footer = () => {
  return (
    <footer className="backdrop-blur-sm" style={{ borderTopColor: 'color-mix(in srgb, var(--neutral-200) 80%, transparent)', borderTopWidth: '1px', backgroundColor: 'color-mix(in srgb, white 75%, transparent)' }}>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-sm sm:flex-row sm:px-6 lg:px-8" style={{ color: 'var(--neutral-600)' }}>
        <p>© 2026 Revora. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link
            href="/contact"
            className="font-medium transition"
            style={{ color: 'var(--primary-700)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-800)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--primary-700)')}
          >
            Contact Us
          </Link>
          <Link
            href="/privacy-policy"
            className="font-medium transition"
            style={{ color: 'var(--primary-700)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-800)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--primary-700)')}
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default Footer