"use client"
import { useEffect, useRef, useState } from "react"
import { api, type Member, type ParentLink, type FamilyRecord } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

type BadgeVariant = "success" | "destructive" | "secondary" | "outline"
const statusColor = (s?: string): BadgeVariant => {
  if (s === "yes") return "success"
  if (s === "no") return "destructive"
  if (s === "maybe") return "secondary"
  return "outline"
}

const emptyMember = (): Partial<Member> & { memberId: string } => ({
  memberId: crypto.randomUUID(),
  firstName: "", lastName: "", preferredName: "",
  whatsappNumber: "", email: "", dob: "", rsvpStatus: "pending",
  isAdmin: false, parents: [], spouseId: undefined,
  isDeceased: false, deathDate: "",
})

function resolveParentsClient(member: Partial<Member>): ParentLink[] {
  if (member.parents?.length) return member.parents
  return (member.parentIds ?? []).map(id => ({ memberId: id, type: "biological" as const }))
}

const auditLog = (action: string, details: Record<string, unknown>) => {
  console.log(`[MAMA AUDIT] ${new Date().toISOString()} | ${action}`, details)
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [families, setFamilies] = useState<FamilyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyMember())
  const [childrenIds, setChildrenIds] = useState<string[]>([])
  const [childrenOpen, setChildrenOpen] = useState(false)
  const childrenRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [spouseConflict, setSpouseConflict] = useState<{
    newSpouseId: string
    currentHolderId: string
  } | null>(null)

  const load = () => {
    setLoading(true)
    api.members.list().then(r => setMembers(r.items)).catch(() => {}).finally(() => setLoading(false))
    api.families.list().then(r => setFamilies(r.items)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (childrenRef.current && !childrenRef.current.contains(e.target as Node)) {
        setChildrenOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const getFamilyName = (familyId?: string) =>
    families.find(f => f.familyId === familyId)?.familyName ?? familyId ?? "—"

  const memberName = (id: string) => {
    const m = members.find(x => x.memberId === id)
    return m ? `${m.firstName} ${m.lastName ?? ""}`.trim() : id
  }

  const openAdd = () => {
    setForm(emptyMember())
    setChildrenIds([])
    setDialogOpen(true)
  }

  const openEdit = (m: Member) => {
    setForm({ ...m, parents: resolveParentsClient(m) })
    setChildrenIds(members.filter(x => resolveParentsClient(x).some(p => p.memberId === m.memberId)).map(x => x.memberId))
    setDialogOpen(true)
  }

  const handleSpouseChange = (newId: string) => {
    if (!newId) {
      setForm(f => ({ ...f, spouseId: undefined }))
      return
    }
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
            auditLog("FIELD_CHANGE", { memberId: form.memberId, name: memberName(form.memberId), field, from: original[field], to: form[field] })
          }
        })
      }

      await api.members.save(form as Member & { memberId: string })
      auditLog("MEMBER_SAVED", { memberId: form.memberId, name: memberName(form.memberId) })

      const oldSpouseId = original?.spouseId
      const newSpouseId = form.spouseId

      if (oldSpouseId !== newSpouseId) {
        auditLog("SPOUSE_CHANGE", {
          memberId: form.memberId,
          name: memberName(form.memberId),
          from: oldSpouseId ? memberName(oldSpouseId) : "none",
          to: newSpouseId ? memberName(newSpouseId) : "none",
        })

        const patches: Promise<unknown>[] = []

        if (oldSpouseId) {
          const oldSpouse = members.find(m => m.memberId === oldSpouseId)
          if (oldSpouse) {
            patches.push(api.members.save({ ...oldSpouse, spouseId: undefined }))
            auditLog("SPOUSE_CLEARED", { memberId: oldSpouseId, name: memberName(oldSpouseId) })
          }
        }

        if (newSpouseId) {
          const newSpouseMember = members.find(m => m.memberId === newSpouseId)
          const conflictHolderId = newSpouseMember?.spouseId

          if (conflictHolderId && conflictHolderId !== form.memberId) {
            const conflictHolder = members.find(m => m.memberId === conflictHolderId)
            if (conflictHolder) {
              patches.push(api.members.save({ ...conflictHolder, spouseId: undefined }))
              auditLog("SPOUSE_CLEARED", { memberId: conflictHolderId, name: memberName(conflictHolderId), reason: "conflict resolution" })
            }
          }

          if (newSpouseMember) {
            patches.push(api.members.save({ ...newSpouseMember, spouseId: form.memberId }))
            auditLog("SPOUSE_LINKED", { memberId: newSpouseId, name: memberName(newSpouseId), linkedTo: memberName(form.memberId) })
          }
        }

        await Promise.all(patches)
      }

      const originalChildren = members.filter(x => resolveParentsClient(x).some(p => p.memberId === form.memberId)).map(x => x.memberId)
      const toAdd = childrenIds.filter(id => !originalChildren.includes(id))
      const toRemove = originalChildren.filter(id => !childrenIds.includes(id))

      if (toAdd.length || toRemove.length) {
        auditLog("CHILDREN_CHANGE", {
          memberId: form.memberId,
          name: memberName(form.memberId),
          added: toAdd.map(memberName),
          removed: toRemove.map(memberName),
        })
      }

      await Promise.all([
        ...toAdd.map(id => {
          const child = members.find(m => m.memberId === id)!
          const childParents = resolveParentsClient(child)
          return api.members.save({ ...child, parents: [...childParents, { memberId: form.memberId, type: "biological" as const }] })
        }),
        ...toRemove.map(id => {
          const child = members.find(m => m.memberId === id)!
          const childParents = resolveParentsClient(child)
          return api.members.save({ ...child, parents: childParents.filter(p => p.memberId !== form.memberId) })
        }),
      ])

      setDialogOpen(false)
      load()
    } finally { setSaving(false) }
  }

  const remove = async (memberId: string) => {
    console.log("[MAMA] Remove clicked", { memberId })
    const ok = confirm("Remove this member?")
    console.log("[MAMA] Confirm result", { ok })
    if (!ok) return
    setRemoveError(null)
    setMembers(prev => prev.filter(m => m.memberId !== memberId))
    try {
      const result = await api.members.remove(memberId)
      console.log("[MAMA] Remove API result", { memberId, result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      console.error("[MAMA] Remove failed", { memberId, error: msg })
      setRemoveError(`Failed to remove member: ${msg}`)
      load()
    }
  }

  const filtered = members.filter(m =>
    `${m.firstName} ${m.lastName ?? ""} ${m.whatsappNumber ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )

  const otherMembers = members
    .filter(m => m.memberId !== form.memberId)
    .sort((a, b) => `${a.firstName} ${a.lastName ?? ""}`.localeCompare(`${b.firstName} ${b.lastName ?? ""}`))

  const toggleChild = (id: string) =>
    setChildrenIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Members</h2>
        <Button onClick={openAdd}>+ Add Member</Button>
      </div>

      {removeError && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{removeError}</p>
      )}

      <div className="mb-4">
        <Input placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="w-full max-w-sm" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Loading…</p>
          ) : (
            <>
              {/* Mobile card list */}
              <ul className="md:hidden divide-y">
                {filtered.map(m => (
                  <li key={m.memberId} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {m.firstName} {m.lastName ?? ""}
                          {m.preferredName && <span className="ml-1 text-gray-400 text-xs">({m.preferredName})</span>}
                          {m.isDeceased && <span className="ml-1 text-gray-400 text-xs">✝</span>}
                        </p>
                        {m.whatsappNumber && <p className="text-sm text-gray-500">{m.whatsappNumber}</p>}
                      </div>
                      <Badge variant={statusColor(m.rsvpStatus)} className="shrink-0">{m.rsvpStatus ?? "pending"}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                      {m.email && <span>{m.email}</span>}
                      {m.familyId && <span>{getFamilyName(m.familyId)}</span>}
                      {m.isAdmin && <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">Admin</Badge>}
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => openEdit(m)} className="text-blue-600 hover:underline text-xs">Edit</button>
                      <button onClick={() => remove(m.memberId)} className="text-red-500 hover:underline text-xs">Remove</button>
                    </div>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-4 py-8 text-center text-gray-400">No members found</li>
                )}
              </ul>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">RSVP</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">DOB</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Family</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Admin</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(m => (
                      <tr key={m.memberId} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {m.firstName} {m.lastName ?? ""}
                          {m.preferredName && <span className="ml-1 text-gray-400 text-xs">({m.preferredName})</span>}
                          {m.isDeceased && <span className="ml-1 text-gray-400 text-xs">✝</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{m.whatsappNumber ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{m.email ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusColor(m.rsvpStatus)}>{m.rsvpStatus ?? "pending"}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{m.dob ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{getFamilyName(m.familyId)}</td>
                        <td className="px-4 py-3">
                          {m.isAdmin && (
                            <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">Admin</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openEdit(m)} className="text-blue-600 hover:underline mr-3 text-xs">Edit</button>
                          <button onClick={() => remove(m.memberId)} className="text-red-500 hover:underline text-xs">Remove</button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No members found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit / Add member dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.firstName ? "Edit Member" : "Add Member"}</DialogTitle>
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
                id="isAdmin"
                checked={!!form.isAdmin}
                onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isAdmin">Admin</Label>
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
              <Select
                value={form.spouseId ?? ""}
                onChange={e => handleSpouseChange(e.target.value)}
              >
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
                      {childrenIds.length === 0
                        ? "Select children…"
                        : childrenIds.map(id => memberName(id)).join(", ")}
                    </span>
                    <svg className="ml-2 h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {childrenOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                      {otherMembers.map(m => (
                        <label
                          key={m.memberId}
                          className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                        >
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
                  id="isDeceased"
                  checked={!!form.isDeceased}
                  onChange={e => setForm(f => ({ ...f, isDeceased: e.target.checked, deathDate: e.target.checked ? f.deathDate : "" }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isDeceased">Deceased</Label>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
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
    </div>
  )
}
