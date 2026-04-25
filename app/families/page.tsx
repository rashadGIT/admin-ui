"use client"
import { useEffect, useState } from "react"
import { api, type FamilyRecord, type Member } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const emptyNew = (): Partial<FamilyRecord> => ({
  familyName: "", reunionName: "", reunionDate: "", inviteCode: "", organizerName: "",
})

export default function FamiliesPage() {
  const [families, setFamilies] = useState<FamilyRecord[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const [editing, setEditing] = useState<FamilyRecord | null>(null)
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState<Partial<FamilyRecord>>(emptyNew())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = () => api.families.list().then(r => setFamilies(r.items)).catch(() => {})

  useEffect(() => {
    reload().finally(() => setLoading(false))
    api.members.list().then(r => setMembers(r.items)).catch(() => {}).finally(() => setMembersLoading(false))
  }, [])

  function openEdit(f: FamilyRecord) { setEditing({ ...f }); setError(null) }
  function closeEdit() { setEditing(null); setError(null) }
  function openAdd() { setNewForm(emptyNew()); setAdding(true); setError(null) }
  function closeAdd() { setAdding(false); setError(null) }

  async function handleAdd() {
    const inviteCode = newForm.inviteCode?.trim().toUpperCase() ?? ""
    if (!newForm.familyName?.trim()) { setError("Family name is required."); return }
    if (!inviteCode || inviteCode.includes(" ")) { setError("Invite code must not be empty or contain spaces."); return }
    if (!newForm.reunionName?.trim()) { setError("Reunion name is required."); return }

    setError(null)
    setSaving(true)
    try {
      await api.families.create({ ...newForm, inviteCode })
      setAdding(false)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create family.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!editing) return

    const inviteCode = editing.inviteCode.trim().toUpperCase()
    if (!inviteCode || inviteCode.includes(" ")) {
      setError("Invite code must not be empty or contain spaces.")
      return
    }
    if (!editing.familyName.trim()) {
      setError("Family name is required.")
      return
    }

    setError(null)
    setSaving(true)
    try {
      await api.families.update(editing.familyId, {
        familyName: editing.familyName.trim(),
        reunionName: editing.reunionName.trim(),
        reunionDate: editing.reunionDate,
        inviteCode,
        organizerName: editing.organizerName?.trim(),
        organizerMemberId: editing.organizerMemberId,
      })
      setEditing(null)
      reload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Families</h2>
        <Button onClick={openAdd}>+ Add Family</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Loading…</p>
          ) : families.length === 0 ? (
            <p className="p-6 text-muted-foreground">No families found.</p>
          ) : (
            <>
              {/* Mobile card list */}
              <ul className="md:hidden divide-y">
                {families.map(f => (
                  <li key={f.familyId} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{f.familyName}</p>
                        <p className="text-sm text-gray-500">{f.reunionName}</p>
                      </div>
                      <Badge variant={f.isActive ? "success" : "secondary"} className="shrink-0">
                        {f.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span>
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{f.inviteCode}</code>
                      </span>
                      {f.organizerName && <span>{f.organizerName}</span>}
                      {f.reunionDate && <span>{f.reunionDate.slice(0, 10)}</span>}
                    </div>
                    <button onClick={() => openEdit(f)} className="text-blue-600 hover:underline text-xs">
                      Edit
                    </button>
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Family</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Reunion</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Invite Code</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Organizer</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {families.map(f => (
                      <tr key={f.familyId} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{f.familyName}</td>
                        <td className="px-4 py-3 text-gray-500">{f.reunionName}</td>
                        <td className="px-4 py-3">
                          <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{f.inviteCode}</code>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{f.organizerName ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{f.reunionDate?.slice(0, 10) ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={f.isActive ? "success" : "secondary"}>
                            {f.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openEdit(f)} className="text-blue-600 hover:underline text-xs">
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Family Dialog */}
      <Dialog open={adding} onOpenChange={open => { if (!open) closeAdd() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Family</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Family Name</Label>
              <Input
                placeholder="e.g. Barnett"
                value={newForm.familyName ?? ""}
                onChange={e => setNewForm(f => ({ ...f, familyName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Reunion Name</Label>
              <Input
                placeholder="e.g. Barnett Family Reunion 2027"
                value={newForm.reunionName ?? ""}
                onChange={e => setNewForm(f => ({ ...f, reunionName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Invite Code</Label>
              <Input
                placeholder="e.g. BARNETT2027"
                value={newForm.inviteCode ?? ""}
                onChange={e => setNewForm(f => ({ ...f, inviteCode: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <Label>Reunion Date</Label>
              <Input
                type="date"
                value={newForm.reunionDate?.slice(0, 10) ?? ""}
                onChange={e => setNewForm(f => ({ ...f, reunionDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Organizer Name</Label>
              <Input
                placeholder="e.g. Rashad Barnett"
                value={newForm.organizerName ?? ""}
                onChange={e => setNewForm(f => ({ ...f, organizerName: e.target.value }))}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAdd}>Cancel</Button>
            <Button disabled={saving} onClick={handleAdd}>
              {saving ? "Creating…" : "Create Family"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Family Dialog */}
      <Dialog open={!!editing} onOpenChange={open => { if (!open) closeEdit() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.familyName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Family Name</Label>
              <Input
                value={editing?.familyName ?? ""}
                onChange={e => setEditing(f => f && ({ ...f, familyName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Reunion Name</Label>
              <Input
                value={editing?.reunionName ?? ""}
                onChange={e => setEditing(f => f && ({ ...f, reunionName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Invite Code</Label>
              <Input
                value={editing?.inviteCode ?? ""}
                onChange={e => setEditing(f => f && ({ ...f, inviteCode: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <Label>Organizer</Label>
              <select
                value={editing?.organizerMemberId ?? ""}
                disabled={membersLoading}
                onChange={e => {
                  const member = members.find(m => m.memberId === e.target.value)
                  setEditing(f => f && ({
                    ...f,
                    organizerMemberId: member?.memberId ?? "",
                    organizerName: member
                      ? `${member.firstName}${member.lastName ? " " + member.lastName : ""}`
                      : "",
                  }))
                }}
                className="w-full border rounded-md px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">— None —</option>
                {members.map(m => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.firstName}{m.lastName ? " " + m.lastName : ""}
                    {m.preferredName ? ` (${m.preferredName})` : ""}
                  </option>
                ))}
              </select>
              {membersLoading && <p className="text-xs text-gray-400 mt-1">Loading members…</p>}
            </div>
            <div>
              <Label>Reunion Date</Label>
              <Input
                type="date"
                value={editing?.reunionDate?.slice(0, 10) ?? ""}
                onChange={e => setEditing(f => f && ({ ...f, reunionDate: e.target.value }))}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
