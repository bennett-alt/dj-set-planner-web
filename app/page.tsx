import { supabase } from '@/lib/supabase'
import type { Set } from '@/lib/supabase'
import Link from 'next/link'

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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function EnergyDot({ slot }: { slot: string | null }) {
  const colors: Record<string, string> = {
    'peak hour': 'bg-red-500',
    'opening': 'bg-blue-400',
    'closing': 'bg-purple-400',
    'all-night': 'bg-orange-400',
  }
  const color = colors[slot?.toLowerCase() ?? ''] ?? 'bg-zinc-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-2`} />
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
            <Link href="/" className="text-zinc-100">Sets</Link>
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

        {sets.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <p className="text-zinc-400 text-sm">No sets yet.</p>
            <p className="text-zinc-600 text-xs mt-2">
              Run the CLI planner to generate your first set — it will appear here automatically.
            </p>
            <code className="inline-block mt-4 text-xs bg-zinc-800 text-zinc-300 px-3 py-2 rounded-lg">
              python3 dj_planner.py --library &quot;...xml&quot; --playlist &quot;HIGH ENERGY&quot;
            </code>
          </div>
        ) : (
          <div className="space-y-3">
            {sets.map((set) => (
              <Link
                key={set.id}
                href={`/sets/${set.id}`}
                className="block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <EnergyDot slot={set.time_slot} />
                      <h3 className="font-medium text-zinc-100 group-hover:text-white truncate">
                        {set.title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      {set.venue && <span>{set.venue}</span>}
                      {set.time_slot && <span className="capitalize">{set.time_slot}</span>}
                      {set.set_duration_minutes > 0 && <span>{set.set_duration_minutes} min</span>}
                    </div>
                    {set.vibe_description && (
                      <p className="text-xs text-zinc-600 mt-2 truncate">{set.vibe_description}</p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-600 whitespace-nowrap shrink-0 pt-0.5">
                    {timeAgo(set.created_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
