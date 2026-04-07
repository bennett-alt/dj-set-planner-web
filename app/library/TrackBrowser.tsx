'use client'

import { useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserTrackMetadata } from '@/lib/supabase'
import type { TrackWithMeta } from './page'

type SortKey = 'artist' | 'title' | 'bpm' | 'energy' | 'duration' | 'rating' | 'date_added'
type SortDir = 'asc' | 'desc'
type RoleFilter = 'opener' | 'peak' | 'closer' | null

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function EnergyBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-zinc-600 text-xs font-mono">—</span>
  const filled = Math.round(value * 8)
  const color = value >= 0.7 ? 'text-red-400' : value >= 0.4 ? 'text-yellow-400' : 'text-blue-400'
  return (
    <span className={`font-mono text-xs ${color}`}>
      {'█'.repeat(filled)}{'░'.repeat(8 - filled)}
    </span>
  )
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.min(5, Math.max(0, rating))
  return (
    <span className="text-yellow-500 text-xs">
      {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
    </span>
  )
}

function RoleBadge({ role }: { role: UserTrackMetadata['role'] }) {
  if (!role) return <span className="text-zinc-600 text-xs">⊕</span>
  const styles: Record<string, string> = {
    opener: 'bg-blue-900/60 text-blue-300',
    peak: 'bg-red-900/60 text-red-300',
    closer: 'bg-purple-900/60 text-purple-300',
  }
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded capitalize ${styles[role]}`}>
      {role}
    </span>
  )
}

const ROLE_CYCLE: Array<RoleFilter> = [null, 'opener', 'peak', 'closer']

function nextRole(current: UserTrackMetadata['role']): UserTrackMetadata['role'] {
  const idx = ROLE_CYCLE.indexOf(current)
  return ROLE_CYCLE[(idx + 1) % ROLE_CYCLE.length]
}

interface TrackBrowserProps {
  tracks: TrackWithMeta[]
}

export default function TrackBrowser({ tracks }: TrackBrowserProps) {
  const [search, setSearch] = useState('')
  const [genreFilter, setGenreFilter] = useState<string | null>(null)
  const [keyFilter, setKeyFilter] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [analyzedOnly, setAnalyzedOnly] = useState(false)
  const [bpmMin, setBpmMin] = useState<number | null>(null)
  const [bpmMax, setBpmMax] = useState<number | null>(null)
  const [energyMin, setEnergyMin] = useState<number | null>(null)
  const [energyMax, setEnergyMax] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('artist')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [pendingMeta, setPendingMeta] = useState<Map<string, Partial<UserTrackMetadata>>>(new Map())

  // Derived data
  const allGenres = useMemo(() => {
    const s = new Set<string>()
    for (const t of tracks) {
      if (t.genre) s.add(t.genre)
    }
    return Array.from(s).sort()
  }, [tracks])

  const allKeys = useMemo(() => {
    const s = new Set<string>()
    for (const t of tracks) {
      if (t.key) s.add(t.key)
    }
    return Array.from(s).sort()
  }, [tracks])

  const getMeta = useCallback(
    (trackId: string, base: UserTrackMetadata | null): UserTrackMetadata | null => {
      const pending = pendingMeta.get(trackId)
      if (!pending && !base) return null
      if (!pending) return base
      return { ...(base ?? {} as UserTrackMetadata), ...pending } as UserTrackMetadata
    },
    [pendingMeta]
  )

  // Filtered + sorted tracks
  const filteredTracks = useMemo(() => {
    const q = search.toLowerCase()

    let result = tracks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !t.artist.toLowerCase().includes(q)) return false
      if (genreFilter && t.genre !== genreFilter) return false
      if (keyFilter && t.key !== keyFilter) return false
      if (analyzedOnly && t.energy == null) return false
      if (bpmMin != null && (t.bpm == null || t.bpm < bpmMin)) return false
      if (bpmMax != null && (t.bpm == null || t.bpm > bpmMax)) return false
      if (energyMin != null && (t.energy == null || t.energy < energyMin)) return false
      if (energyMax != null && (t.energy == null || t.energy > energyMax)) return false

      const meta = getMeta(t.id, t.metadata)
      if (favoritesOnly && !meta?.favorite) return false
      if (roleFilter && meta?.role !== roleFilter) return false

      return true
    })

    result.sort((a, b) => {
      let av: number | string | null = null
      let bv: number | string | null = null

      if (sortKey === 'artist') { av = a.artist; bv = b.artist }
      else if (sortKey === 'title') { av = a.title; bv = b.title }
      else if (sortKey === 'bpm') { av = a.bpm; bv = b.bpm }
      else if (sortKey === 'energy') { av = a.energy; bv = b.energy }
      else if (sortKey === 'duration') { av = a.duration_seconds; bv = b.duration_seconds }
      else if (sortKey === 'rating') { av = a.rating; bv = b.rating }
      else if (sortKey === 'date_added') { av = a.created_at; bv = b.created_at }

      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1

      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [tracks, search, genreFilter, keyFilter, roleFilter, favoritesOnly, analyzedOnly, bpmMin, bpmMax, energyMin, energyMax, sortKey, sortDir, getMeta])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return <span className="text-zinc-700 ml-0.5">↕</span>
    return <span className="text-zinc-300 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  async function toggleFavorite(track: TrackWithMeta) {
    const meta = getMeta(track.id, track.metadata)
    const newFavorite = !(meta?.favorite ?? false)

    setPendingMeta((prev) => {
      const next = new Map(prev)
      next.set(track.id, { ...(prev.get(track.id) ?? {}), favorite: newFavorite })
      return next
    })

    await supabase.from('user_track_metadata').upsert(
      {
        track_id: track.id,
        favorite: newFavorite,
        role: meta?.role ?? null,
        rating: meta?.rating ?? null,
        tags: meta?.tags ?? null,
        usage_count: meta?.usage_count ?? 0,
      },
      { onConflict: 'track_id' }
    )
  }

  async function cycleRole(track: TrackWithMeta) {
    const meta = getMeta(track.id, track.metadata)
    const newRole = nextRole(meta?.role ?? null)

    setPendingMeta((prev) => {
      const next = new Map(prev)
      next.set(track.id, { ...(prev.get(track.id) ?? {}), role: newRole })
      return next
    })

    await supabase.from('user_track_metadata').upsert(
      {
        track_id: track.id,
        favorite: meta?.favorite ?? false,
        role: newRole,
        rating: meta?.rating ?? null,
        tags: meta?.tags ?? null,
        usage_count: meta?.usage_count ?? 0,
      },
      { onConflict: 'track_id' }
    )
  }

  function handleAddToPlaylist(track: TrackWithMeta) {
    console.log('[Add to playlist]', track.id, track.title, track.artist)
  }

  function setEnergyRange(min: number | null, max: number | null) {
    setEnergyMin(min)
    setEnergyMax(max)
  }

  const chipBase = 'inline-block px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors'
  const chipActive = 'bg-zinc-100 text-zinc-900 font-medium'
  const chipInactive = 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'

  return (
    <div>
      {/* Filter bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4 space-y-3">
        {/* Row 1: Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, artist…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />

        {/* Row 2: Genre / Key / Role chips */}
        <div className="flex flex-wrap gap-2 items-start">
          {/* Genre chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setGenreFilter(null)}
              className={`${chipBase} ${genreFilter === null ? chipActive : chipInactive}`}
            >
              All Genres
            </button>
            {allGenres.map((g) => (
              <button
                key={g}
                onClick={() => setGenreFilter(genreFilter === g ? null : g)}
                className={`${chipBase} ${genreFilter === g ? chipActive : chipInactive}`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="w-px bg-zinc-700 self-stretch mx-1" />

          {/* Key chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setKeyFilter(null)}
              className={`${chipBase} ${keyFilter === null ? chipActive : chipInactive}`}
            >
              All Keys
            </button>
            {allKeys.map((k) => (
              <button
                key={k}
                onClick={() => setKeyFilter(keyFilter === k ? null : k)}
                className={`${chipBase} font-mono ${keyFilter === k ? chipActive : chipInactive}`}
              >
                {k}
              </button>
            ))}
          </div>

          <div className="w-px bg-zinc-700 self-stretch mx-1" />

          {/* Role chips */}
          <div className="flex flex-wrap gap-1.5">
            {([null, 'opener', 'peak', 'closer'] as Array<RoleFilter>).map((r) => (
              <button
                key={r ?? 'all'}
                onClick={() => setRoleFilter(roleFilter === r ? null : r)}
                className={`${chipBase} ${roleFilter === r ? chipActive : chipInactive}`}
              >
                {r == null ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: BPM range / Energy quick filters / Toggles */}
        <div className="flex flex-wrap items-center gap-4">
          {/* BPM range */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>BPM</span>
            <input
              type="number"
              placeholder="from"
              value={bpmMin ?? ''}
              onChange={(e) => setBpmMin(e.target.value ? Number(e.target.value) : null)}
              className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span>—</span>
            <input
              type="number"
              placeholder="to"
              value={bpmMax ?? ''}
              onChange={(e) => setBpmMax(e.target.value ? Number(e.target.value) : null)}
              className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Energy quick filters */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500">Energy:</span>
            <button
              onClick={() => energyMin === 0 && energyMax === 0.4 ? setEnergyRange(null, null) : setEnergyRange(0, 0.4)}
              className={`${chipBase} ${energyMin === 0 && energyMax === 0.4 ? 'bg-blue-900/60 text-blue-300' : chipInactive}`}
            >
              Low
            </button>
            <button
              onClick={() => energyMin === 0.4 && energyMax === 0.7 ? setEnergyRange(null, null) : setEnergyRange(0.4, 0.7)}
              className={`${chipBase} ${energyMin === 0.4 && energyMax === 0.7 ? 'bg-yellow-900/60 text-yellow-300' : chipInactive}`}
            >
              Mid
            </button>
            <button
              onClick={() => energyMin === 0.7 && energyMax === null ? setEnergyRange(null, null) : setEnergyRange(0.7, null)}
              className={`${chipBase} ${energyMin === 0.7 && energyMax === null ? 'bg-red-900/60 text-red-300' : chipInactive}`}
            >
              High
            </button>
          </div>

          {/* Toggles */}
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
              className="accent-red-500"
            />
            Favorites only
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={analyzedOnly}
              onChange={(e) => setAnalyzedOnly(e.target.checked)}
              className="accent-zinc-400"
            />
            Analyzed only
          </label>
        </div>
      </div>

      {/* Sort bar + count */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-0">
          <span className="text-xs text-zinc-500 mr-3">Sort:</span>
          {(
            [
              { key: 'artist' as SortKey, label: 'Artist' },
              { key: 'title' as SortKey, label: 'Title' },
              { key: 'bpm' as SortKey, label: 'BPM' },
              { key: 'energy' as SortKey, label: 'Energy' },
              { key: 'duration' as SortKey, label: 'Duration' },
              { key: 'rating' as SortKey, label: '★' },
              { key: 'date_added' as SortKey, label: 'Added' },
            ] as Array<{ key: SortKey; label: string }>
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                sortKey === key
                  ? 'text-zinc-100 bg-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}{sortArrow(key)}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500">{filteredTracks.length} tracks</span>
      </div>

      {/* Track table */}
      {filteredTracks.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-400 text-sm">No tracks match your filters.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Table header */}
          <div
            className="grid text-xs text-zinc-500 uppercase tracking-wider px-4 py-2.5 border-b border-zinc-800"
            style={{ gridTemplateColumns: '2fr 2fr 60px 80px 120px 60px 80px 100px' }}
          >
            <span>Title</span>
            <span>Artist</span>
            <span>BPM</span>
            <span>Key</span>
            <span>Energy</span>
            <span>Time</span>
            <span>Rating</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Track rows */}
          <div className="divide-y divide-zinc-800">
            {filteredTracks.map((track) => {
              const meta = getMeta(track.id, track.metadata)
              const isFavorite = meta?.favorite ?? false
              const role = meta?.role ?? null

              return (
                <div
                  key={track.id}
                  className="grid items-center px-4 py-2.5 hover:bg-zinc-800/50 transition-colors group"
                  style={{ gridTemplateColumns: '2fr 2fr 60px 80px 120px 60px 80px 100px' }}
                >
                  {/* Title + genre */}
                  <div className="min-w-0 pr-3">
                    <p className="text-sm text-zinc-100 truncate leading-tight">{track.title}</p>
                    {track.genre && (
                      <p className="text-xs text-zinc-600 truncate mt-0.5">{track.genre}</p>
                    )}
                  </div>

                  {/* Artist */}
                  <div className="min-w-0 pr-3">
                    <p className="text-sm text-zinc-300 truncate">{track.artist}</p>
                  </div>

                  {/* BPM */}
                  <div>
                    <span className="font-mono text-xs text-zinc-400">
                      {track.bpm != null ? Math.round(track.bpm) : '—'}
                    </span>
                  </div>

                  {/* Key */}
                  <div>
                    {track.key ? (
                      <span className="inline-block bg-zinc-800 text-zinc-300 text-xs px-1.5 py-0.5 rounded font-mono border border-zinc-700">
                        {track.key}
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-xs">—</span>
                    )}
                  </div>

                  {/* Energy bar */}
                  <div>
                    <EnergyBar value={track.energy} />
                  </div>

                  {/* Duration */}
                  <div>
                    <span className="font-mono text-xs text-zinc-400">
                      {formatDuration(track.duration_seconds)}
                    </span>
                  </div>

                  {/* Rating */}
                  <div>
                    <Stars rating={track.rating} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 justify-end">
                    {/* Favorite */}
                    <button
                      onClick={() => toggleFavorite(track)}
                      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      className={`w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-zinc-700 text-sm ${
                        isFavorite ? 'text-red-400' : 'text-zinc-600 hover:text-zinc-300'
                      }`}
                    >
                      {isFavorite ? '❤' : '♡'}
                    </button>

                    {/* Role cycle */}
                    <button
                      onClick={() => cycleRole(track)}
                      title="Cycle role (opener → peak → closer)"
                      className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-zinc-700"
                    >
                      <RoleBadge role={role} />
                    </button>

                    {/* Add to playlist */}
                    <button
                      onClick={() => handleAddToPlaylist(track)}
                      title="Add to playlist"
                      className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300 text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
