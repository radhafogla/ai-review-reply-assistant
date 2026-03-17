import Link from "next/link"

const Footer = () => {
  return (
    <footer className="border-t bg-white/70 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-sm text-gray-600 sm:flex-row sm:px-6 lg:px-8">
        <p>© 2026 ReviewAI. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link
            href="/contact"
            className="font-medium text-blue-700 hover:text-blue-800"
          >
            Contact Us
          </Link>
          <Link
            href="/privacy-policy"
            className="font-medium text-blue-700 hover:text-blue-800"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default Footer