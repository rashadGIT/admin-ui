"use client"
import { useEffect, useState } from "react"
import { api, type RsvpSummary } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type BadgeVariant = "success" | "destructive" | "secondary" | "outline"
const statusColor = (s?: string): BadgeVariant => {
  if (s === "yes") return "success"
  if (s === "no") return "destructive"
  if (s === "maybe") return "secondary"
  return "outline"
}

export default function Dashboard() {
  const [data, setData] = useState<RsvpSummary | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api.rsvp.summary().then(setData).catch(() => setError("Failed to load RSVP data"))
  }, [])

  if (error) return <p className="text-red-500">{error}</p>
  if (!data) return <p className="text-muted-foreground">Loading…</p>

  const stats = [
    { label: "Total Members", value: data.total, color: "bg-blue-50 text-blue-700" },
    { label: "Attending",     value: data.yes,   color: "bg-green-50 text-green-700" },
    { label: "Not Attending", value: data.no,    color: "bg-red-50 text-red-700" },
    { label: "Maybe",         value: data.maybe, color: "bg-yellow-50 text-yellow-700" },
    { label: "No Response",   value: data.pending, color: "bg-gray-50 text-gray-700" },
    { label: "Total Guests",  value: data.totalGuests, color: "bg-purple-50 text-purple-700" },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* Stat cards */}
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

      {/* RSVP member list */}
      <Card>
        <CardHeader>
          <CardTitle>RSVP Status</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                  <td className="px-4 py-3 font-medium">
                    {m.firstName} {m.lastName ?? ""}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusColor(m.rsvpStatus)}>
                      {m.rsvpStatus ?? "pending"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.rsvpGuests ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
