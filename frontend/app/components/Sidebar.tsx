export default function Sidebar() {

  return (

    <div className="w-60 border-r p-4">

      <h1 className="text-xl font-bold mb-6">
        AI Reviews
      </h1>

      <nav className="space-y-3">

        <a href="/dashboard">📥 Reviews</a>

        <a href="/settings">⚙️ Settings</a>

        <a href="/connect-business">🔌 Integrations</a>

      </nav>

    </div>
  )
}