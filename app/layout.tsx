import type { Metadata } from "next"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import { AppShell } from "@/components/app-shell"

export const metadata: Metadata = {
  title: "Mama Reunion — Admin",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-gray-50 min-h-screen">
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  )
}
