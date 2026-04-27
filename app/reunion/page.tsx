"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem     { id: string; item: string; notes: string }
interface Activity     { id: string; time: string; title: string; description: string }
interface Day          { id: string; date: string; label: string; startTime: string; endTime: string; location: string; address: string; dressCode: string; menu: MenuItem[]; activities: Activity[]; notes: string }
interface Faq          { id: string; question: string; answer: string }
interface Accommodation { id: string; name: string; details: string }

interface ReunionData {
  eventName: string
  groupPhoneNumber: string
  days: Day[]
  faqs: Faq[]
  accommodations: Accommodation[]
}

const DRESS_CODE_OPTIONS = ["Casual", "Smart Casual", "Business Casual", "Semi-Formal", "Formal / Black Tie", "Custom"]

const EMPTY: ReunionData = {
  eventName: "", groupPhoneNumber: "",
  days: [], faqs: [], accommodations: [],
}

function uid() { return crypto.randomUUID() }

function sortDays(days: Day[]): Day[] {
  return [...days].sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date.localeCompare(b.date)
  })
}

// ─── Soft-delete hook ─────────────────────────────────────────────────────────

function usePendingDeletes() {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const mark   = (id: string) => setIds(s => new Set(s).add(id))
  const unmark = (id: string) => setIds(s => { const n = new Set(s); n.delete(id); return n })
  const clear  = ()           => setIds(new Set())
  const has    = (id: string) => ids.has(id)
  return { mark, unmark, clear, has }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-base font-semibold">{title}</h3>
      {action}
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 mt-2"
    >
      + {label}
    </button>
  )
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-red-400 transition-colors"
      aria-label="Remove"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="1" y1="1" x2="9" y2="9" />
        <line x1="9" y1="1" x2="1" y2="9" />
      </svg>
    </button>
  )
}

function DeleteConfirmRow({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3 text-sm py-1">
      <span className="text-red-600">{label}</span>
      <button type="button" onClick={onConfirm} className="text-red-600 font-medium hover:underline">Yes, delete</button>
      <button type="button" onClick={onCancel} className="text-gray-500 hover:underline">Cancel</button>
    </div>
  )
}

// ─── Day Accordion ────────────────────────────────────────────────────────────

