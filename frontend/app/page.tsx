import Hero from "./components/Hero"
import Features from "./components/Features"

const LandingPage = () => {
  return (
    <div style={{
      backgroundImage: `radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--secondary-200) 20%, transparent) 0%, transparent 30%),
                        radial-gradient(circle at 100% 20%, color-mix(in srgb, var(--primary-200) 15%, transparent) 0%, transparent 35%),
                        linear-gradient(135deg, var(--neutral-50) 0%, color-mix(in srgb, white 93%, gray) 45%, color-mix(in srgb, white 97%, var(--primary-50)) 100%)`,
      color: 'var(--neutral-800)'
    }} className="min-h-screen text-slate-800">
      <Hero />
      <Features />
    </div>
  )
}

export default LandingPage