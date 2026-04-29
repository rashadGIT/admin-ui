"use client"
import { useRef, useState } from "react"
import { api, type Member, type ParentLink } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

const auditLog = (action: string, details: Record<string, unknown>) => {
  console.log(`[MAMA AUDIT] ${new Date().toISOString()} | ${action}`, details)
}

export function resolveParentsClient(member: Partial<Member>): ParentLink[] {
  if (member.parents?.length) return member.parents
  return (member.parentIds ?? []).map(id => ({ memberId: id, type: "biological" as const }))
}

export function emptyMember(defaultFamilyId?: string): Partial<Member> & { memberId: string } {
  return {
    memberId: crypto.randomUUID(),
    firstName: "", lastName: "", preferredName: "",
    whatsappNumber: "", email: "", dob: "", rsvpStatus: "pending",
    isAdmin: false, parents: [], spouseId: undefined,
    isDeceased: false, deathDate: "",
    ...(defaultFamilyId ? { familyId: defaultFamilyId } : {}),
  }
}

interface MemberDialogProps {
  open: boolean
  members: Member[]
  initialMember?: Member | null
  defaultFamilyId?: string
  onSave: () => void
  onClose: () => void
}

export function MemberDialog({ open, members, initialMember, defaultFamilyId, onSave, onClose }: MemberDialogProps) {
  const [form, setForm] = useState<Partial<Member> & { memberId: string }>(() =>
    initialMember
      ? { ...initialMember, parents: resolveParentsClient(initialMember) }
      : emptyMember(defaultFamilyId)
  )
  const [childrenIds, setChildrenIds] = useState<string[]>(() =>
    initialMember
      ? members.filter(x => resolveParentsClient(x).some(p => p.memberId === initialMember.memberId)).map(x => x.memberId)
      : []
  )
  const [childrenOpen, setChildrenOpen] = useState(false)
  const childrenRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [spouseConflict, setSpouseConflict] = useState<{ newSpouseId: string; currentHolderId: string } | null>(null)

  // Re-initialize when initialMember changes (dialog reopen)
  const lastInitialRef = useRef<Member | null | undefined>(undefined)
  if (initialMember !== lastInitialRef.current) {
    lastInitialRef.current = initialMember
    const nextForm = initialMember
      ? { ...initialMember, parents: resolveParentsClient(initialMember) }
      : emptyMember(defaultFamilyId)
    setForm(nextForm)
    setChildrenIds(
      initialMember
        ? members.filter(x => resolveParentsClient(x).some(p => p.memberId === initialMember.memberId)).map(x => x.memberId)
        : []
    )
    setChildrenOpen(false)
    setSpouseConflict(null)
  }

  const memberName = (id: string) => {
    const m = members.find(x => x.memberId === id)
    return m ? `${m.firstName} ${m.lastName ?? ""}`.trim() : id
  }

  const otherMembers = members
    .filter(m => m.memberId !== form.memberId)
    .sort((a, b) => `${a.firstName} ${a.lastName ?? ""}`.localeCompare(`${b.firstName} ${b.lastName ?? ""}`))

  const toggleChild = (id: string) =>
    setChildrenIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSpouseChange = (newId: string) => {
    if (!newId) { setForm(f => ({ ...f, spouseId: undefined })); return }
    const newSpouseMember = members.find(m => m.memberId === newId)
    const currentHolder = newSpouseMember?.spouseId
      ? members.find(m => m.memberId === newSpouseMember.spouseId)
      : null
    if (currentHolder && currentHolder.memberId !== form.memberId) {
      setSpouseConflict({ newSpouseId: newId, currentHolderId: currentHolder.memberId })
    } else {
      setForm(f => ({ ...f, spouseId: newId }))
    }
  }

  const confirmSpouseReassign = () => {
    if (!spouseConflict) return
    setForm(f => ({ ...f, spouseId: spouseConflict.newSpouseId }))
    setSpouseConflict(null)
  }

  const save = async () => {
    if (!form.firstName) return
    setSaving(true)
    try {
      const original = members.find(m => m.memberId === form.memberId)

      if (original) {
        const fields = ["firstName", "lastName", "preferredName", "whatsappNumber", "email", "dob", "rsvpStatus", "isAdmin", "isDeceased", "deathDate"] as const
        fields.forEach(field => {
          if (original[field] !== form[field]) {
            auditLog("FIELD_CHANGE", { memberId: form.memberId, field, from: original[field], to: form[field] })
          }
        })
      }

      await api.members.save(form as Member & { memberId: string })
      auditLog("MEMBER_SAVED", { memberId: form.memberId })

      const oldSpouseId = original?.spouseId
      const newSpouseId = form.spouseId

      if (oldSpouseId !== newSpouseId) {
        const patches: Promise<unknown>[] = []
        if (oldSpouseId) {
          const oldSpouse = members.find(m => m.memberId === oldSpouseId)
          if (oldSpouse) patches.push(api.members.save({ ...oldSpouse, spouseId: undefined }))
        }
        if (newSpouseId) {
          const newSpouseMember = members.find(m => m.memberId === newSpouseId)
          const conflictHolderId = newSpouseMember?.spouseId
          if (conflictHolderId && conflictHolderId !== form.memberId) {
            const conflictHolder = members.find(m => m.memberId === conflictHolderId)
            if (conflictHolder) patches.push(api.members.save({ ...conflictHolder, spouseId: undefined }))
          }
          if (newSpouseMember) patches.push(api.members.save({ ...newSpouseMember, spouseId: form.memberId }))
        }
        await Promise.all(patches)
      }

      const originalChildren = members
        .filter(x => resolveParentsClient(x).some(p => p.memberId === form.memberId))
        .map(x => x.memberId)
      const toAdd = childrenIds.filter(id => !originalChildren.includes(id))
      const toRemove = originalChildren.filter(id => !childrenIds.includes(id))

      await Promise.all([
        ...toAdd.map(id => {
          const child = members.find(m => m.memberId === id)!
          return api.members.save({ ...child, parents: [...resolveParentsClient(child), { memberId: form.memberId, type: "biological" as const }] })
        }),
        ...toRemove.map(id => {
          const child = members.find(m => m.memberId === id)!
          return api.members.save({ ...child, parents: resolveParentsClient(child).filter(p => p.memberId !== form.memberId) })
        }),
      ])

      onSave()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{initialMember ? "Edit Member" : "Add Member"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {(["firstName", "lastName", "preferredName", "whatsappNumber", "email", "dob"] as const).map(field => (
              <div key={field}>
                <Label className="capitalize mb-1 block">{field.replace(/([A-Z])/g, " $1")}</Label>
                <Input
                  value={(form[field] as string) ?? ""}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={field === "dob" ? "YYYY-MM-DD" : field === "whatsappNumber" ? "15551234567" : ""}
                />
              </div>
            ))}
            <div>
              <Label className="mb-1 block">RSVP Status</Label>
              <Select value={form.rsvpStatus ?? "pending"} onChange={e => setForm(f => ({ ...f, rsvpStatus: e.target.value as Member["rsvpStatus"] }))}>
                <option value="pending">Pending</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="maybe">Maybe</option>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="mdb-isAdmin"
                checked={!!form.isAdmin}
                onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="mdb-isAdmin">Admin</Label>
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-center gap-3 mb-3">
              <hr className="flex-1 border-gray-200" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Family Connections</span>
              <hr className="flex-1 border-gray-200" />
            </div>

            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="block">Parents</Label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, parents: [...(f.parents ?? []), { memberId: "", type: "biological" as const }] }))}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Add parent
                </button>
              </div>
              {(form.parents ?? []).map((link, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    {link.externalName !== undefined ? (
                      <Input
                        placeholder="External parent name"
                        value={link.externalName}
                        onChange={e => setForm(f => {
                          const parents = [...(f.parents ?? [])]
                          parents[idx] = { ...parents[idx], externalName: e.target.value, memberId: undefined }
                          return { ...f, parents }
                        })}
                      />
                    ) : (
                      <Select
                        value={link.memberId ?? ""}
                        onChange={e => setForm(f => {
                          const parents = [...(f.parents ?? [])]
                          parents[idx] = { ...parents[idx], memberId: e.target.value, externalName: undefined }
                          return { ...f, parents }
                        })}
                      >
                        <option value="">Select parent…</option>
                        {otherMembers.map(m => (
                          <option key={m.memberId} value={m.memberId}>
                            {m.firstName} {m.lastName ?? ""}
                          </option>
                        ))}
                      </Select>
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-gray-300"
                        checked={link.externalName !== undefined}
                        onChange={e => setForm(f => {
                          const parents = [...(f.parents ?? [])]
                          parents[idx] = e.target.checked
                            ? { type: parents[idx].type, externalName: "" }
                            : { type: parents[idx].type, memberId: "" }
                          return { ...f, parents }
                        })}
                      />
                      Not in family tree
                    </label>
                  </div>
                  <Select
                    value={link.type}
                    onChange={e => setForm(f => {
                      const parents = [...(f.parents ?? [])]
                      parents[idx] = { ...parents[idx], type: e.target.value as ParentLink["type"] }
                      return { ...f, parents }
                    })}
                    className="w-32 shrink-0"
                  >
                    <option value="biological">Biological</option>
                    <option value="adoptive">Adoptive</option>
                    <option value="step">Step</option>
                  </Select>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, parents: (f.parents ?? []).filter((_, i) => i !== idx) }))}
                    className="text-red-400 hover:text-red-600 mt-1.5 text-lg leading-none"
                    aria-label="Remove parent"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <Label className="mb-1 block">Spouse</Label>
              <Select value={form.spouseId ?? ""} onChange={e => handleSpouseChange(e.target.value)}>
                <option value="">None</option>
                {otherMembers.map(m => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.firstName} {m.lastName ?? ""}
                    {m.spouseId && m.spouseId !== form.memberId ? " (married)" : ""}
                  </option>
                ))}
              </Select>
            </div>

            {otherMembers.length > 0 && (
              <div className="mt-4" ref={childrenRef}>
                <Label className="mb-1 block">Children</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setChildrenOpen(o => !o)}
                    className="w-full flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span className="truncate text-gray-700">
                      {childrenIds.length === 0 ? "Select children…" : childrenIds.map(id => memberName(id)).join(", ")}
                    </span>
                    <svg className="ml-2 h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {childrenOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                      {otherMembers.map(m => (
                        <label key={m.memberId} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={childrenIds.includes(m.memberId)}
                            onChange={() => toggleChild(m.memberId)}
                            className="h-3.5 w-3.5 rounded border-gray-300"
                          />
                          {m.firstName} {m.lastName ?? ""}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mdb-isDeceased"
                  checked={!!form.isDeceased}
                  onChange={e => setForm(f => ({ ...f, isDeceased: e.target.checked, deathDate: e.target.checked ? f.deathDate : "" }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="mdb-isDeceased">Deceased</Label>
              </div>
              {form.isDeceased && (
                <div className="flex items-center gap-2 flex-1">
                  <Label className="whitespace-nowrap text-sm text-gray-500">Death Date</Label>
                  <Input
                    value={form.deathDate ?? ""}
                    onChange={e => setForm(f => ({ ...f, deathDate: e.target.value }))}
                    placeholder="YYYY-MM-DD"
                    className="h-8 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spouse conflict confirmation dialog */}
      <Dialog open={!!spouseConflict} onOpenChange={() => setSpouseConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spouse Already Assigned</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            <strong>{memberName(spouseConflict?.newSpouseId ?? "")}</strong> is currently
            married to <strong>{memberName(spouseConflict?.currentHolderId ?? "")}</strong>.
            Reassigning will also remove{" "}
            <strong>{memberName(spouseConflict?.currentHolderId ?? "")}</strong>&apos;s spouse record.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpouseConflict(null)}>Cancel</Button>
            <Button onClick={confirmSpouseReassign}>Reassign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