function DayAccordion({ day, readOnly, onChange, onMarkDelete, onUnmarkDelete, isPendingDelete, initialOpen = false }: {
  day: Day
  readOnly: boolean
  onChange: (d: Day) => void
  onMarkDelete: () => void
  onUnmarkDelete: () => void
  isPendingDelete: boolean
  initialOpen?: boolean
}) {
  const [open, setOpen] = useState(initialOpen)
  const [confirming, setConfirming] = useState(false)

  const headerLabel = [day.date, day.label].filter(Boolean).join(" · ") || "Untitled day"

  return (
    <div className={`border rounded-2xl overflow-hidden transition-colors ${isPendingDelete ? "bg-red-50 border-red-200" : "bg-white"}`}>
      <div
        role="button"
        tabIndex={isPendingDelete ? -1 : 0}
        onClick={() => { if (!isPendingDelete) setOpen(o => !o) }}
        onKeyDown={e => { if (!isPendingDelete && (e.key === "Enter" || e.key === " ")) setOpen(o => !o) }}
        className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors select-none ${isPendingDelete ? "cursor-default" : "hover:bg-gray-50 cursor-pointer"}`}
      >
        <span className={`font-medium text-sm ${isPendingDelete ? "line-through text-red-400" : ""}`}>{headerLabel}</span>
        <span className="flex items-center gap-2 shrink-0">
          {!readOnly && (
            isPendingDelete ? (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onUnmarkDelete() }}
                className="text-xs text-indigo-600 font-medium hover:underline"
              >
                Undo
              </button>
            ) : (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); setConfirming(true) }}
                className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-red-400 transition-colors"
                aria-label="Remove day"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="9" y2="9" />
                  <line x1="9" y1="1" x2="1" y2="9" />
                </svg>
              </span>
            )
          )}
          {!isPendingDelete && (
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            >
              <polyline points="4 6 8 10 12 6" />
            </svg>
          )}
        </span>
      </div>
      {confirming && !isPendingDelete && (
        <div className="border-t px-5 py-3">
          <DeleteConfirmRow
            label="Delete this day?"
            onConfirm={() => { onMarkDelete(); setConfirming(false); setOpen(false) }}
            onCancel={() => setConfirming(false)}
          />
        </div>
      )}
      {open && !isPendingDelete && (
        <div className="border-t px-5 pb-5 pt-4">
          <DayCard day={day} readOnly={readOnly} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

function DayCard({ day, readOnly, onChange }: {
  day: Day; readOnly: boolean; onChange: (d: Day) => void
}) {
  const set = (patch: Partial<Day>) => onChange({ ...day, ...patch })

  const addMenu     = () => set({ menu: [...day.menu, { id: uid(), item: "", notes: "" }] })
  const setMenu     = (i: number, patch: Partial<MenuItem>) => set({ menu: day.menu.map((m, j) => j === i ? { ...m, ...patch } : m) })
  const removeMenu  = (i: number) => set({ menu: day.menu.filter((_, j) => j !== i) })

  const addActivity    = () => set({ activities: [...day.activities, { id: uid(), time: "", title: "", description: "" }] })
  const setActivity    = (i: number, patch: Partial<Activity>) => set({ activities: day.activities.map((a, j) => j === i ? { ...a, ...patch } : a) })
  const removeActivity = (i: number) => set({ activities: day.activities.filter((_, j) => j !== i) })

  const dressCode = day.dressCode ?? ""
  const isPreset = DRESS_CODE_OPTIONS.includes(dressCode)
  // Custom mode: either "Custom" preset selected, or a non-empty value that isn't a preset
  const isCustomDress = dressCode === "Custom" || (!isPreset && dressCode !== "")
  const dropdownValue = isCustomDress ? "Custom" : dressCode

  return (
    <div className="space-y-5">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="mb-1 block text-xs">Date</Label>
          <Input type="date" value={day.date} readOnly={readOnly}
            onChange={e => set({ date: e.target.value })} />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Day label</Label>
          <Input value={day.label} placeholder="e.g. Day 1 – Arrival" readOnly={readOnly}
            onChange={e => set({ label: e.target.value })} />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Start time</Label>
          <Input type="time" value={day.startTime ?? ""} readOnly={readOnly}
            onChange={e => set({ startTime: e.target.value })} />
        </div>
        <div>
          <Label className="mb-1 block text-xs">End time</Label>
          <Input type="time" value={day.endTime ?? ""} readOnly={readOnly}
            onChange={e => set({ endTime: e.target.value })} />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Location / Venue</Label>
          <Input value={day.location ?? ""} placeholder="Venue name" readOnly={readOnly}
            onChange={e => set({ location: e.target.value })} />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Address</Label>
          <Input value={day.address ?? ""} placeholder="Street address" readOnly={readOnly}
            onChange={e => set({ address: e.target.value })} />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Dress Code</Label>
          {readOnly ? (
            <Input value={dressCode} readOnly />
          ) : (
            <select
              value={dropdownValue}
              onChange={e => set({ dressCode: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Select dress code…</option>
              {DRESS_CODE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
        </div>
        {isCustomDress && !readOnly && (
          <div>
            <Label className="mb-1 block text-xs">Custom dress code</Label>
            <Input
              value={isPreset ? "" : dressCode}
              placeholder="Describe the dress code…"
              onChange={e => set({ dressCode: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* Menu */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Menu</p>
        <div className="space-y-2">
          {day.menu.map((m, i) => (
            <div key={m.id} className="relative border rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pr-8">
              <RemoveBtn onClick={() => removeMenu(i)} />
              <Input value={m.item} placeholder="Item name" readOnly={readOnly}
                onChange={e => setMenu(i, { item: e.target.value })} />
              <Input value={m.notes} placeholder="Notes (optional)" readOnly={readOnly}
                onChange={e => setMenu(i, { notes: e.target.value })} />
            </div>
          ))}
        </div>
        {!readOnly && <AddButton label="Add menu item" onClick={addMenu} />}
      </div>

      {/* Activities */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Activities</p>
        <div className="space-y-2">
          {day.activities.map((a, i) => (
            <div key={a.id} className="relative border rounded-xl p-3 space-y-2 pr-8">
              <RemoveBtn onClick={() => removeActivity(i)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input type="time" value={a.time} readOnly={readOnly}
                  onChange={e => setActivity(i, { time: e.target.value })} />
                <Input value={a.title} placeholder="Activity title" readOnly={readOnly}
                  onChange={e => setActivity(i, { title: e.target.value })} />
              </div>
              <Textarea rows={2} value={a.description} placeholder="Description (optional)" readOnly={readOnly}
                onChange={e => setActivity(i, { description: e.target.value })} />
            </div>
          ))}
        </div>
        {!readOnly && <AddButton label="Add activity" onClick={addActivity} />}
      </div>

      {/* Day notes */}
      <div>
        <Label className="mb-1 block text-xs">Day notes</Label>
        <Textarea rows={2} value={day.notes} placeholder="Any additional notes for this day…" readOnly={readOnly}
          onChange={e => set({ notes: e.target.value })} />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReunionPage() {
  const { data: session } = useSession()
  const readOnly = session?.user?.role === "user"

  const [data, setData] = useState<ReunionData>(EMPTY)
  const [infoId, setInfoId] = useState<string | null>(null)
  const [newDayId, setNewDayId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deletedDays   = usePendingDeletes()
  const deletedFaqs   = usePendingDeletes()
  const deletedAccoms = usePendingDeletes()

  useEffect(() => {
    api.reunion.list().then(r => {
      const item = r.items[0]
      if (item) {
        setInfoId(item.infoId)
        setData({
          eventName:        (item.eventName as string)        ?? "",
          groupPhoneNumber: (item.groupPhoneNumber as string) ?? "",
          days:             sortDays((item.days as Day[])     ?? []),
          faqs:             (item.faqs as Faq[])              ?? [],
          accommodations:   (item.accommodations as Accommodation[]) ?? [],
        })
      } else {
        setInfoId("CONFIG")
      }
    }).catch(() => setInfoId("CONFIG")).finally(() => setLoading(false))
  }, [])

  const set = (patch: Partial<ReunionData>) => setData(d => ({ ...d, ...patch }))

  const handleSave = async () => {
    if (!infoId) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const payload = {
        ...data,
        days:           sortDays(data.days.filter(d => !deletedDays.has(d.id))),
        faqs:           data.faqs.filter(f => !deletedFaqs.has(f.id)),
        accommodations: data.accommodations.filter(a => !deletedAccoms.has(a.id)),
      }
      await api.reunion.save(infoId, payload as unknown as Record<string, unknown>)
      // Commit deletions to local state
      setData(d => ({
        ...d,
        days:           d.days.filter(x => !deletedDays.has(x.id)),
        faqs:           d.faqs.filter(x => !deletedFaqs.has(x.id)),
        accommodations: d.accommodations.filter(x => !deletedAccoms.has(x.id)),
      }))
      deletedDays.clear()
      deletedFaqs.clear()
      deletedAccoms.clear()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-400">Loading…</p>

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Reunion Info</h2>
        {readOnly && (
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-1">View only</span>
        )}
      </div>

      {/* ── Event Details ── */}
      <section className="bg-white rounded-2xl border p-6 space-y-4">
        <SectionHeader title="Event Details" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label className="mb-1 block">Event Name</Label>
            <Input value={data.eventName} readOnly={readOnly}
              onChange={e => set({ eventName: e.target.value })} />
          </div>
          {/* Group Phone Number — re-enable when group chat bot support is available
          <div className="sm:col-span-2">
            <Label className="mb-1 block">Group Phone Number</Label>
            <Input value={data.groupPhoneNumber} readOnly={readOnly}
              onChange={e => set({ groupPhoneNumber: e.target.value })} />
          </div>
          */}
        </div>
      </section>

      {/* ── Itinerary ── */}
      <section className="bg-white rounded-2xl border p-6 space-y-4">
        <SectionHeader title="Itinerary" />
        {data.days.length === 0 && (
          <p className="text-sm text-gray-400">{readOnly ? "No itinerary yet." : 'No days added yet. Click "+ Add day" to start.'}</p>
        )}
        <div className="space-y-4">
          {sortDays(data.days).map((day) => (
            <DayAccordion
              key={day.id}
              day={day}
              readOnly={readOnly}
              initialOpen={day.id === newDayId}
              isPendingDelete={deletedDays.has(day.id)}
              onMarkDelete={() => deletedDays.mark(day.id)}
              onUnmarkDelete={() => deletedDays.unmark(day.id)}
              onChange={d => set({ days: data.days.map(x => x.id === day.id ? d : x) })}
            />
          ))}
        </div>
        {!readOnly && (
          <AddButton label="Add day" onClick={() => {
            const id = uid()
            setNewDayId(id)
            set({ days: sortDays([...data.days, { id, date: "", label: "", startTime: "", endTime: "", location: "", address: "", dressCode: "", menu: [], activities: [], notes: "" }]) })
          }} />
        )}
      </section>

      {/* ── FAQs ── */}
      <section className="bg-white rounded-2xl border p-6 space-y-3">
        <SectionHeader title="FAQs" />
        {data.faqs.map((faq, i) => {
          const pending = deletedFaqs.has(faq.id)
          return (
            <FaqCard
              key={faq.id}
              faq={faq}
              readOnly={readOnly}
              isPendingDelete={pending}
              onMarkDelete={() => deletedFaqs.mark(faq.id)}
              onUnmarkDelete={() => deletedFaqs.unmark(faq.id)}
              onChange={patch => set({ faqs: data.faqs.map((f, j) => j === i ? { ...f, ...patch } : f) })}
            />
          )
        })}
        {data.faqs.length === 0 && readOnly && <p className="text-sm text-gray-400">No FAQs yet.</p>}
        {!readOnly && (
          <AddButton label="Add FAQ" onClick={() => set({ faqs: [...data.faqs, { id: uid(), question: "", answer: "" }] })} />
        )}
      </section>

      {/* ── Accommodations ── */}
      <section className="bg-white rounded-2xl border p-6 space-y-3">
        <SectionHeader title="Accommodations" />
        {data.accommodations.map((acc, i) => (
          <AccomCard
            key={acc.id}
            acc={acc}
            readOnly={readOnly}
            isPendingDelete={deletedAccoms.has(acc.id)}
            onMarkDelete={() => deletedAccoms.mark(acc.id)}
            onUnmarkDelete={() => deletedAccoms.unmark(acc.id)}
            onChange={patch => set({ accommodations: data.accommodations.map((a, j) => j === i ? { ...a, ...patch } : a) })}
          />
        ))}
        {data.accommodations.length === 0 && readOnly && <p className="text-sm text-gray-400">No accommodations listed yet.</p>}
        {!readOnly && (
          <AddButton label="Add accommodation" onClick={() => set({ accommodations: [...data.accommodations, { id: uid(), name: "", details: "" }] })} />
        )}
      </section>

      {/* ── Save ── */}
      {!readOnly && (
        <div className="pb-8 flex flex-col sm:flex-row sm:items-center gap-3">
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving…" : "Save all changes"}
          </Button>
          {saved && <p className="text-sm text-green-600">Saved successfully.</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}

// ─── FAQ Card ─────────────────────────────────────────────────────────────────

function FaqCard({ faq, readOnly, isPendingDelete, onMarkDelete, onUnmarkDelete, onChange }: {
  faq: Faq
  readOnly: boolean
  isPendingDelete: boolean
  onMarkDelete: () => void
  onUnmarkDelete: () => void
  onChange: (patch: Partial<Faq>) => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={`relative border rounded-xl p-4 space-y-2 transition-colors ${isPendingDelete ? "bg-red-50 border-red-200" : ""} ${!isPendingDelete ? "pr-8" : ""}`}>
      {!readOnly && (
        isPendingDelete ? (
          <button
            type="button"
            onClick={onUnmarkDelete}
            className="absolute top-3 right-3 text-xs text-indigo-600 font-medium hover:underline"
          >
            Undo
          </button>
        ) : (
          <RemoveBtn onClick={() => setConfirming(true)} />
        )
      )}
      <Input
        value={faq.question}
        placeholder="Question"
        readOnly={readOnly || isPendingDelete}
        className={isPendingDelete ? "line-through text-red-400" : ""}
        onChange={e => onChange({ question: e.target.value })}
      />
      <Textarea
        rows={2}
        value={faq.answer}
        placeholder="Answer"
        readOnly={readOnly || isPendingDelete}
        onChange={e => onChange({ answer: e.target.value })}
      />
      {confirming && !isPendingDelete && (
        <DeleteConfirmRow
          label="Delete this FAQ?"
          onConfirm={() => { onMarkDelete(); setConfirming(false) }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}

// ─── Accommodation Card ───────────────────────────────────────────────────────

function AccomCard({ acc, readOnly, isPendingDelete, onMarkDelete, onUnmarkDelete, onChange }: {
  acc: Accommodation
  readOnly: boolean
  isPendingDelete: boolean
  onMarkDelete: () => void
  onUnmarkDelete: () => void
  onChange: (patch: Partial<Accommodation>) => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={`relative border rounded-xl p-4 space-y-2 transition-colors ${isPendingDelete ? "bg-red-50 border-red-200" : ""} ${!isPendingDelete ? "pr-8" : ""}`}>
      {!readOnly && (
        isPendingDelete ? (
          <button
            type="button"
            onClick={onUnmarkDelete}
            className="absolute top-3 right-3 text-xs text-indigo-600 font-medium hover:underline"
          >
            Undo
          </button>
        ) : (
          <RemoveBtn onClick={() => setConfirming(true)} />
        )
      )}
      <Input
        value={acc.name}
        placeholder="Hotel / location name"
        readOnly={readOnly || isPendingDelete}
        className={isPendingDelete ? "line-through text-red-400" : ""}
        onChange={e => onChange({ name: e.target.value })}
      />
      <Textarea
        rows={2}
        value={acc.details}
        placeholder="Address, booking link, notes…"
        readOnly={readOnly || isPendingDelete}
        onChange={e => onChange({ details: e.target.value })}
      />
      {confirming && !isPendingDelete && (
        <DeleteConfirmRow
          label="Delete this accommodation?"
          onConfirm={() => { onMarkDelete(); setConfirming(false) }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
