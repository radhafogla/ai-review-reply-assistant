export default function EmptyState() {

  return (

    <div className="flex h-screen items-center justify-center flex-col">

      <h1 className="text-2xl font-bold">
        Connect your Google Business
      </h1>

      <a
        href="/connect-business"
        className="mt-4 bg-black text-white px-6 py-3 rounded"
      >
        Connect Business
      </a>

    </div>
  )
}