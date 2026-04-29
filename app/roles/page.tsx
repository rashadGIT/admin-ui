"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { api, Member, FamilyRecord } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Role = "admin" | "family_admin" | "user"

function RoleBadge({ role }: { role?: string }) {
  const styles: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    family_admin: "bg-blue-100 text-blue-700",
    user: "bg-gray-100 text-gray-600",
  }
  const label = role === "family_admin" ? "Family Admin" : role === "admin" ? "Admin" : "User"
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[role ?? "user"] ?? styles.user}`}>
      {label}
    </span>
  )
}

function PasswordModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!member.email) return
    setLoading(true)
    setError(null)
    try {
      await api.auth.setPassword(member.email, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-6 space-y-4">
        <h2 className="font-bold text-lg">Set password</h2>
        <p className="text-sm text-gray-500">
          {member.firstName} {member.lastName} — <span className="font-mono">{member.email}</span>
        </p>
        {done ? (
          <>
            <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">Password set successfully.</p>
            <Button className="w-full" onClick={onClose}>Done</Button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {!member.email && (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                This member has no email address. Add one first.
              </p>
            )}
            <div>
              <Label className="mb-1 block">New password</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                minLength={8}
                required
                disabled={!member.email}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={loading || !member.email}>
                {loading ? "Saving…" : "Set password"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function RoleEditor({
  member, families, onSave,
}: {
  member: Member
  families: FamilyRecord[]
  onSave: (memberId: string, role: Role, adminFamilyIds: string[]) => Promise<void>
}) {
  const [role, setRole] = useState<Role>((member.role as Role) ?? "user")
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>(member.adminFamilyIds ?? [])
  const [saving, setSaving] = useState(false)

  const toggleFamily = (id: string) => {
    setSelectedFamilies(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(member.memberId, role, role === "family_admin" ? selectedFamilies : [])
    setSaving(false)
  }

  return (
    <div className="space-y-2">
      <select
        value={role}
        onChange={e => setRole(e.target.value as Role)}
        className="border rounded-md px-2 py-1 text-sm bg-white w-full"
      >
        <option value="user">User</option>
        <option value="family_admin">Family Admin</option>
        <option value="admin">Admin</option>
      </select>
      {role === "family_admin" && (
        <div className="border rounded-md p-2 space-y-1 max-h-32 overflow-y-auto">
          {families.map(f => (
            <label key={f.familyId} className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={selectedFamilies.includes(f.familyId)}
                onChange={() => toggleFamily(f.familyId)}
                className="rounded"
              />
              {f.familyName}
            </label>
          ))}
        </div>
      )}
      <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save role"}
      </Button>
    </div>
  )
}

export default function RolesPage() {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const adminFamilyIds = session?.user?.adminFamilyIds ?? []

  const [members, setMembers] = useState<Member[]>([])
  const [families, setFamilies] = useState<FamilyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [passwordTarget, setPasswordTarget] = useState<Member | null>(null)
  const [search, setSearch] = useState("")
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("")

  useEffect(() => {
    Promise.all([api.members.list(), api.families.list()])
      .then(([m, f]) => {
        setMembers(m.items)
        setFamilies(f.items)
        // family_admin: auto-select if only one family
        if (userRole === "family_admin" && adminFamilyIds.length === 1) {
          setSelectedFamilyId(adminFamilyIds[0])
        }
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false))
  }, [])

  const handleSaveRole = async (memberId: string, role: Role, newAdminFamilyIds: string[]) => {
    await api.members.update(memberId, { role, adminFamilyIds: newAdminFamilyIds })
    setMembers(prev => prev.map(m => m.memberId === memberId ? { ...m, role, adminFamilyIds: newAdminFamilyIds } : m))
  }

  // Families visible in the selector
  const visibleFamilies = userRole === "admin"
    ? families
    : families.filter(f => adminFamilyIds.includes(f.familyId))

  const filteredMembers = (selectedFamilyId
    ? members.filter(m => m.familyId === selectedFamilyId)
    : []
  ).filter(m => {
    const q = search.toLowerCase()
    return (
      m.firstName?.toLowerCase().includes(q) ||
      m.lastName?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    )
  })

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roles</h1>
        <p className="text-sm text-gray-500 mt-1">Assign roles and manage login credentials.</p>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {/* Family selector */}
      <div className="max-w-sm">
        <label className="block text-sm font-medium text-gray-700 mb-1">Family</label>
        <select
          value={selectedFamilyId}
          onChange={e => setSelectedFamilyId(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="">Select a family…</option>
          {visibleFamilies.map(f => (
            <option key={f.familyId} value={f.familyId}>{f.familyName}</option>
          ))}
        </select>
      </div>

      {!selectedFamilyId ? (
        <p className="text-sm text-gray-400 py-4">Select a family to manage roles.</p>
      ) : (
        <>
          <Input
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Current role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-64">Change role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Password</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredMembers.map(m => (
                  <tr key={m.memberId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{m.firstName} {m.lastName}</p>
                      {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                    <td className="px-4 py-3">
                      <RoleEditor member={m} families={families} onSave={handleSaveRole} />
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" onClick={() => setPasswordTarget(m)} disabled={!m.email}>
                        Set password
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredMembers.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">No members found.</p>
            )}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredMembers.map(m => (
              <div key={m.memberId} className="bg-white rounded-2xl border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{m.firstName} {m.lastName}</p>
                    {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                  </div>
                  <RoleBadge role={m.role} />
                </div>
                <RoleEditor member={m} families={families} onSave={handleSaveRole} />
                <Button size="sm" variant="outline" className="w-full" onClick={() => setPasswordTarget(m)} disabled={!m.email}>
                  Set password
                </Button>
              </div>
            ))}
            {filteredMembers.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">No members found.</p>
            )}
          </div>
        </>
      )}

      {passwordTarget && (
        <PasswordModal member={passwordTarget} onClose={() => setPasswordTarget(null)} />
      )}
    </div>
  )
}
