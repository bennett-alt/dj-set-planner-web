import Link from 'next/link'
import TabBar from './TabBar'

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">DJ Set Planner</h1>
            <p className="text-xs text-zinc-500 mt-0.5">powered by Claude</p>
          </div>
          <nav className="flex gap-6 text-sm text-zinc-400">
            <Link href="/" className="hover:text-zinc-100 transition-colors">Plan a Set</Link>
            <Link href="/sets" className="hover:text-zinc-100 transition-colors">Sets</Link>
            <Link href="/library" className="text-zinc-100">Library</Link>
          </nav>
        </div>
      </header>

      {/* Tab bar */}
      <TabBar />

      {/* Page content */}
      {children}
    </div>
  )
}
