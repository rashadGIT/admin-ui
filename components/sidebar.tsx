"use client"
import { useState } from "react"
import Link from "next/link"

const nav = [
  { href: "/",         label: "Dashboard"    },
  { href: "/members",  label: "Members"      },
  { href: "/tree",     label: "Family Tree"  },
  { href: "/tasks",    label: "Tasks"        },
  { href: "/reunion",  label: "Reunion Info" },
  { href: "/families", label: "Families"     },
]

export function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b shrink-0">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-none">Admin</p>
          <h1 className="text-base font-bold">Mama Reunion</h1>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown nav */}
      {open && (
        <nav className="md:hidden bg-white border-b px-4 py-2 space-y-1">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {label}
            </Link>
          ))}
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r flex-col shrink-0">
        <div className="px-6 py-5 border-b">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
          <h1 className="text-lg font-bold mt-0.5">Mama Reunion</h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  )
}
