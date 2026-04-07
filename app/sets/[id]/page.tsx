import { supabase } from '@/lib/supabase'
import type { Set, SetTrack, Track } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SetFeedback from './SetFeedback'

async function getSet(id: string): Promise<Set | null> {
  const { data } = await supabase
    .from('sets')
    .select('*')
    .eq('id', id)
    .single()
  return data
}

async function getSetTracks(setId: string): Promise<(SetTrack & { track: Track })[]> {
  const { data } = await supabase
    .from('set_tracks')
    .select('*, track:tracks(*)')
    .eq('set_id', setId)
    .order('position')
  return (data as any) || []
}

function EnergyBar({ value, level }: { value: number | null; level: string | null }) {
  const pct = value != null ? value : level === 'high' ? 0.85 : level === 'low' ? 0.2 : 0.55
  const filled = Math.round(pct * 8)
  const color = pct >= 0.7 ? 'text-red-400' : pct >= 0.4 ? 'text-yellow-400' : 'text-blue-400'
  return (
    <span className={`font-mono text-xs ${color}`}>
      {'█'.repeat(filled)}{'░'.repeat(8 - filled)}
    </span>
  )
}

function EnergySparkline({ profile }: { profile: number[] | null }) {
  if (!profile || profile.length === 0) return <span className="text-zinc-600 text-xs">—</span>
  const max = Math.max(...profile)
  const bars = '▁▂▃▄▅▆▇█'
  return (
    <span className="font-mono text-xs text-zinc-400 tracking-tight">
      {profile.map((v, i) => {
        const idx = Math.round((v / max) * 7)
        return <span key={i}>{bars[idx]}</span>
      })}
    </span>
  )
}

function KeyBadge({ k }: { k: string | null }) {
  if (!k) return null
  return (
    <span className="inline-block bg-zinc-800 text-zinc-300 text-xs px-1.5 py-0.5 rounded font-mono">
      {k}
    </span>
  )
}

function SlotBadge({ slot }: { slot: string | null }) {
  const colors: Record<string, string> = {
    'peak hour': 'bg-red-900/50 text-red-300',
    'opening': 'bg-blue-900/50 text-blue-300',
    'closing': 'bg-purple-900/50 text-purple-300',
    'all-night': 'bg-orange-900/50 text-orange-300',
  }
  const cls = colors[slot?.toLowerCase() ?? ''] ?? 'bg-zinc-800 text-zinc-400'
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {slot}
    </span>
  )
}

export default async function SetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [set, setTracks] = await Promise.all([getSet(id), getSetTracks(id)])

  if (!set) notFound()

  const date = new Date(set.created_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

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
            <Link href="/sets" className="hover:text-zinc-100 transition-colors">Sets</Link>
            <Link href="/library" className="hover:text-zinc-100 transition-colors">Library</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Back */}
        <Link href="/sets" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6 inline-block">
          ← All Sets
        </Link>

        {/* Set header */}
        <div className="mb-8">
          <div className="flex items-start gap-3 flex-wrap mb-2">
            <h2 className="text-2xl font-semibold tracking-tight">{set.title}</h2>
            {set.time_slot && <SlotBadge slot={set.time_slot} />}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-500 mb-4">
            {set.venue && <span>{set.venue}</span>}
            {set.set_duration_minutes > 0 && <span>{set.set_duration_minutes} min</span>}
            <span>{setTracks.length} tracks</span>
            <span>{date}</span>
          </div>
          {set.vibe_description && (
            <p className="text-sm text-zinc-400 italic border-l-2 border-zinc-700 pl-3">
              "{set.vibe_description}"
            </p>
          )}
          {set.set_notes && (
            <p className="text-sm text-zinc-500 mt-3">{set.set_notes}</p>
          )}
        </div>

        {/* Post-show feedback */}
        <SetFeedback set={set} />

        {/* Energy arc */}
        {setTracks.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Energy Arc</p>
            <div className="flex items-end gap-1 h-12">
              {setTracks.map((st) => {
                const e = st.track?.energy ?? (st.energy_level === 'high' ? 0.85 : st.energy_level === 'low' ? 0.2 : 0.55)
                const h = Math.round(e * 100)
                const color = e >= 0.7 ? 'bg-red-500' : e >= 0.4 ? 'bg-yellow-500' : 'bg-blue-500'
                return (
                  <div key={st.id} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full rounded-sm ${color}`} style={{ height: `${h}%` }} />
                    <span className="text-zinc-600 text-[10px]">{st.position}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tracklist */}
        <div className="space-y-3">
          {setTracks.map((st) => (
            <div key={st.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start gap-4">
                {/* Position number */}
                <span className="text-2xl font-semibold text-zinc-700 w-8 shrink-0 text-right pt-0.5">
                  {st.position}
                </span>

                <div className="flex-1 min-w-0">
                  {/* Track title + artist */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-medium text-zinc-100 leading-tight">{st.track?.title}</p>
                      <p className="text-sm text-zinc-400 mt-0.5">{st.track?.artist}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <KeyBadge k={st.track?.key ?? null} />
                      <span className="text-xs text-zinc-500 font-mono">{st.bpm_played ?? st.track?.bpm}BPM</span>
                    </div>
                  </div>

                  {/* Audio features row */}
                  <div className="flex items-center gap-4 mb-3">
                    <EnergyBar value={st.track?.energy ?? null} level={st.energy_level} />
                    <EnergySparkline profile={st.track?.energy_profile ?? null} />
                    {st.track?.genre && (
                      <span className="text-xs text-zinc-600 truncate">{st.track.genre}</span>
                    )}
                  </div>

                  {/* Transition note */}
                  {st.transition_note && (
                    <p className="text-xs text-zinc-500 leading-relaxed border-t border-zinc-800 pt-3">
                      {st.transition_note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
