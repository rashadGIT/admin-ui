"use client"
import { useEffect, useState } from "react"
import { api, type ReunionInfoItem } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

// Known structured fields — everything else is shown as raw key/value
const FIELDS: { key: string; label: string; type: "text" | "textarea" }[] = [
  { key: "eventName",       label: "Event Name",        type: "text"     },
  { key: "date",            label: "Date",               type: "text"     },
  { key: "time",            label: "Time",               type: "text"     },
  { key: "location",        label: "Location",           type: "text"     },
  { key: "address",         label: "Address",            type: "text"     },
  { key: "dressCode",       label: "Dress Code",         type: "text"     },
  { key: "groupPhoneNumber",label: "Group Phone Number", type: "text"     },
  { key: "schedule",        label: "Schedule",           type: "textarea" },
  { key: "notes",           label: "Notes",              type: "textarea" },
]

export default function ReunionPage() {
  const [items, setItems] = useState<ReunionInfoItem[]>([])
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.reunion.list().catch(() => ({ items: [] as ReunionInfoItem[] })).then(r => {
      setItems(r.items)
      const initial: Record<string, Record<string, string>> = {}
      for (const item of r.items) {
        initial[item.infoId] = {}
        for (const f of FIELDS) {
          initial[item.infoId][f.key] = (item[f.key] as string) ?? ""
        }
      }
      setForms(initial)
    }).finally(() => setLoading(false))
  }, [])

  const setField = (infoId: string, key: string, value: string) => {
    setForms(f => ({ ...f, [infoId]: { ...f[infoId], [key]: value } }))
  }

  const saveItem = async (infoId: string) => {
    setSaving(infoId)
    try {
      await api.reunion.save(infoId, forms[infoId] ?? {})
      setSaved(infoId)
      setTimeout(() => setSaved(null), 2000)
    } finally { setSaving(null) }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>

  if (items.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Reunion Info</h2>
        <p className="text-gray-500">No reunion info records found. Add one via the bot with <code>/info</code> or through DynamoDB directly.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Reunion Info</h2>
      <div className="space-y-6">
        {items.map(item => (
          <Card key={item.infoId}>
            <CardHeader>
              <CardTitle className="text-base">{item.infoId}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {FIELDS.map(f => (
                  <div key={f.key} className={f.type === "textarea" ? "col-span-2" : ""}>
                    <Label className="mb-1 block">{f.label}</Label>
                    {f.type === "textarea" ? (
                      <Textarea
                        rows={3}
                        value={forms[item.infoId]?.[f.key] ?? ""}
                        onChange={e => setField(item.infoId, f.key, e.target.value)}
                      />
                    ) : (
                      <Input
                        value={forms[item.infoId]?.[f.key] ?? ""}
                        onChange={e => setField(item.infoId, f.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <Button onClick={() => saveItem(item.infoId)} disabled={saving === item.infoId}>
                  {saving === item.infoId ? "Saving…" : "Save"}
                </Button>
                {saved === item.infoId && <span className="text-green-600 text-sm">Saved!</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
