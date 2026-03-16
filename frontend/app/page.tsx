import Hero from "./components/Hero"
import Features from "./components/Features"
import Footer from "./components/Footer"

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-800">
      <Hero />
      <Features />
      <Footer />
    </div>
  )
}

export default LandingPage