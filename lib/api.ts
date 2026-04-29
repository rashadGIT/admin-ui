// All requests go through the Next.js proxy — never directly to Lambda from the browser.
// The proxy enforces role-based access and injects the server-side API key.
const BASE = "/api/proxy"

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
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
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParentLink {
  memberId?: string
  externalName?: string
  type: "biological" | "adoptive" | "step"
}

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
  role?: "admin" | "family_admin" | "user"
  adminFamilyIds?: string[]
  familyId?: string
  parents?: ParentLink[]
  parentIds?: string[] // deprecated — normalized to parents by API
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
  familyId?: string
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
  patriarchMemberId?: string
  patriarchName?: string
}

export interface FamilyRsvpSummary {
  familyId: string
  familyName: string
  total: number
  yes: number
  no: number
  maybe: number
  pending: number
  totalGuests: number
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const api = {
  rsvp: {
    summary: () => req<RsvpSummary>("GET", "rsvp"),
    allSummaries: () => req<{ items: FamilyRsvpSummary[] }>("GET", "rsvp/all"),
  },
  members: {
    list: () => req<{ items: Member[]; count: number }>("GET", "members"),
    save: (m: Partial<Member> & { memberId: string }) => req("POST", "members", m),
    update: (memberId: string, data: Partial<Member>) => req("PUT", `members/${memberId}`, data),
    remove: (memberId: string) => req("DELETE", `members/${encodeURIComponent(memberId)}`),
  },
  tasks: {
    list: () => req<{ items: Task[]; count: number }>("GET", "tasks"),
    create: (data: Partial<Task>) => req("POST", "tasks", data),
    update: (taskId: string, data: Partial<Task>) => req("PUT", `tasks/${taskId}`, data),
  },
  reunion: {
    list: () => req<{ items: ReunionInfoItem[] }>("GET", "reunion"),
    save: (infoId: string, data: Record<string, unknown>) =>
      req("PUT", `reunion/${infoId}`, data),
  },
  families: {
    list: () => req<{ items: FamilyRecord[]; count: number }>("GET", "families"),
    create: (data: Partial<FamilyRecord>) => req<{ ok: boolean; familyId: string }>("POST", "families", data),
    update: (familyId: string, data: Partial<FamilyRecord>) =>
      req("PUT", `families/${familyId}`, data),
  },
  auth: {
    setPassword: (email: string, passwordHash: string) =>
      req("POST", "auth/credentials", { email, passwordHash }),
  },
}
