import Hero from "./components/Hero"
import Features from "./components/Features"

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-800">
      <Hero />
      <Features />
    </div>
  )
}

export default LandingPage