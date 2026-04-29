"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { api, type RsvpSummary, type FamilyRecord, type FamilyRsvpSummary } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type BadgeVariant = "success" | "destructive" | "secondary" | "outline"
const statusColor = (s?: string): BadgeVariant => {
  if (s === "yes") return "success"
  if (s === "no") return "destructive"
  if (s === "maybe") return "secondary"
  return "outline"
}

// ─── Admin view: family cards grid ───────────────────────────────────────────

function RsvpChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg ${color}`}>
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-xs mt-0.5 opacity-75">{label}</span>
    </div>
  )
}

function AdminDashboard() {
  const router = useRouter()
  const [summaries, setSummaries] = useState<FamilyRsvpSummary[]>([])
  const [families, setFamilies] = useState<FamilyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.allSettled([api.rsvp.allSummaries(), api.families.list()])
      .then(([s, f]) => {
        if (s.status === "fulfilled") setSummaries(s.value.items)
        if (f.status === "fulfilled") setFamilies(f.value.items)
        if (s.status === "rejected" && f.status === "rejected") setError("Failed to load data.")
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-muted-foreground">Loading…</p>
  if (error) return <p className="text-red-500">{error}</p>

  // Use families as the primary data source; merge RSVP counts when available
  const summaryMap = new Map(summaries.map(s => [s.familyId, s]))

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {families.map(family => {
          const s = summaryMap.get(family.familyId)
          return (
            <button
              key={family.familyId}
              onClick={() => router.push(`/families/${family.familyId}`)}
              className="text-left bg-white border rounded-2xl p-5 hover:shadow-md hover:border-gray-300 transition-all group"
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-semibold text-base group-hover:text-blue-600 transition-colors">
                  {family.familyName}
                </h3>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400 mt-0.5 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              {family.reunionName && (
                <p className="text-xs text-gray-400 mb-3">{family.reunionName}</p>
              )}
              {s ? (
                <>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <RsvpChip label="Yes" value={s.yes} color="bg-green-50 text-green-700" />
                    <RsvpChip label="No" value={s.no} color="bg-red-50 text-red-700" />
                    <RsvpChip label="Maybe" value={s.maybe} color="bg-yellow-50 text-yellow-700" />
                    <RsvpChip label="Pending" value={s.pending} color="bg-gray-50 text-gray-600" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{s.total} member{s.total !== 1 ? "s" : ""} · {s.totalGuests} guest{s.totalGuests !== 1 ? "s" : ""}</span>
                    {family.reunionDate && <span>{family.reunionDate.slice(0, 10)}</span>}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-xs text-gray-400">
                  {family.reunionDate && <span>{family.reunionDate.slice(0, 10)}</span>}
                </div>
              )}
              {family.organizerName && (
                <p className="text-xs text-gray-400 mt-1">Organizer: {family.organizerName}</p>
              )}
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

// ─── Family admin view: RSVP table ───────────────────────────────────────────

function FamilyAdminDashboard() {
  const [data, setData] = useState<RsvpSummary | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api.rsvp.summary().then(setData).catch(() => setError("Failed to load RSVP data"))
  }, [])

  if (error) return <p className="text-red-500">{error}</p>
  if (!data) return <p className="text-muted-foreground">Loading…</p>

  const stats = [
    { label: "Total Members", value: data.total,       color: "bg-blue-50 text-blue-700" },
    { label: "Attending",     value: data.yes,         color: "bg-green-50 text-green-700" },
    { label: "Not Attending", value: data.no,          color: "bg-red-50 text-red-700" },
    { label: "Maybe",         value: data.maybe,       color: "bg-yellow-50 text-yellow-700" },
    { label: "No Response",   value: data.pending,     color: "bg-gray-50 text-gray-700" },
    { label: "Total Guests",  value: data.totalGuests, color: "bg-purple-50 text-purple-700" },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {stats.map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-gray-500">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className={`text-3xl font-bold px-2 py-0.5 rounded ${s.color}`}>{s.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>RSVP Status</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Guests</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map(m => (
                  <tr key={m.memberId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{m.firstName} {m.lastName ?? ""}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusColor(m.rsvpStatus)}>{m.rsvpStatus ?? "pending"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{m.rsvpGuests ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: session } = useSession()
  const role = session?.user?.role

  if (role === "admin") return <AdminDashboard />
  return <FamilyAdminDashboard />
}
