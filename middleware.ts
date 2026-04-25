import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/api/auth"]

export default auth(function middleware(req: NextRequest & { auth: Awaited<ReturnType<typeof auth>> }) {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Allow public paths through
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    // Redirect already-authenticated users away from login
    if (pathname.startsWith("/login") && session?.user?.role) {
      const dest = session.user.role === "user" ? "/tree" : "/"
      return NextResponse.redirect(new URL(dest, req.url))
    }
    return NextResponse.next()
  }

  // Unauthenticated — send to login
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const role = session.user.role

  // Member not found in DB (no role assigned yet)
  if (!role) {
    return NextResponse.redirect(new URL("/login?error=not-a-member", req.url))
  }

  // user role: only /profile and /api/proxy/members allowed
  if (role === "user") {
    if (!pathname.startsWith("/profile") && !pathname.startsWith("/tree") && !pathname.startsWith("/reunion") && !pathname.startsWith("/api/proxy")) {
      return NextResponse.redirect(new URL("/tree", req.url))
    }
    return NextResponse.next()
  }

  // family_admin: block /families and /roles
  if (role === "family_admin") {
    if (pathname.startsWith("/families") || pathname.startsWith("/roles")) {
      return NextResponse.redirect(new URL("/", req.url))
    }
    return NextResponse.next()
  }

  // admin: full access
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
