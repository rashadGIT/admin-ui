const BASE = process.env.NEXT_PUBLIC_API_BASE!
const KEY  = process.env.NEXT_PUBLIC_ADMIN_API_KEY!

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let message = `${method} /${path} → ${res.status}`
    try {
      const errBody = await res.json() as { error?: string }
      if (errBody?.error) message = errBody.error
    } catch { /* ignore parse failure */ }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Member {
  memberId: string
  firstName: string
  lastName?: string
  preferredName?: string
  whatsappNumber?: string
  email?: string
  dob?: string
  rsvpStatus?: "yes" | "no" | "maybe" | "pending"
  rsvpGuests?: number
  rsvpTimestamp?: string
  isAdmin?: boolean
  familyId?: string
  parentIds?: string[]
  spouseId?: string
  isDeceased?: boolean
  deathDate?: string
  tribute?: string
}

export interface Task {
  taskId: string
  title: string
  status: "open" | "done"
  assignedToName?: string
  assignedTo?: string
  dueDate?: string
  createdByName?: string
  createdAt?: string
  completedAt?: string
}

export interface ReunionInfoItem {
  infoId: string
  [key: string]: unknown
}

export interface RsvpSummary {
  total: number
  yes: number
  no: number
  maybe: number
  pending: number
  totalGuests: number
  members: Member[]
}

export interface FamilyRecord {
  familyId: string
  familyName: string
  reunionName: string
  reunionDate: string
  isActive: boolean
  inviteCode: string
  organizerName?: string
  organizerMemberId?: string
  adminPhones: string[]
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const api = {
  rsvp: {
    summary: () => req<RsvpSummary>("GET", "admin/rsvp"),
  },
  members: {
    list: () => req<{ items: Member[]; count: number }>("GET", "admin/members"),
    save: (m: Partial<Member> & { memberId: string }) => req("POST", "admin/members", m),
    remove: (memberId: string) => req("DELETE", `admin/members/${encodeURIComponent(memberId)}`),
  },
  tasks: {
    list: () => req<{ items: Task[]; count: number }>("GET", "admin/tasks"),
    create: (data: Partial<Task>) => req("POST", "admin/tasks", data),
    update: (taskId: string, data: Partial<Task>) => req("PUT", `admin/tasks/${taskId}`, data),
  },
  reunion: {
    list: () => req<{ items: ReunionInfoItem[] }>("GET", "admin/reunion"),
    save: (infoId: string, data: Record<string, unknown>) =>
      req("PUT", `admin/reunion/${infoId}`, data),
  },
  families: {
    list: () => req<{ items: FamilyRecord[]; count: number }>("GET", "admin/families"),
    create: (data: Partial<FamilyRecord>) => req<{ ok: boolean; familyId: string }>("POST", "admin/families", data),
    update: (familyId: string, data: Partial<FamilyRecord>) =>
      req("PUT", `admin/families/${familyId}`, data),
  },
}
