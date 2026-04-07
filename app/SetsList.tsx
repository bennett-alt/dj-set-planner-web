'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Set } from '@/lib/supabase'

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
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-2 shrink-0`} />
}

function StatusBadge({ set }: { set: Set }) {
  if (set.played) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/60 text-green-300 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
        Played
      </span>
    )
  }
  if (set.selected) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
        Selected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block" />
      Generated
    </span>
  )
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <span className="text-xs text-yellow-400 tracking-tight" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
      <span className="text-zinc-700">{'★'.repeat(5 - rating)}</span>
    </span>
  )
}

function ActionButtons({
  set,
  onSelect,
  onPlayed,
  onRate,
}: {
  set: Set
  onSelect: (id: string) => void
  onPlayed: (id: string) => void
  onRate: (id: string, rating: number) => void
}) {
  const [hoverStar, setHoverStar] = useState<number | null>(null)

  return (
    <div
      className="flex items-center gap-1 mt-3 pt-3 border-t border-zinc-800"
      // Stop click from propagating to the parent Link
      onClick={(e) => e.preventDefault()}
    >
      {/* Select button */}
      <button
        title={set.selected ? 'Selected' : 'Mark as Selected'}
        onClick={() => onSelect(set.id)}
        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
          set.selected
            ? 'bg-yellow-900/60 text-yellow-300 hover:bg-yellow-900/80'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
        }`}
      >
        <span>✓</span>
        <span>{set.selected ? 'Selected' : 'Select'}</span>
      </button>

      {/* Played button */}
      <button
        title={set.played ? 'Played' : 'Mark as Played'}
        onClick={() => onPlayed(set.id)}
        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
          set.played
            ? 'bg-green-900/60 text-green-300 hover:bg-green-900/80'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
        }`}
      >
        <span>▶</span>
        <span>{set.played ? 'Played' : 'Played?'}</span>
      </button>

      {/* Star rating */}
      <div className="flex items-center gap-0.5 ml-1" title="Rate this set">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = hoverStar !== null ? star <= hoverStar : star <= (set.user_rating ?? 0)
          return (
            <button
              key={star}
              onClick={() => onRate(set.id, star)}
              onMouseEnter={() => setHoverStar(star)}
              onMouseLeave={() => setHoverStar(null)}
              className={`text-sm transition-colors leading-none ${
                filled ? 'text-yellow-400' : 'text-zinc-700 hover:text-zinc-500'
              }`}
              aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            >
              ★
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function SetsList({ sets }: { sets: Set[] }) {
  const [optimisticSets, setOptimisticSets] = useState<Set[]>(sets)

  async function handleSelect(id: string) {
    // Optimistically update: mark this one selected, un-select others
    setOptimisticSets((prev) =>
      prev.map((s) => ({ ...s, selected: s.id === id ? !s.selected : false }))
    )

    const current = optimisticSets.find((s) => s.id === id)
    const newValue = !current?.selected

    // Un-select all others first
    if (newValue) {
      await supabase.from('sets').update({ selected: false }).neq('id', id)
    }
    await supabase.from('sets').update({ selected: newValue }).eq('id', id)
  }

  async function handlePlayed(id: string) {
    const current = optimisticSets.find((s) => s.id === id)
    const newValue = !current?.played

    setOptimisticSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, played: newValue } : s))
    )

    await supabase.from('sets').update({ played: newValue }).eq('id', id)
  }

  async function handleRate(id: string, rating: number) {
    const current = optimisticSets.find((s) => s.id === id)
    // Clicking the same star again clears the rating
    const newValue = current?.user_rating === rating ? null : rating

    setOptimisticSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, user_rating: newValue } : s))
    )

    await supabase.from('sets').update({ user_rating: newValue }).eq('id', id)
  }

  if (optimisticSets.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
        <p className="text-zinc-400 text-sm">No sets yet.</p>
        <p className="text-zinc-600 text-xs mt-2">
          Run the CLI planner to generate your first set — it will appear here automatically.
        </p>
        <code className="inline-block mt-4 text-xs bg-zinc-800 text-zinc-300 px-3 py-2 rounded-lg">
          python3 dj_planner.py --library &quot;...xml&quot; --playlist &quot;HIGH ENERGY&quot;
        </code>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {optimisticSets.map((set) => (
        <Link
          key={set.id}
          href={`/sets/${set.id}`}
          className="block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-colors group"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Title row with status badge */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <EnergyDot slot={set.time_slot} />
                <h3 className="font-medium text-zinc-100 group-hover:text-white truncate">
                  {set.title}
                </h3>
                <StatusBadge set={set} />
              </div>

              {/* Metadata row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 items-center">
                {set.venue && <span>{set.venue}</span>}
                {set.time_slot && <span className="capitalize">{set.time_slot}</span>}
                {set.set_duration_minutes > 0 && <span>{set.set_duration_minutes} min</span>}
                {set.user_rating && <StarRating rating={set.user_rating} />}
              </div>

              {set.vibe_description && (
                <p className="text-xs text-zinc-600 mt-2 truncate">{set.vibe_description}</p>
              )}

              {/* Action buttons */}
              <ActionButtons
                set={set}
                onSelect={handleSelect}
                onPlayed={handlePlayed}
                onRate={handleRate}
              />
            </div>

            <span className="text-xs text-zinc-600 whitespace-nowrap shrink-0 pt-0.5">
              {timeAgo(set.created_at)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
