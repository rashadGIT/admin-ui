"use client"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isLogin = pathname === "/login"
  const showSidebar = !isLogin && !!session?.user?.role

  if (isLogin) {
    return <>{children}</>
  }

  return (
    <div className="flex flex-col md:flex-row md:h-screen">
      {showSidebar && <Sidebar />}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  )
}
