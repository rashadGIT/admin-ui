"use client"
import { useEffect, useState } from "react"
import { api, type Task, type Member } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "open" | "done">("all")
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ title: "", assignedTo: "", assignedToName: "", dueDate: "" })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api.tasks.list().then(r => setTasks(r.items)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api.members.list().then(r => setMembers(r.items)).catch(() => {})
  }, [])

  const toggleStatus = async (t: Task) => {
    const newStatus = t.status === "open" ? "done" : "open"
    await api.tasks.update(t.taskId, {
      ...t,
      status: newStatus,
      completedAt: newStatus === "done" ? new Date().toISOString() : undefined,
    })
    load()
  }

  const openDialog = () => {
    setForm({ title: "", assignedTo: "", assignedToName: "", dueDate: "" })
    setDialogOpen(true)
  }

  const handleCreate = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await api.tasks.create({
        title: form.title.trim(),
        assignedTo: form.assignedTo || undefined,
        assignedToName: form.assignedToName || undefined,
        dueDate: form.dueDate || undefined,
      })
      setDialogOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const filtered = tasks
    .filter(t => filter === "all" || t.status === filter)
    .filter(t => `${t.title} ${t.assignedToName ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))

  const openCount = tasks.filter(t => t.status === "open").length
  const doneCount = tasks.filter(t => t.status === "done").length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Tasks</h2>
          <p className="text-sm text-gray-500 mt-0.5">{openCount} open · {doneCount} done</p>
        </div>
        <Button onClick={openDialog}>+ Add Task</Button>
      </div>

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Search tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="w-32">
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="done">Done</option>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Loading…</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Task</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Assigned To</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Due</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.taskId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={t.status === "done" ? "line-through text-gray-400" : "font-medium"}>
                        {t.title}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.assignedToName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {t.dueDate ? (
                        <span className={t.status === "open" && t.dueDate < new Date().toISOString().slice(0, 10) ? "text-red-500 font-medium" : ""}>
                          {t.dueDate}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={t.status === "done" ? "success" : "outline"}>{t.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleStatus(t)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {t.status === "open" ? "Mark done" : "Reopen"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No tasks found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title *</Label>
              <Input
                placeholder="e.g. Buy ice bags"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Assign To</Label>
              <select
                value={form.assignedTo}
                onChange={e => {
                  const member = members.find(m => m.memberId === e.target.value)
                  setForm(f => ({
                    ...f,
                    assignedTo: member?.memberId ?? "",
                    assignedToName: member
                      ? `${member.firstName}${member.lastName ? " " + member.lastName : ""}`
                      : "",
                  }))
                }}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">— Unassigned —</option>
                {members.map(m => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.firstName}{m.lastName ? " " + m.lastName : ""}
                    {m.preferredName ? ` (${m.preferredName})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.title.trim()}>
              {saving ? "Saving…" : "Add Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
