"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { api, type Member, type FamilyRecord } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { MemberDialog } from "@/components/member-dialog"

type BadgeVariant = "success" | "destructive" | "secondary" | "outline"
const statusColor = (s?: string): BadgeVariant => {
  if (s === "yes") return "success"
  if (s === "no") return "destructive"
  if (s === "maybe") return "secondary"
  return "outline"
}

export default function FamilyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const familyId = params.familyId as string

  const [family, setFamily] = useState<FamilyRecord | null>(null)
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [allFamilies, setAllFamilies] = useState<FamilyRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Member | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const [editFamilyOpen, setEditFamilyOpen] = useState(false)
  const [editForm, setEditForm] = useState<Partial<FamilyRecord>>({})
  const [savingFamily, setSavingFamily] = useState(false)
  const [familyError, setFamilyError] = useState<string | null>(null)

  const members = allMembers.filter(m => m.familyId === familyId)

  const reload = () => {
    Promise.all([api.members.list(), api.families.list()])
      .then(([m, f]) => {
        setAllMembers(m.items)
        setAllFamilies(f.items)
        setFamily(f.items.find(x => x.familyId === familyId) ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [familyId])

  const openAdd = () => { setEditTarget(null); setMemberDialogOpen(true) }
  const openEdit = (m: Member) => { setEditTarget(m); setMemberDialogOpen(true) }

  const remove = async (memberId: string) => {
    if (!confirm("Remove this member?")) return
    setRemoveError(null)
    setAllMembers(prev => prev.filter(m => m.memberId !== memberId))
    try {
      await api.members.remove(memberId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setRemoveError(`Failed to remove: ${msg}`)
      reload()
    }
  }

  const openEditFamily = () => {
    if (!family) return
    setEditForm({ ...family })
    setFamilyError(null)
    setEditFamilyOpen(true)
  }

  const saveFamily = async () => {
    if (!editForm.familyId) return
    const inviteCode = editForm.inviteCode?.trim().toUpperCase() ?? ""
    if (!editForm.familyName?.trim()) { setFamilyError("Family name is required."); return }
    if (!inviteCode || inviteCode.includes(" ")) { setFamilyError("Invite code must not contain spaces."); return }
    setSavingFamily(true)
    setFamilyError(null)
    try {
      await api.families.update(editForm.familyId, {
        familyName: editForm.familyName.trim(),
        reunionName: editForm.reunionName?.trim(),
        reunionDate: editForm.reunionDate,
        inviteCode,
        organizerName: editForm.organizerName?.trim(),
        organizerMemberId: editForm.organizerMemberId,
        patriarchMemberId: editForm.patriarchMemberId,
        patriarchName: editForm.patriarchName,
      })
      setEditFamilyOpen(false)
      reload()
    } catch (err) {
      setFamilyError(err instanceof Error ? err.message : "Save failed.")
    } finally {
      setSavingFamily(false)
    }
  }

  const filtered = members.filter(m =>
    `${m.firstName} ${m.lastName ?? ""} ${m.whatsappNumber ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <p className="text-sm text-gray-400 p-8">Loading…</p>
  if (!family) return <p className="text-sm text-red-500 p-8">Family not found.</p>

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <Link href="/members" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Members
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{family.familyName}</h1>
            {family.reunionName && <p className="text-sm text-gray-400 mt-0.5">{family.reunionName}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={openEditFamily}>Edit Family</Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/tree")}>View Tree</Button>
          </div>
        </div>
      </div>

      {/* ── Info chips ── */}
      <div className="flex flex-wrap gap-4">
        {family.reunionDate && (
          <div className="bg-gray-50 border rounded-xl px-4 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Reunion Date</p>
            <p className="text-sm font-medium">{family.reunionDate.slice(0, 10)}</p>
          </div>
        )}
        {family.organizerName && (
          <div className="bg-gray-50 border rounded-xl px-4 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Organizer</p>
            <p className="text-sm font-medium">{family.organizerName}</p>
          </div>
        )}
        <div className="bg-gray-50 border rounded-xl px-4 py-2">
          <p className="text-xs text-gray-400 mb-0.5">Members</p>
          <p className="text-sm font-medium">{members.length}</p>
        </div>
      </div>

      {/* ── Members section ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Members</h2>
          <Button size="sm" onClick={openAdd}>+ Add Member</Button>
        </div>

        {removeError && (
          <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{removeError}</p>
        )}

        <div className="mb-4">
          <Input placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="w-full max-w-sm" />
        </div>

        <Card>
          <CardContent className="p-0">
            {/* Mobile list */}
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
                  <div className="flex gap-4">
                    <button onClick={() => openEdit(m)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => remove(m.memberId)} className="text-red-500 hover:underline text-xs">Remove</button>
                  </div>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-4 py-8 text-center text-gray-400">No members found</li>}
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
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(m)} className="text-blue-600 hover:underline mr-3 text-xs">Edit</button>
                        <button onClick={() => remove(m.memberId)} className="text-red-500 hover:underline text-xs">Remove</button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No members found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Member add/edit dialog */}
      <MemberDialog
        open={memberDialogOpen}
        members={allMembers}
        initialMember={editTarget}
        defaultFamilyId={familyId}
        onSave={reload}
        onClose={() => setMemberDialogOpen(false)}
      />

      {/* Edit family dialog */}
      <Dialog open={editFamilyOpen} onOpenChange={o => { if (!o) setEditFamilyOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {family.familyName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Family Name</Label>
              <Input value={editForm.familyName ?? ""} onChange={e => setEditForm(f => ({ ...f, familyName: e.target.value }))} />
            </div>
            <div>
              <Label>Reunion Name</Label>
              <Input value={editForm.reunionName ?? ""} onChange={e => setEditForm(f => ({ ...f, reunionName: e.target.value }))} />
            </div>
            <div>
              <Label>Invite Code</Label>
              <Input value={editForm.inviteCode ?? ""} onChange={e => setEditForm(f => ({ ...f, inviteCode: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <Label>Reunion Date</Label>
              <Input type="date" value={editForm.reunionDate?.slice(0, 10) ?? ""} onChange={e => setEditForm(f => ({ ...f, reunionDate: e.target.value }))} />
            </div>
            <div>
              <Label>Organizer</Label>
              <select
                value={editForm.organizerMemberId ?? ""}
                onChange={e => {
                  const m = allMembers.find(x => x.memberId === e.target.value)
                  setEditForm(f => ({
                    ...f,
                    organizerMemberId: m?.memberId ?? "",
                    organizerName: m ? `${m.firstName}${m.lastName ? " " + m.lastName : ""}` : "",
                  }))
                }}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">— None —</option>
                {members.map(m => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.firstName}{m.lastName ? " " + m.lastName : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Patriarch / Matriarch</Label>
              <select
                value={editForm.patriarchMemberId ?? ""}
                onChange={e => {
                  const m = allMembers.find(x => x.memberId === e.target.value)
                  setEditForm(f => ({
                    ...f,
                    patriarchMemberId: m?.memberId ?? "",
                    patriarchName: m ? `${m.firstName}${m.lastName ? " " + m.lastName : ""}` : "",
                  }))
                }}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">— None —</option>
                {members.map(m => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.firstName}{m.lastName ? " " + m.lastName : ""}
                  </option>
                ))}
              </select>
            </div>
            {familyError && <p className="text-sm text-red-500">{familyError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFamilyOpen(false)}>Cancel</Button>
            <Button disabled={savingFamily} onClick={saveFamily}>{savingFamily ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
