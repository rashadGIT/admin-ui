import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      memberId?: string
      familyId?: string
      role?: "admin" | "family_admin" | "user" | null
      adminFamilyIds?: string[]
      activeFamilyId?: string
    }
  }
}
