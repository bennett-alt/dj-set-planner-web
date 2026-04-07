'use client'

import { useState, useMemo } from 'react'
import type { Track } from '@/lib/supabase'

function EnergyBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-zinc-700 text-xs font-mono">—</span>
  const filled = Math.round(value * 8)
  const color = value >= 0.7 ? 'text-red-400' : value >= 0.4 ? 'text-yellow-400' : 'text-blue-400'
  return (
    <span className={`font-mono text-xs ${color}`}>
      {'█'.repeat(filled)}{'░'.repeat(8 - filled)}
    </span>
  )
}

function KeyBadge({ k }: { k: string | null }) {
  if (!k) return <span className="text-zinc-700 text-xs">—</span>
  return (
    <span className="inline-block bg-zinc-800 text-zinc-300 text-xs px-1.5 py-0.5 rounded font-mono">
      {k}
    </span>
  )
}

function StarRating({ rating }: { rating: number }) {
  if (!rating) return null
  return (
    <span className="text-xs text-zinc-500">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const SORT_OPTIONS = [
  { value: 'artist', label: 'Artist' },
  { value: 'title', label: 'Title' },
  { value: 'bpm', label: 'BPM' },
  { value: 'energy', label: 'Energy' },
  { value: 'rating', label: 'Rating' },
] as const

type SortKey = typeof SORT_OPTIONS[number]['value']

export default function TrackLibrary({ tracks }: { tracks: Track[] }) {
  const [search, setSearch] = useState('')
  const [genreFilter, setGenreFilter] = useState<string | null>(null)
  const [analyzedOnly, setAnalyzedOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('artist')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const genres = useMemo(() => {
    const g = new globalThis.Set(tracks.map(t => t.genre).filter(Boolean))
    return Array.from(g).sort() as string[]
  }, [tracks])

  const filtered = useMemo(() => {
    let result = tracks

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      )
    }

    if (genreFilter) {
      result = result.filter(t => t.genre === genreFilter)
    }

    if (analyzedOnly) {
      result = result.filter(t => t.energy != null)
    }

    result = [...result].sort((a, b) => {
      let av: number | string, bv: number | string
      switch (sortKey) {
        case 'artist': av = a.artist.toLowerCase(); bv = b.artist.toLowerCase(); break
        case 'title': av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break
        case 'bpm': av = a.bpm ?? 0; bv = b.bpm ?? 0; break
        case 'energy': av = a.energy ?? -1; bv = b.energy ?? -1; break
        case 'rating': av = a.rating ?? 0; bv = b.rating ?? 0; break
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [tracks, search, genreFilter, analyzedOnly, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'energy' || key === 'rating' || key === 'bpm' ? 'desc' : 'asc')
    }
  }

  function SortHeader({ colKey, label, className = '' }: { colKey: SortKey; label: string; className?: string }) {
    const active = sortKey === colKey
    return (
      <button
        onClick={() => toggleSort(colKey)}
        className={`flex items-center gap-1 text-left hover:text-zinc-200 transition-colors ${active ? 'text-zinc-200' : 'text-zinc-500'} ${className}`}
      >
        {label}
        {active && <span className="text-zinc-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    )
  }

  return (
    <div>
      {/* Search + filters */}
      <div className="flex flex-col gap-3 mb-6">
        <input
          type="text"
          placeholder="Search tracks or artists…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Genre chips */}
          <button
            onClick={() => setGenreFilter(null)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              genreFilter === null
                ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            All genres
          </button>
          {genres.map(g => (
            <button
              key={g}
              onClick={() => setGenreFilter(g === genreFilter ? null : g)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                genreFilter === g
                  ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                  : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
              }`}
            >
              {g}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={analyzedOnly}
                onChange={e => setAnalyzedOnly(e.target.checked)}
                className="accent-zinc-400"
              />
              Analyzed only
            </label>
          </div>
        </div>
      </div>

      {/* Result count */}
      <p className="text-xs text-zinc-600 mb-3">
        {filtered.length.toLocaleString()} track{filtered.length !== 1 ? 's' : ''}
        {(search || genreFilter || analyzedOnly) && ` of ${tracks.length.toLocaleString()}`}
      </p>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-x-4 px-4 py-2.5 border-b border-zinc-800 text-xs uppercase tracking-wider">
          <SortHeader colKey="title" label="Title" />
          <SortHeader colKey="artist" label="Artist" />
          <SortHeader colKey="bpm" label="BPM" className="w-14 text-right" />
          <span className="text-zinc-500 w-8 text-center">Key</span>
          <SortHeader colKey="energy" label="Energy" className="w-20" />
          <SortHeader colKey="rating" label="★" className="w-12 text-right" />
        </div>

        {/* Rows */}
        <div className="divide-y divide-zinc-800/60">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-600">
              No tracks match your filters.
            </div>
          ) : (
            filtered.map(track => (
              <div
                key={track.id}
                className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-x-4 px-4 py-3 hover:bg-zinc-800/40 transition-colors items-center"
              >
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100 truncate leading-tight">{track.title}</p>
                  {track.genre && (
                    <p className="text-xs text-zinc-600 truncate mt-0.5">{track.genre}</p>
                  )}
                </div>
                <p className="text-sm text-zinc-400 truncate">{track.artist}</p>
                <p className="text-xs text-zinc-400 font-mono w-14 text-right">
                  {track.bpm ? track.bpm.toFixed(0) : '—'}
                </p>
                <div className="w-8 flex justify-center">
                  <KeyBadge k={track.key} />
                </div>
                <div className="w-20">
                  <EnergyBar value={track.energy} />
                </div>
                <div className="w-12 text-right">
                  {track.rating > 0 ? (
                    <span className="text-xs text-zinc-500">{'★'.repeat(track.rating)}</span>
                  ) : (
                    <span className="text-zinc-700 text-xs">—</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
