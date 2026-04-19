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

export default function FamiliesPage() {
  const [families, setFamilies] = useState<FamilyRecord[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(true)
  const [editing, setEditing] = useState<FamilyRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.families.list().then(r => setFamilies(r.items)).catch(() => {}).finally(() => setLoading(false))
    api.members.list().then(r => setMembers(r.items)).catch(() => {}).finally(() => setMembersLoading(false))
  }, [])

  function openEdit(f: FamilyRecord) {
    setEditing({ ...f })
    setError(null)
  }

  function closeEdit() {
    setEditing(null)
    setError(null)
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
      api.families.list().then(r => setFamilies(r.items))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Families</h2>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Loading…</p>
          ) : families.length === 0 ? (
            <p className="p-6 text-muted-foreground">No families found.</p>
          ) : (
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
                      <button
                        onClick={() => openEdit(f)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

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
