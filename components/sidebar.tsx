"use client"
import { useState } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

const ALL_NAV = [
  { href: "/",         label: "Dashboard",    roles: ["admin", "family_admin"] },
  { href: "/members",  label: "Members",      roles: ["family_admin"] },
  { href: "/tree",     label: "Family Tree",  roles: ["admin", "family_admin", "user"] },
  { href: "/tasks",    label: "Tasks",        roles: ["admin", "family_admin"] },
  { href: "/reunion",  label: "Reunion Info", roles: ["family_admin", "user"] },
  { href: "/families", label: "Families",     roles: ["admin"] },
  { href: "/roles",    label: "Roles",        roles: ["admin"] },
  { href: "/profile",  label: "My Profile",   roles: ["admin", "family_admin", "user"] },
]

function FamilySwitcher({ adminFamilyIds, activeFamilyId }: { adminFamilyIds: string[]; activeFamilyId: string }) {
  const { update } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSwitch = async (familyId: string) => {
    if (familyId === activeFamilyId || loading) return
    setLoading(true)
    await update({ activeFamilyId: familyId })
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="px-3 py-2 border-b mb-2">
      <p className="text-xs text-gray-400 mb-1">Active family</p>
      <select
        value={activeFamilyId}
        onChange={e => handleSwitch(e.target.value)}
        disabled={loading}
        className="w-full text-xs border rounded px-2 py-1 bg-white text-gray-700 disabled:opacity-50"
      >
        {adminFamilyIds.map(id => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
    </div>
  )
}

function NavLinks({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const items = ALL_NAV.filter(n => n.roles.includes(role))
  return (
    <>
      {items.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          {label}
        </Link>
      ))}
    </>
  )
}

export function Sidebar() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const role = session?.user?.role ?? "user"
  const name = session?.user?.name ?? session?.user?.email ?? ""
  const adminFamilyIds = session?.user?.adminFamilyIds ?? []
  const activeFamilyId = session?.user?.activeFamilyId ?? ""
  const showFamilySwitcher = role === "family_admin" && adminFamilyIds.length > 1

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b shrink-0">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-none">Admin</p>
          <h1 className="text-base font-bold">Mama Reunion</h1>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown nav — fixed overlay so it doesn't push content down */}
      {open && (
        <nav className="md:hidden fixed top-[52px] left-0 right-0 z-50 bg-white border-b shadow-md px-4 py-2 space-y-1">
          {showFamilySwitcher && (
            <FamilySwitcher adminFamilyIds={adminFamilyIds} activeFamilyId={activeFamilyId} />
          )}
          <NavLinks role={role} onNavigate={() => setOpen(false)} />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
          >
            Sign out
          </button>
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r flex-col shrink-0">
        <div className="px-6 py-5 border-b">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
          <h1 className="text-lg font-bold mt-0.5">Mama Reunion</h1>
        </div>
        {showFamilySwitcher && (
          <div className="px-3 pt-3">
            <FamilySwitcher adminFamilyIds={adminFamilyIds} activeFamilyId={activeFamilyId} />
          </div>
        )}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks role={role} />
        </nav>
        <div className="px-4 py-4 border-t">
          {name && <p className="text-xs text-gray-500 truncate mb-2">{name}</p>}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
