"use client"
import { useEffect, useState } from "react"
import { api, type Member, type FamilyRecord } from "@/lib/api"
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
  isAdmin: false,
})

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [families, setFamilies] = useState<FamilyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyMember())
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")

  const load = () => {
    setLoading(true)
    api.members.list().then(r => setMembers(r.items)).catch(() => {}).finally(() => setLoading(false))
    api.families.list().then(r => setFamilies(r.items)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const getFamilyName = (familyId?: string) =>
    families.find(f => f.familyId === familyId)?.familyName ?? familyId ?? "—"

  const openAdd = () => { setForm(emptyMember()); setDialogOpen(true) }
  const openEdit = (m: Member) => { setForm({ ...m }); setDialogOpen(true) }

  const save = async () => {
    if (!form.firstName) return
    setSaving(true)
    try {
      await api.members.save(form as Member & { memberId: string })
      setDialogOpen(false)
      load()
    } finally { setSaving(false) }
  }

  const remove = async (memberId: string) => {
    if (!confirm("Remove this member?")) return
    try {
      await api.members.remove(memberId)
      load()
    } catch {
      alert("Failed to remove member. Check your network connection.")
    }
  }

  const filtered = members.filter(m =>
    `${m.firstName} ${m.lastName ?? ""} ${m.whatsappNumber ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Members</h2>
        <Button onClick={openAdd}>+ Add Member</Button>
      </div>

      <div className="mb-4">
        <Input placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Loading…</p>
          ) : (
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
          )}
        </CardContent>
      </Card>

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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
