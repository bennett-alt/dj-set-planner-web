'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Step = 'welcome' | 'upload' | 'interview' | 'generating' | 'result'

interface SessionContext {
  event_name: string
  venue: string
  set_duration_minutes: number
  time_slot: string
  audience_description: string
  energy_arc: string
  vibe_description: string
  must_include: string
  num_sets: number
}

const TIME_SLOTS = [
  { value: 'opening', label: 'Opening', desc: 'Warm-up, build the room' },
  { value: 'peak hour', label: 'Peak Hour', desc: 'Full energy, main event' },
  { value: 'closing', label: 'Closing', desc: 'Bring it home' },
  { value: 'all-night', label: 'All Night', desc: 'Full set, you own it' },
]

const ENERGY_ARCS = [
  { value: 'Slow build culminating in a massive peak at the end', label: 'Slow Build', desc: 'Start deep, end massive' },
  { value: 'Already peaking — maintain high energy and tension throughout', label: 'Full Peak', desc: 'High energy throughout' },
  { value: 'Emotional journey with multiple peaks and valleys', label: 'Journey', desc: 'Peaks and valleys' },
  { value: 'Closing down gently from the peak, bringing energy home', label: 'Cool Down', desc: 'Peak to smooth landing' },
]

function extractJSON(text: string): object | null {
  const match = text.match(/```json\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

export default function PlanPage() {
  const [step, setStep] = useState<Step>('welcome')
  const [libraryCount, setLibraryCount] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ tracks: number; playlists: string[] } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [context, setContext] = useState<SessionContext>({
    event_name: '',
    venue: '',
    set_duration_minutes: 60,
    time_slot: 'peak hour',
    audience_description: '',
    energy_arc: 'Slow build culminating in a massive peak at the end',
    vibe_description: '',
    must_include: '',
    num_sets: 1,
  })
  const [generating, setGenerating] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [parsedSet, setParsedSet] = useState<object | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if library exists on mount
  useEffect(() => {
    supabase
      .from('tracks')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => {
        setLibraryCount(count ?? 0)
      })
  }, [])

  async function handleFileUpload(file: File) {
    setUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload-library', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error ?? 'Upload failed')
      } else {
        setUploadResult(data)
        setLibraryCount(data.tracks)
        setStep('interview')
      }
    } catch {
      setUploadError('Network error — please try again')
    } finally {
      setUploading(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setStreamedText('')
    setParsedSet(null)
    setStep('generating')

    try {
      const res = await fetch('/api/generate-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setStreamedText(`Error: ${err.error}`)
        setStep('result')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setStreamedText(full)
      }

      const parsed = extractJSON(full)
      setParsedSet(parsed)
      setStep('result')
    } catch (err) {
      setStreamedText('Network error — please try again.')
      setStep('result')
    } finally {
      setGenerating(false)
    }
  }

  const navLinks = (
    <nav className="flex gap-6 text-sm text-zinc-400">
      <span className="text-zinc-100">Plan a Set</span>
      <Link href="/sets" className="hover:text-zinc-100 transition-colors">Sets</Link>
      <Link href="/library" className="hover:text-zinc-100 transition-colors">Library</Link>
    </nav>
  )

  // ── Welcome / Hero ──────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
        <header className="border-b border-zinc-800 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">DJ Set Planner</h1>
              <p className="text-xs text-zinc-500 mt-0.5">powered by Claude</p>
            </div>
            {navLinks}
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
          {/* Hero */}
          <div className="text-center max-w-2xl mb-16">
            <p className="text-xs font-medium tracking-widest uppercase text-zinc-500 mb-6">
              AI-powered set planning
            </p>
            <h2 className="text-5xl font-bold tracking-tight leading-tight mb-6">
              Plan your set.<br />
              <span className="text-zinc-400">Own the room.</span>
            </h2>
            <p className="text-lg text-zinc-400 leading-relaxed mb-10">
              Upload your Rekordbox library, tell Claude about your show,
              and get a curated set you can actually trust — in minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {libraryCount != null && libraryCount > 0 ? (
                <>
                  <button
                    onClick={() => setStep('interview')}
                    className="px-8 py-3.5 bg-white text-zinc-900 rounded-xl font-semibold text-sm hover:bg-zinc-100 transition-colors"
                  >
                    Plan a Set →
                  </button>
                  <button
                    onClick={() => setStep('upload')}
                    className="px-6 py-3.5 bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-xl text-sm hover:border-zinc-500 hover:text-zinc-100 transition-colors"
                  >
                    Re-upload Library ({libraryCount.toLocaleString()} tracks)
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setStep('upload')}
                  className="px-8 py-3.5 bg-white text-zinc-900 rounded-xl font-semibold text-sm hover:bg-zinc-100 transition-colors"
                >
                  Upload Your Library →
                </button>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-3 gap-6 max-w-2xl w-full">
            {[
              { num: '1', title: 'Upload your library', desc: 'Export from Rekordbox and upload the XML file.' },
              { num: '2', title: 'Describe your show', desc: 'Venue, time slot, energy arc, and vibe.' },
              { num: '3', title: 'Get your set', desc: 'Claude picks and orders tracks you can trust.' },
            ].map(({ num, title, desc }) => (
              <div key={num} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs font-mono text-zinc-600 mb-2">{num}</p>
                <p className="font-medium text-sm mb-1">{title}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  // ── Upload ──────────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <header className="border-b border-zinc-800 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">DJ Set Planner</h1>
              <p className="text-xs text-zinc-500 mt-0.5">powered by Claude</p>
            </div>
            {navLinks}
          </div>
        </header>

        <main className="max-w-xl mx-auto px-6 py-16">
          <button onClick={() => setStep('welcome')} className="text-xs text-zinc-500 hover:text-zinc-300 mb-8 inline-block transition-colors">
            ← Back
          </button>

          <h2 className="text-2xl font-semibold tracking-tight mb-2">Upload your library</h2>
          <p className="text-sm text-zinc-500 mb-8">
            In Rekordbox: <span className="text-zinc-300">File → Export Collection in xml format</span>.
            Then upload the file below.
          </p>

          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
              uploading
                ? 'border-zinc-600 bg-zinc-900/50'
                : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/30'
            }`}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleFileUpload(file)
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
            />

            {uploading ? (
              <>
                <div className="text-2xl mb-3 animate-pulse">⟳</div>
                <p className="text-sm text-zinc-400">Parsing and syncing your library…</p>
                <p className="text-xs text-zinc-600 mt-1">This may take a moment for large libraries</p>
              </>
            ) : (
              <>
                <div className="text-3xl mb-3 text-zinc-600">↑</div>
                <p className="text-sm text-zinc-300 font-medium mb-1">Drop your XML file here</p>
                <p className="text-xs text-zinc-600">or click to browse</p>
              </>
            )}
          </div>

          {uploadError && (
            <p className="mt-4 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-3">
              {uploadError}
            </p>
          )}

          {libraryCount != null && libraryCount > 0 && (
            <div className="mt-6 text-center">
              <p className="text-xs text-zinc-500 mb-3">
                You already have {libraryCount.toLocaleString()} tracks synced.
              </p>
              <button
                onClick={() => setStep('interview')}
                className="text-sm text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
              >
                Skip and plan a set with existing library →
              </button>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ── Interview Form ──────────────────────────────────────────────────────────
  if (step === 'interview') {
    const inputClass = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors'

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <header className="border-b border-zinc-800 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">DJ Set Planner</h1>
              <p className="text-xs text-zinc-500 mt-0.5">powered by Claude</p>
            </div>
            {navLinks}
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-10">
          <button onClick={() => setStep(libraryCount === 0 ? 'upload' : 'welcome')} className="text-xs text-zinc-500 hover:text-zinc-300 mb-8 inline-block transition-colors">
            ← Back
          </button>

          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Tell me about your show</h2>
              {libraryCount != null && (
                <p className="text-xs text-zinc-500 mt-1">{libraryCount.toLocaleString()} tracks in your library</p>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {/* Event details */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">The Show</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1.5">Event name</label>
                  <input
                    className={inputClass}
                    placeholder="Saturday @ Club Space"
                    value={context.event_name}
                    onChange={e => setContext(c => ({ ...c, event_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1.5">Venue</label>
                  <input
                    className={inputClass}
                    placeholder="Club Space, Miami"
                    value={context.venue}
                    onChange={e => setContext(c => ({ ...c, venue: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Time slot */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">Time Slot</h3>
              <div className="grid grid-cols-2 gap-3">
                {TIME_SLOTS.map(slot => (
                  <button
                    key={slot.value}
                    onClick={() => setContext(c => ({ ...c, time_slot: slot.value }))}
                    className={`p-4 rounded-xl border text-left transition-colors ${
                      context.time_slot === slot.value
                        ? 'border-white bg-white/5'
                        : 'border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    <p className={`text-sm font-medium mb-0.5 ${context.time_slot === slot.value ? 'text-white' : 'text-zinc-300'}`}>
                      {slot.label}
                    </p>
                    <p className="text-xs text-zinc-500">{slot.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">Set Duration</h3>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={30}
                  max={360}
                  step={15}
                  value={context.set_duration_minutes}
                  onChange={e => setContext(c => ({ ...c, set_duration_minutes: Number(e.target.value) }))}
                  className="flex-1 accent-white"
                />
                <div className="text-center w-20">
                  <p className="text-2xl font-semibold">{context.set_duration_minutes}</p>
                  <p className="text-xs text-zinc-500">minutes</p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-2">
                ~{Math.round(context.set_duration_minutes / 4)} tracks
              </p>
            </div>

            {/* Energy arc */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">Energy Arc</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {ENERGY_ARCS.map(arc => (
                  <button
                    key={arc.value}
                    onClick={() => setContext(c => ({ ...c, energy_arc: arc.value }))}
                    className={`p-4 rounded-xl border text-left transition-colors ${
                      context.energy_arc === arc.value
                        ? 'border-white bg-white/5'
                        : 'border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    <p className={`text-sm font-medium mb-0.5 ${context.energy_arc === arc.value ? 'text-white' : 'text-zinc-300'}`}>
                      {arc.label}
                    </p>
                    <p className="text-xs text-zinc-500">{arc.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Audience + vibe */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Audience & Vibe</h3>
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">Describe the crowd</label>
                <input
                  className={inputClass}
                  placeholder="Heads-down tech house crowd, they know their stuff"
                  value={context.audience_description}
                  onChange={e => setContext(c => ({ ...c, audience_description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">Vibe & vision <span className="text-zinc-600">(the most important field)</span></label>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={4}
                  placeholder="Deep, driving, hypnotic — I want people locked in from the start. Think early morning warehouse energy, UK influences, spacey chords..."
                  value={context.vibe_description}
                  onChange={e => setContext(c => ({ ...c, vibe_description: e.target.value }))}
                />
              </div>
            </div>

            {/* Must-include + options */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Options</h3>
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">Must-include tracks <span className="text-zinc-600">(optional)</span></label>
                <input
                  className={inputClass}
                  placeholder="Faithless - Insomnia, DJ Stingray - ..."
                  value={context.must_include}
                  onChange={e => setContext(c => ({ ...c, must_include: e.target.value }))}
                />
                <p className="text-xs text-zinc-600 mt-1">Artist — Title, comma-separated</p>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-3">Number of set options</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => setContext(c => ({ ...c, num_sets: n }))}
                      className={`w-12 h-10 rounded-lg border text-sm font-medium transition-colors ${
                        context.num_sets === n
                          ? 'border-white bg-white text-zinc-900'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!context.vibe_description.trim()}
              className="w-full py-4 bg-white text-zinc-900 rounded-xl font-semibold text-sm hover:bg-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate Set →
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Generating ──────────────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <header className="border-b border-zinc-800 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">DJ Set Planner</h1>
              <p className="text-xs text-zinc-500 mt-0.5">powered by Claude</p>
            </div>
            {navLinks}
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <p className="text-sm text-zinc-400">Claude is building your set…</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 font-mono text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed min-h-48">
            {streamedText || <span className="text-zinc-600">Thinking…</span>}
          </div>
        </main>
      </div>
    )
  }

  // ── Result ──────────────────────────────────────────────────────────────────
  if (step === 'result') {
    const set = parsedSet as any

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <header className="border-b border-zinc-800 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">DJ Set Planner</h1>
              <p className="text-xs text-zinc-500 mt-0.5">powered by Claude</p>
            </div>
            {navLinks}
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">{set?.set_title ?? 'Your Set'}</h2>
              {set?.set_notes && <p className="text-sm text-zinc-400 mt-1">{set.set_notes}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('interview'); setStreamedText(''); setParsedSet(null) }}
                className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
              >
                ← Adjust & Regenerate
              </button>
              <Link
                href="/sets"
                className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
              >
                View in Sets →
              </Link>
            </div>
          </div>

          {set?.tracks ? (
            <div className="space-y-2">
              {(set.tracks as any[]).map((track: any) => {
                const color =
                  track.energy_level === 'high'
                    ? 'bg-red-500'
                    : track.energy_level === 'low'
                    ? 'bg-blue-500'
                    : 'bg-yellow-500'
                return (
                  <div key={track.position} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-4">
                    <span className="text-xl font-semibold text-zinc-700 w-7 shrink-0 text-right pt-0.5">
                      {track.position}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-zinc-100 leading-tight">{track.title}</p>
                          <p className="text-sm text-zinc-400 mt-0.5">{track.artist}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                          {track.key && (
                            <span className="font-mono text-xs bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-300">
                              {track.key}
                            </span>
                          )}
                          {track.bpm && (
                            <span className="font-mono text-xs text-zinc-500">{track.bpm}BPM</span>
                          )}
                        </div>
                      </div>
                      {track.transition_note && (
                        <p className="text-xs text-zinc-500 mt-2 leading-relaxed border-t border-zinc-800 pt-2">
                          {track.transition_note}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            // Raw text fallback if JSON parsing failed
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 font-mono text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {streamedText}
            </div>
          )}
        </main>
      </div>
    )
  }

  return null
}
