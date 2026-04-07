import Link from 'next/link'

export default function LibrarySetsPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
        <p className="text-zinc-300 text-sm font-medium mb-2">Set history lives on the home page for now</p>
        <p className="text-zinc-600 text-xs mb-6">
          Full sets management (status, ratings, feedback) is being built here.
        </p>
        <Link
          href="/"
          className="inline-block text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg transition-colors"
        >
          ← View all sets
        </Link>
      </div>
    </main>
  )
}
