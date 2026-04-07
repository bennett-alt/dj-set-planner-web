import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SYSTEM_PROMPT = `You are an expert DJ set planner. Your job is to build a coherent, well-paced set from a DJ's track library based on their show requirements.

Track format: [supabase_uuid|title|artist|BPM|key|genre|duration_secs|★rating|comments]

Guidelines:
- Match the requested set duration (assume ~4 min avg effective play time per track)
- Follow the energy arc exactly — it's the backbone of the set
- Consider harmonic mixing: prefer adjacent or matching Camelot wheel keys where possible
- Avoid playing the same artist back-to-back unless intentional
- Honor any must-include tracks — place them strategically based on energy level
- Write a brief transition note for each track explaining why it follows the previous one

Output your final set as a JSON code block with NO clarifying questions first:

\`\`\`json
{
  "set_title": "...",
  "set_notes": "Brief description of the overall arc and vibe",
  "tracks": [
    {
      "position": 1,
      "track_id": "the-supabase-uuid-from-the-track-format",
      "title": "...",
      "artist": "...",
      "bpm": 128.0,
      "key": "8A",
      "transition_note": "Opens with a slow, hypnotic groove to warm the room...",
      "energy_level": "low"
    }
  ]
}
\`\`\`

energy_level must be one of: "low", "medium", "high"
IMPORTANT: track_id must be the exact UUID from the first field of the track format, not the rekordbox ID.`

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

interface TrackRow {
  id: string
  title: string
  artist: string
  bpm: number | null
  key: string | null
  genre: string | null
  duration_seconds: number
  rating: number
  comments: string | null
  energy: number | null
}

function bpmTargetForSlot(slot: string): number {
  switch (slot) {
    case 'opening': return 122
    case 'peak hour': return 130
    case 'closing': return 120
    case 'all-night': return 126
    default: return 126
  }
}

function scoreTrack(track: TrackRow, bpmTarget: number): number {
  let score = (track.rating ?? 0) * 20
  if (track.bpm) {
    const bpmDiff = Math.abs(track.bpm - bpmTarget)
    score += Math.max(0, 15 - bpmDiff)
  }
  if (track.energy != null) score += 5
  return score
}

function toClaudeStr(track: TrackRow): string {
  const dur = `${Math.floor(track.duration_seconds / 60)}:${(track.duration_seconds % 60).toString().padStart(2, '0')}`
  return `[${track.id}|${track.title}|${track.artist}|${track.bpm?.toFixed(0) ?? '?'}BPM|${track.key ?? '?'}|${track.genre ?? ''}|${dur}|★${track.rating}|${track.comments ?? ''}]`
}

function extractJSON(text: string): object | null {
  const match = text.match(/```json\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

async function saveSet(setData: any, ctx: SessionContext): Promise<string | null> {
  try {
    const { data: setRow, error } = await supabase
      .from('sets')
      .insert({
        title: setData.set_title || ctx.event_name || 'Untitled Set',
        set_notes: setData.set_notes || null,
        event_name: ctx.event_name || null,
        venue: ctx.venue || null,
        set_duration_minutes: ctx.set_duration_minutes,
        time_slot: ctx.time_slot,
        audience_description: ctx.audience_description || null,
        energy_arc: ctx.energy_arc || null,
        vibe_description: ctx.vibe_description || null,
      })
      .select('id')
      .single()

    if (error || !setRow) {
      console.error('Error saving set:', error)
      return null
    }

    const setId = setRow.id

    const setTracks = (setData.tracks || [])
      .filter((t: any) => t.track_id)
      .map((t: any) => ({
        set_id: setId,
        track_id: t.track_id,
        position: t.position,
        transition_note: t.transition_note || null,
        energy_level: t.energy_level || 'medium',
        bpm_played: t.bpm || null,
      }))

    if (setTracks.length > 0) {
      const { error: tracksError } = await supabase.from('set_tracks').insert(setTracks)
      if (tracksError) console.error('Error saving set_tracks:', tracksError)
    }

    return setId
  } catch (err) {
    console.error('saveSet exception:', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured on the server. Add it to Vercel environment variables.' }), { status: 500 })
  }

  const body = await req.json() as { context: SessionContext }
  const ctx = body.context

  const { data: allTracks } = await supabase
    .from('tracks')
    .select('id, title, artist, bpm, key, genre, duration_seconds, rating, comments, energy')
    .order('rating', { ascending: false })

  if (!allTracks || allTracks.length === 0) {
    return new Response(JSON.stringify({ error: 'No tracks in library. Upload your Rekordbox XML first.' }), { status: 400 })
  }

  const bpmTarget = bpmTargetForSlot(ctx.time_slot)
  const candidates = (allTracks as TrackRow[])
    .map(t => ({ track: t, score: scoreTrack(t, bpmTarget) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 100)
    .map(x => x.track)

  const trackList = candidates.map(toClaudeStr).join('\n')
  const estimatedTracks = Math.max(1, Math.round(ctx.set_duration_minutes / 4))

  const userMessage = `Here is my show:
- Event: ${ctx.event_name || 'My set'}
- Venue: ${ctx.venue || 'TBD'}
- Time slot: ${ctx.time_slot}
- Set duration: ${ctx.set_duration_minutes} minutes (~${estimatedTracks} tracks)
- Audience: ${ctx.audience_description}
- Energy arc: ${ctx.energy_arc}
- Vibe: ${ctx.vibe_description}
${ctx.must_include ? `- Must include: ${ctx.must_include}` : ''}

Here are my top tracks (pre-filtered for your time slot):
${trackList}

Build me a complete set plan.`

  const client = new Anthropic({ apiKey })

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''
      try {
        const response = client.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: 8096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        })

        for await (const chunk of response) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullText += chunk.delta.text
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }

        // Save to Supabase after streaming completes
        const setData = extractJSON(fullText)
        if (setData) {
          const setId = await saveSet(setData, ctx)
          if (setId) {
            // Append sentinel so client can redirect to the saved set
            controller.enqueue(new TextEncoder().encode(`\n\n__SAVED_SET_ID__:${setId}`))
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(new TextEncoder().encode(`\n\n[Error: ${msg}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
