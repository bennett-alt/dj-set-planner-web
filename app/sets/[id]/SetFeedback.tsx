'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Set } from '@/lib/supabase'

function StarRatingDisplay({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <span className="text-base text-yellow-400 tracking-tight" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
      <span className="text-zinc-700">{'★'.repeat(5 - rating)}</span>
    </span>
  )
}

function StarRatingInput({
  value,
  onChange,
}: {
  value: number | null
  onChange: (rating: number | null) => void
}) {
  const [hover, setHover] = useState<number | null>(null)

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = hover !== null ? star <= hover : star <= (value ?? 0)
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(value === star ? null : star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            className={`text-xl leading-none transition-colors ${
              filled ? 'text-yellow-400' : 'text-zinc-700 hover:text-zinc-500'
            }`}
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
          >
            ★
          </button>
        )
      })}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-zinc-600 hover:text-zinc-400 ml-1 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}

export default function SetFeedback({ set: initialSet }: { set: Set }) {
  const [set, setSet] = useState<Set>(initialSet)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Edit form state
  const [draftRating, setDraftRating] = useState<number | null>(initialSet.user_rating)
  const [draftSelected, setDraftSelected] = useState(initialSet.selected)
  const [draftPlayed, setDraftPlayed] = useState(initialSet.played)
  const [draftNotes, setDraftNotes] = useState(initialSet.notes ?? '')
  const [draftRecordingUrl, setDraftRecordingUrl] = useState(initialSet.recording_url ?? '')

  const hasPostShowData =
    set.user_rating !== null ||
    set.selected ||
    set.played ||
    (set.notes && set.notes.trim().length > 0) ||
    (set.recording_url && set.recording_url.trim().length > 0)

  function openEdit() {
    setDraftRating(set.user_rating)
    setDraftSelected(set.selected)
    setDraftPlayed(set.played)
    setDraftNotes(set.notes ?? '')
    setDraftRecordingUrl(set.recording_url ?? '')
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
  }

  async function handleSave() {
    setIsSaving(true)

    const updates = {
      user_rating: draftRating,
      selected: draftSelected,
      played: draftPlayed,
      notes: draftNotes.trim() || null,
      recording_url: draftRecordingUrl.trim() || null,
    }

    const { error } = await supabase.from('sets').update(updates).eq('id', set.id)

    if (!error) {
      setSet((prev) => ({ ...prev, ...updates }))
      setIsEditing(false)
    } else {
      console.error('Error saving feedback:', error)
    }

    setIsSaving(false)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Post-Show</p>
        {!isEditing && (
          <button
            onClick={openEdit}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded-md"
          >
            {hasPostShowData ? 'Edit' : 'Add feedback'}
          </button>
        )}
      </div>

      {isEditing ? (
        /* ── Edit form ── */
        <div className="space-y-4">
          {/* Star rating */}
          <div>
            <label className="text-xs text-zinc-500 block mb-1.5">Your rating</label>
            <StarRatingInput value={draftRating} onChange={setDraftRating} />
          </div>

          {/* Status toggles */}
          <div>
            <label className="text-xs text-zinc-500 block mb-1.5">Status</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDraftSelected((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
                  draftSelected
                    ? 'bg-yellow-900/60 text-yellow-300 hover:bg-yellow-900/80'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                }`}
              >
                <span>✓</span>
                {draftSelected ? 'Selected' : 'Mark as Selected'}
              </button>
              <button
                type="button"
                onClick={() => setDraftPlayed((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
                  draftPlayed
                    ? 'bg-green-900/60 text-green-300 hover:bg-green-900/80'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                }`}
              >
                <span>▶</span>
                {draftPlayed ? 'Played' : 'Mark as Played'}
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-zinc-500 block mb-1.5" htmlFor="post-show-notes">
              Notes
            </label>
            <textarea
              id="post-show-notes"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              placeholder="How did the set go? Any crowd moments, track decisions, or things you'd change..."
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
            />
          </div>

          {/* Recording URL */}
          <div>
            <label className="text-xs text-zinc-500 block mb-1.5" htmlFor="recording-url">
              Recording URL
            </label>
            <input
              id="recording-url"
              type="url"
              value={draftRecordingUrl}
              onChange={(e) => setDraftRecordingUrl(e.target.value)}
              placeholder="https://soundcloud.com/..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-sm px-4 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white transition-colors font-medium disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={cancelEdit}
              disabled={isSaving}
              className="text-sm px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : hasPostShowData ? (
        /* ── Read-only view ── */
        <div className="space-y-3">
          {/* Status badges + rating in one row */}
          <div className="flex flex-wrap items-center gap-2">
            {set.played && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/60 text-green-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Played
              </span>
            )}
            {set.selected && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                Selected
              </span>
            )}
            {set.user_rating && <StarRatingDisplay rating={set.user_rating} />}
          </div>

          {/* Notes */}
          {set.notes && set.notes.trim().length > 0 && (
            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
              {set.notes}
            </p>
          )}

          {/* Recording link */}
          {set.recording_url && set.recording_url.trim().length > 0 && (
            <a
              href={set.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors underline underline-offset-2"
            >
              <span>▶</span>
              Recording
            </a>
          )}
        </div>
      ) : (
        /* ── Empty prompt ── */
        <p className="text-sm text-zinc-600">
          How did it go? Add notes, rating, or a recording link.
        </p>
      )}
    </div>
  )
}
