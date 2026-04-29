"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { api, Member } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const RSVP_OPTIONS = [
  { value: "yes", label: "Yes, I'll be there" },
  { value: "no", label: "No, can't make it" },
  { value: "maybe", label: "Maybe" },
  { value: "pending", label: "Not decided yet" },
]

export default function ProfilePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const memberId = session?.user?.memberId
  const role = session?.user?.role

  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    preferredName: "",
    email: "",
    dob: "",
    rsvpStatus: "pending" as Member["rsvpStatus"],
    rsvpGuests: 0,
  })

  useEffect(() => {
    if (!memberId) return
    api.members.list().then(({ items }) => {
      const me = items.find(m => m.memberId === memberId)
      if (me) {
        setMember(me)
        setForm({
          firstName: me.firstName ?? "",
          lastName: me.lastName ?? "",
          preferredName: me.preferredName ?? "",
          email: me.email ?? "",
          dob: me.dob ?? "",
          rsvpStatus: me.rsvpStatus ?? "pending",
          rsvpGuests: me.rsvpGuests ?? 0,
        })
      }
    }).catch(() => setError("Failed to load profile.")).finally(() => setLoading(false))
  }, [memberId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberId) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await api.members.update(memberId, form)
      setSuccess(true)
      router.push(role === "user" ? "/tree" : "/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading…</div>
  if (!member) return <div className="p-8 text-sm text-red-500">Profile not found.</div>

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Profile</h2>
          <p className="text-sm text-gray-500 mt-0.5">Update your personal info and RSVP status.</p>
        </div>
      </div>

      {/* ── Personal Info ── */}
      <section className="bg-white rounded-2xl border p-6 space-y-4">
        <h3 className="text-base font-semibold mb-3">Personal Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block">First name</Label>
            <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
          </div>
          <div>
            <Label className="mb-1 block">Last name</Label>
            <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1 block">Preferred name</Label>
            <Input value={form.preferredName} onChange={e => setForm(f => ({ ...f, preferredName: e.target.value }))} placeholder="Optional nickname" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1 block">Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1 block">Date of birth</Label>
            <Input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
          </div>
        </div>
      </section>

      {/* ── RSVP ── */}
      {role !== "admin" && (
        <section className="bg-white rounded-2xl border p-6 space-y-4">
          <h3 className="text-base font-semibold mb-3">RSVP</h3>
          <div>
            <Label className="mb-1 block">Will you be attending?</Label>
            <select
              value={form.rsvpStatus}
              onChange={e => setForm(f => ({ ...f, rsvpStatus: e.target.value as Member["rsvpStatus"] }))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              {RSVP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {form.rsvpStatus === "yes" && (
            <div>
              <Label className="mb-1 block">Additional guests</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={form.rsvpGuests}
                onChange={e => setForm(f => ({ ...f, rsvpGuests: Number(e.target.value) }))}
              />
            </div>
          )}
        </section>
      )}

      {/* ── Account Info ── */}
      <section className="bg-white rounded-2xl border p-6 space-y-3">
        <h3 className="text-base font-semibold mb-3">Account Info</h3>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Role</span>
          <span className="font-medium capitalize">{session?.user?.role?.replace("_", " ")}</span>
        </div>
        {member.whatsappNumber && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">WhatsApp</span>
            <span className="font-medium">{member.whatsappNumber}</span>
          </div>
        )}
        {role !== "admin" && session?.user?.familyId && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Family ID</span>
            <span className="font-medium font-mono text-xs">{session.user.familyId}</span>
          </div>
        )}
      </section>

      {/* ── Save ── */}
      <div className="pb-8 flex flex-col sm:flex-row sm:items-center gap-3">
        <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {success && <p className="text-sm text-green-600">Saved successfully.</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </form>
  )
}
