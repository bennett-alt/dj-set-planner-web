import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side writes if available, else fall back to anon
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ParsedTrack {
  rekordbox_id: number
  file_path: string
  title: string
  artist: string
  album: string
  genre: string
  bpm: number
  key: string
  rating: number
  comments: string
  duration_seconds: number
  date_added: string
  label: string
  year: number
}

function getAttr(el: string, attr: string): string {
  const match = el.match(new RegExp(`${attr}="([^"]*)"`, 'i'))
  return match ? match[1] : ''
}

function decodeLocation(loc: string): string {
  try {
    let path = decodeURIComponent(loc.replace('file://localhost', ''))
    if (!path.startsWith('/')) path = '/' + path
    return path
  } catch {
    return loc
  }
}

function parseRekordboxXml(xml: string): { tracks: ParsedTrack[]; playlists: string[] } {
  const tracks: ParsedTrack[] = []

  // Extract COLLECTION tracks
  const collectionMatch = xml.match(/<COLLECTION[^>]*>([\s\S]*?)<\/COLLECTION>/)
  if (collectionMatch) {
    const trackRegex = /<TRACK\s([^/]*(?:\/(?!>)[^/]*)*)\/?>/g
    let m: RegExpExecArray | null
    while ((m = trackRegex.exec(collectionMatch[1])) !== null) {
      const el = m[0]
      const location = getAttr(el, 'Location')
      if (!location) continue

      const rawRating = parseInt(getAttr(el, 'Rating') || '0', 10)
      const track: ParsedTrack = {
        rekordbox_id: parseInt(getAttr(el, 'TrackID') || '0', 10),
        file_path: decodeLocation(location),
        title: getAttr(el, 'Name') || getAttr(el, 'Title') || 'Unknown',
        artist: getAttr(el, 'Artist') || '',
        album: getAttr(el, 'Album') || '',
        genre: getAttr(el, 'Genre') || '',
        bpm: parseFloat(getAttr(el, 'AverageBpm') || '0'),
        key: getAttr(el, 'Tonality') || '',
        rating: Math.round(rawRating / 51), // 0-255 → 0-5
        comments: getAttr(el, 'Comments') || '',
        duration_seconds: parseInt(getAttr(el, 'TotalTime') || '0', 10),
        date_added: getAttr(el, 'DateAdded') || '',
        label: getAttr(el, 'Label') || '',
        year: parseInt(getAttr(el, 'Year') || '0', 10),
      }
      tracks.push(track)
    }
  }

  // Extract playlist names
  const playlists: string[] = []
  const playlistRegex = /<NODE[^>]+Type="1"[^>]+Name="([^"]+)"/g
  let pm: RegExpExecArray | null
  while ((pm = playlistRegex.exec(xml)) !== null) {
    if (pm[1] !== 'ROOT') playlists.push(pm[1])
  }

  return { tracks, playlists }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.xml')) {
      return NextResponse.json({ error: 'File must be a .xml file' }, { status: 400 })
    }

    const xmlText = await file.text()

    if (!xmlText.includes('DJ_PLAYLISTS') && !xmlText.includes('COLLECTION')) {
      return NextResponse.json({ error: 'File does not appear to be a Rekordbox XML export' }, { status: 400 })
    }

    const { tracks, playlists } = parseRekordboxXml(xmlText)

    if (tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks found in the XML file' }, { status: 400 })
    }

    // Upsert in batches of 100
    let upserted = 0
    const batchSize = 100

    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize)
      const { error } = await supabase
        .from('tracks')
        .upsert(batch, { onConflict: 'file_path', ignoreDuplicates: false })

      if (error) {
        console.error('Upsert error:', error)
        // Continue with remaining batches rather than failing entirely
      } else {
        upserted += batch.length
      }
    }

    return NextResponse.json({
      tracks: upserted,
      total: tracks.length,
      playlists,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 })
  }
}
