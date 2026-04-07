import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SYSTEM_PROMPT = `You are an expert DJ set planner. Your job is to build a coherent, well-paced set from a DJ's track library based on their show requirements.

Track format: [rekordbox_id|title|artist|BPM|key|genre|duration_secs|★rating|comments]

Guidelines:
- Match the requested set duration (assume ~4 min avg effective play time per track)
- Follow the energy arc exactly — it's the backbone of the set
- Consider harmonic mixing: prefer adjacent or matching Camelot wheel keys where possible
- Avoid playing the same artist back-to-back unless intentional
- Honor any must-include tracks — place them strategically based on energy level
- Avoid any tracks listed to skip
- Write a brief transition note for each track explaining why it follows the previous one

After any clarifying questions (limit: 1 round), output your final set as a JSON code block:

\`\`\`json
{
  "set_title": "...",
  "set_notes": "Brief description of the overall arc and vibe",
  "tracks": [
    {
      "position": 1,
      "track_id": "...",
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

energy_level must be one of: "low", "medium", "high"`

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
  rekordbox_id: number | null
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
  if (track.energy != null) score += 5 // bonus for analyzed tracks
  return score
}

function toClaudeStr(track: TrackRow): string {
  const dur = `${Math.floor(track.duration_seconds / 60)}:${(track.duration_seconds % 60).toString().padStart(2, '0')}`
  return `[${track.id}|${track.title}|${track.artist}|${track.bpm?.toFixed(0) ?? '?'}BPM|${track.key ?? '?'}|${track.genre ?? ''}|${dur}|★${track.rating}|${track.comments ?? ''}]`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500 })
  }

  const body = await req.json() as { context: SessionContext }
  const ctx = body.context

  // Fetch tracks from Supabase
  const { data: allTracks } = await supabase
    .from('tracks')
    .select('id, rekordbox_id, title, artist, bpm, key, genre, duration_seconds, rating, comments, energy')
    .order('rating', { ascending: false })

  if (!allTracks || allTracks.length === 0) {
    return new Response(JSON.stringify({ error: 'No tracks in library. Upload your Rekordbox XML first.' }), { status: 400 })
  }

  // Prefilter: top 100 by score
  const bpmTarget = bpmTargetForSlot(ctx.time_slot)
  const scored = (allTracks as TrackRow[])
    .map(t => ({ track: t, score: scoreTrack(t, bpmTarget) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 100)
    .map(x => x.track)

  const trackList = scored.map(toClaudeStr).join('\n')

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
${ctx.num_sets > 1 ? `- Please generate ${ctx.num_sets} distinct set options, each as its own JSON block.` : ''}

Here are my top tracks (pre-filtered for your time slot):
${trackList}

Build me a complete set plan.`

  const client = new Anthropic({ apiKey })

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = client.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: 8096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        })

        for await (const chunk of response) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
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
