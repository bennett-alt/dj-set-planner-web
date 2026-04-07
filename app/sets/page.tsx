import { supabase } from '@/lib/supabase'
import type { Set } from '@/lib/supabase'
import Link from 'next/link'
import SetsList from '../SetsList'

async function getSets(): Promise<Set[]> {
  const { data, error } = await supabase
    .from('sets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error fetching sets:', error)
    return []
  }
  return data || []
}

async function getStats() {
  const [tracksRes, setsRes, analyzedRes] = await Promise.all([
    supabase.from('tracks').select('id', { count: 'exact', head: true }),
    supabase.from('sets').select('id', { count: 'exact', head: true }),
    supabase.from('tracks').select('id', { count: 'exact', head: true }).not('energy', 'is', null),
  ])
  return {
    tracks: tracksRes.count ?? 0,
    sets: setsRes.count ?? 0,
    analyzed: analyzedRes.count ?? 0,
  }
}

export default async function Home() {
  const [sets, stats] = await Promise.all([getSets(), getStats()])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">DJ Set Planner</h1>
            <p className="text-xs text-zinc-500 mt-0.5">powered by Claude</p>
          </div>
          <nav className="flex gap-6 text-sm text-zinc-400">
            <Link href="/" className="hover:text-zinc-100 transition-colors">Plan a Set</Link>
            <Link href="/sets" className="text-zinc-100">Sets</Link>
            <Link href="/library" className="hover:text-zinc-100 transition-colors">Library</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Tracks', value: stats.tracks.toLocaleString() },
            { label: 'Analyzed', value: stats.analyzed.toLocaleString() },
            { label: 'Sets Planned', value: stats.sets.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-2xl font-semibold">{value}</p>
              <p className="text-xs text-zinc-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Set history */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Recent Sets</h2>
        </div>

        <SetsList sets={sets} />
      </main>
    </div>
  )
}
