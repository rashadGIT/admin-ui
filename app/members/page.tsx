"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { api, type Member, type FamilyRecord } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MemberDialog } from "@/components/member-dialog"

type BadgeVariant = "success" | "destructive" | "secondary" | "outline"
const statusColor = (s?: string): BadgeVariant => {
  if (s === "yes") return "success"
  if (s === "no") return "destructive"
  if (s === "maybe") return "secondary"
  return "outline"
}

// ─── Admin view: family list ──────────────────────────────────────────────────

function AdminFamilyList({ families, members }: { families: FamilyRecord[]; members: Member[] }) {
  const router = useRouter()
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Members</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {families.map(f => {
          const familyMembers = members.filter(m => m.familyId === f.familyId)
          const patriarch = f.patriarchMemberId
            ? members.find(m => m.memberId === f.patriarchMemberId)
            : null
          const patriarchName = patriarch
            ? `${patriarch.firstName} ${patriarch.lastName ?? ""}`.trim()
            : f.patriarchName ?? null
          return (
            <button
              key={f.familyId}
              onClick={() => router.push(`/families/${f.familyId}`)}
              className="text-left bg-white border rounded-2xl p-5 hover:shadow-md hover:border-gray-300 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-base group-hover:text-blue-600 transition-colors">
                  {f.familyName}
                </h3>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400 mt-0.5 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm text-gray-500">
                  <span className="text-gray-400 text-xs uppercase tracking-wide mr-1">Patriarch</span>
                  {patriarchName
                    ? <span className="font-medium text-gray-700">{patriarchName}</span>
                    : <span className="italic text-gray-400">Not set</span>}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{familyMembers.length}</span>
                  {" "}member{familyMembers.length !== 1 ? "s" : ""}
                </p>
              </div>
            </button>
          )
        })}
        {families.length === 0 && (
          <p className="col-span-full text-sm text-gray-400 py-8 text-center">No families found.</p>
        )}
      </div>
    </div>
  )
}

// ─── Family admin view: member table ─────────────────────────────────────────

function MemberTable({
  members, families, loading,
}: { members: Member[]; families: FamilyRecord[]; loading: boolean }) {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Member | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [localMembers, setLocalMembers] = useState(members)

  useEffect(() => { setLocalMembers(members) }, [members])

  const reload = () => {
    api.members.list().then(r => setLocalMembers(r.items)).catch(() => {})
  }

  const getFamilyName = (familyId?: string) =>
    families.find(f => f.familyId === familyId)?.familyName ?? familyId ?? "—"

  const openAdd = () => { setEditTarget(null); setDialogOpen(true) }
  const openEdit = (m: Member) => { setEditTarget(m); setDialogOpen(true) }

  const remove = async (memberId: string) => {
    if (!confirm("Remove this member?")) return
    setRemoveError(null)
    setLocalMembers(prev => prev.filter(m => m.memberId !== memberId))
    try {
      await api.members.remove(memberId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setRemoveError(`Failed to remove member: ${msg}`)
      reload()
    }
  }

  const filtered = localMembers.filter(m =>
    `${m.firstName} ${m.lastName ?? ""} ${m.whatsappNumber ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )

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

      <MemberDialog
        open={dialogOpen}
        members={localMembers}
        initialMember={editTarget}
        onSave={reload}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  const [members, setMembers] = useState<Member[]>([])
  const [families, setFamilies] = useState<FamilyRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.members.list(), api.families.list()])
      .then(([m, f]) => { setMembers(m.items); setFamilies(f.items) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (role === "admin") {
    return <AdminFamilyList families={families} members={members} />
  }

  return <MemberTable members={members} families={families} loading={loading} />
}
