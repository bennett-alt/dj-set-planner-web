import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions matching the Supabase schema
export type Track = {
  id: string
  rekordbox_id: number | null
  file_path: string
  title: string
  artist: string
  album: string
  genre: string
  bpm: number | null
  key: string | null
  rating: number
  comments: string | null
  duration_seconds: number
  energy: number | null
  brightness: number | null
  onset_density: number | null
  energy_profile: number[] | null
  peak_energy_position: number | null
  tempo_stability: number | null
  dynamic_range: number | null
  analyzed_at: string | null
  created_at: string
}

export type Set = {
  id: string
  title: string
  set_notes: string | null
  event_name: string | null
  venue: string | null
  set_duration_minutes: number
  time_slot: string | null
  audience_description: string | null
  energy_arc: string | null
  vibe_description: string | null
  created_at: string
}

export type SetTrack = {
  id: string
  set_id: string
  track_id: string
  position: number
  transition_note: string | null
  energy_level: string | null
  bpm_played: number | null
  track?: Track
}
