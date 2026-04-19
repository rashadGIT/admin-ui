import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"

export const metadata: Metadata = {
  title: "Mama Reunion — Admin",
}

const nav = [
  { href: "/",        label: "Dashboard"    },
  { href: "/members", label: "Members"      },
  { href: "/tasks",   label: "Tasks"        },
  { href: "/reunion", label: "Reunion Info" },
  { href: "/families", label: "Families"    },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-gray-50 min-h-screen">
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-56 bg-white border-r flex flex-col shrink-0">
            <div className="px-6 py-5 border-b">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
              <h1 className="text-lg font-bold mt-0.5">Mama Reunion</h1>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {nav.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
