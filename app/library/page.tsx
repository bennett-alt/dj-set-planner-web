import { supabase } from '@/lib/supabase'
import type { Track, UserTrackMetadata } from '@/lib/supabase'
import TrackBrowser from './TrackBrowser'

export type TrackWithMeta = Track & { metadata: UserTrackMetadata | null }

async function getTracksWithMeta(): Promise<{
  tracks: TrackWithMeta[]
  stats: {
    total: number
    analyzed: number
    genres: number
    favorites: number
  }
}> {
  const [tracksRes, metaRes] = await Promise.all([
    supabase.from('tracks').select('*').order('artist', { ascending: true }),
    supabase.from('user_track_metadata').select('*'),
  ])

  const tracks: Track[] = tracksRes.data || []
  const metaRows: UserTrackMetadata[] = metaRes.data || []

  const metaMap = new Map<string, UserTrackMetadata>()
  for (const row of metaRows) {
    metaMap.set(row.track_id, row)
  }

  const tracksWithMeta: TrackWithMeta[] = tracks.map((t) => ({
    ...t,
    metadata: metaMap.get(t.id) ?? null,
  }))

  const analyzed = tracks.filter((t) => t.energy != null).length
  const uniqueGenres = new Set(tracks.map((t) => t.genre).filter(Boolean)).size
  const favorites = metaRows.filter((m) => m.favorite === true).length

  return {
    tracks: tracksWithMeta,
    stats: {
      total: tracks.length,
      analyzed,
      genres: uniqueGenres,
      favorites,
    },
  }
}

export default async function LibraryPage() {
  const { tracks, stats } = await getTracksWithMeta()

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Tracks', value: stats.total.toLocaleString() },
          { label: 'Analyzed', value: stats.analyzed.toLocaleString() },
          { label: 'Genres', value: stats.genres.toLocaleString() },
          { label: 'Favorites', value: stats.favorites.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Track browser */}
      <TrackBrowser tracks={tracks} />
    </main>
  )
}
