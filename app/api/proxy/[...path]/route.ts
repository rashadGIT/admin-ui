import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

const LAMBDA_BASE = process.env.LAMBDA_BASE_URL!
const ADMIN_API_KEY = process.env.ADMIN_API_KEY!

// Paths that family_admin cannot access
const ADMIN_ONLY_PATHS = ["/families", "/auth/credentials"]

// Methods that user role cannot perform (except on their own profile)
const USER_READONLY_METHODS = new Set(["POST", "DELETE"])

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth()

  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { path } = await params
  const proxyPath = path.join("/")
  const role = session.user.role
  const memberId = session.user.memberId ?? ""
  const activeFamilyId = session.user.activeFamilyId ?? ""

  // Enforce family_admin cannot access admin-only paths
  if (role === "family_admin" && ADMIN_ONLY_PATHS.some(p => proxyPath.startsWith(p.replace("/", "")))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Enforce user role restrictions
  if (role === "user") {
    if (USER_READONLY_METHODS.has(req.method)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // user PUT: only allowed on their own member record
    if (req.method === "PUT" && !proxyPath.startsWith(`members/${memberId}`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  // Build the Lambda URL — re-encode each segment so special chars like # don't truncate the URL
  const url = new URL(req.url)
  const encodedPath = path.map(encodeURIComponent).join("/")
  const lambdaUrl = `${LAMBDA_BASE}/admin/${encodedPath}${url.search}`

  // Forward the request to Lambda with role context headers
  const body = req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined

  const lambdaRes = await fetch(lambdaUrl, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_API_KEY}`,
      "X-User-Role": role,
      "X-Active-Family-Id": activeFamilyId,
      "X-Member-Id": memberId,
    },
    body,
  })

  const data = await lambdaRes.text()

  return new NextResponse(data, {
    status: lambdaRes.status,
    headers: { "Content-Type": "application/json" },
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const OPTIONS = handler
