import { supabase } from '@/lib/supabase'
import type { Set } from '@/lib/supabase'
import SetsList from '../../SetsList'

async function getSets(): Promise<Set[]> {
  const { data, error } = await supabase
    .from('sets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching sets:', error)
    return []
  }
  return data || []
}

export default async function LibrarySetsPage() {
  const sets = await getSets()

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          All Sets ({sets.length})
        </h2>
      </div>

      {sets.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-400 text-sm mb-2">No sets yet</p>
          <p className="text-zinc-600 text-xs">Plan your first set from the home page.</p>
        </div>
      ) : (
        <SetsList sets={sets} />
      )}
    </main>
  )
}
