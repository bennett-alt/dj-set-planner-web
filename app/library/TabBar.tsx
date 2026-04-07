'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Tracks', href: '/library' },
  { label: 'Sets', href: '/library/sets' },
  { label: 'Playlists', href: '/library/playlists' },
]

export default function TabBar() {
  const pathname = usePathname()

  return (
    <div className="border-b border-zinc-800 px-6">
      <div className="max-w-7xl mx-auto flex gap-0">
        {TABS.map((tab) => {
          const isActive =
            tab.href === '/library'
              ? pathname === '/library'
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
