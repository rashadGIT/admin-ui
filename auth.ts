import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Facebook from "next-auth/providers/facebook"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

const LAMBDA_BASE = process.env.LAMBDA_BASE_URL!
const ADMIN_API_KEY = process.env.ADMIN_API_KEY!

async function fetchMemberByEmail(email: string) {
  const res = await fetch(
    `${LAMBDA_BASE}/admin/auth/me?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${ADMIN_API_KEY}` } },
  )
  if (!res.ok) return null
  return res.json() as Promise<{
    memberId: string
    familyId: string
    role: "admin" | "family_admin" | "user"
    adminFamilyIds: string[]
    firstName: string
    lastName: string
  }>
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Facebook,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined
        if (!email || !password) return null

        // Fetch the stored hash from Lambda
        const res = await fetch(`${LAMBDA_BASE}/admin/auth/credentials`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${ADMIN_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: email.toLowerCase() }),
        })
        if (!res.ok) return null
        const { passwordHash } = await res.json() as { passwordHash: string }
        const valid = await bcrypt.compare(password, passwordHash)
        if (!valid) return null

        // Return minimal user — role/name loaded in jwt callback
        return { id: email.toLowerCase(), email: email.toLowerCase() }
      },
    }),
  ],

  session: { strategy: "jwt", maxAge: 60 * 60, updateAge: 60 * 15 },

  callbacks: {
    async jwt({ token, trigger, session }) {
      // Family switch — client called update({ activeFamilyId })
      if (trigger === "update" && session?.activeFamilyId) {
        token.activeFamilyId = session.activeFamilyId
        return token
      }

      // First sign-in or token refresh — look up role from member table
      if (!token.role || trigger === "signIn") {
        const email = token.email
        if (email) {
          const member = await fetchMemberByEmail(email)
          if (member) {
            token.memberId = member.memberId
            token.familyId = member.familyId
            token.role = member.role
            token.adminFamilyIds = member.adminFamilyIds
            token.activeFamilyId = member.adminFamilyIds[0] ?? member.familyId
            token.name = `${member.firstName} ${member.lastName}`.trim()
          } else {
            // Email not found in member table — deny access
            token.role = null
          }
        }
      }

      return token
    },

    async session({ session, token }) {
      session.user.memberId = token.memberId as string | undefined
      session.user.familyId = token.familyId as string | undefined
      session.user.role = token.role as "admin" | "family_admin" | "user" | null | undefined
      session.user.adminFamilyIds = token.adminFamilyIds as string[] | undefined
      session.user.activeFamilyId = token.activeFamilyId as string | undefined
      return session
    },
  },

  pages: { signIn: "/login" },
})
