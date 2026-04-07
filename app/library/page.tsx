import { supabase } from '@/lib/supabase'
import type { Track } from '@/lib/supabase'
import Link from 'next/link'
import TrackLibrary from './TrackLibrary'

async function getTracks(): Promise<Track[]> {
  const { data } = await supabase
    .from('tracks')
    .select('*')
    .order('artist', { ascending: true })
  return data || []
}

async function getStats(tracks: Track[]) {
  const analyzed = tracks.filter(t => t.energy != null).length
  const genres = new Set(tracks.map(t => t.genre).filter(Boolean)).size
  const rated = tracks.filter(t => t.rating > 0).length
  return { total: tracks.length, analyzed, genres, rated }
}

export default async function LibraryPage() {
  const tracks = await getTracks()
  const stats = await getStats(tracks)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">DJ Set Planner</h1>
            <p className="text-xs text-zinc-500 mt-0.5">powered by Claude</p>
          </div>
          <nav className="flex gap-6 text-sm text-zinc-400">
            <Link href="/" className="hover:text-zinc-100 transition-colors">Sets</Link>
            <Link href="/library" className="text-zinc-100">Library</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-xl font-semibold tracking-tight mb-1">Track Library</h2>
          <p className="text-sm text-zinc-500">Your full Rekordbox collection, synced from the CLI.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Tracks', value: stats.total.toLocaleString() },
            { label: 'Analyzed', value: `${stats.analyzed.toLocaleString()} / ${stats.total.toLocaleString()}` },
            { label: 'Genres', value: stats.genres.toString() },
            { label: 'Rated', value: stats.rated.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xl font-semibold">{value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <TrackLibrary tracks={tracks} />
      </main>
    </div>
  )
}
