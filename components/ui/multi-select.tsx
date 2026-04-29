"use client"
import { useEffect, useRef, useState } from "react"

interface MultiSelectProps {
  options: { value: string; label: string }[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  placeholder: string
  allLabel?: string
  className?: string
}

export function MultiSelect({ options, selected, onChange, placeholder, allLabel, className = "" }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const toggle = (value: string) => {
    const next = new Set(selected)
    next.has(value) ? next.delete(value) : next.add(value)
    onChange(next)
  }

  let triggerLabel: string
  if (selected.size === 0) {
    triggerLabel = allLabel ?? placeholder
  } else if (selected.size === 1) {
    const val = [...selected][0]
    triggerLabel = options.find(o => o.value === val)?.label ?? val
  } else {
    triggerLabel = `${selected.size} families selected`
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className={selected.size === 0 && !allLabel ? "text-gray-400" : "text-gray-700"}>
          {triggerLabel}
        </span>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">No options</p>
          ) : (
            options.map(opt => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(opt.value)}
                  onChange={() => toggle(opt.value)}
                  className="h-3.5 w-3.5 rounded border-gray-300"
                />
                {opt.label}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}
