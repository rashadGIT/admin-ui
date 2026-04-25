"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const params = useSearchParams()
  const errorParam = params.get("error")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(
    errorParam === "not-a-member" ? "Your account isn't linked to a family yet. Contact your organizer." : null
  )

  const handleSocial = async (provider: "google" | "facebook") => {
    setLoading(provider)
    await signIn(provider, { callbackUrl: "/" })
  }

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading("credentials")
    setError(null)
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
    if (res?.error) {
      setError("Invalid email or password.")
      setLoading(null)
    } else {
      window.location.href = "/"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Admin</p>
          <h1 className="text-2xl font-bold">Mama Reunion</h1>
          <p className="text-sm text-gray-500">Sign in to manage your family reunion</p>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 text-center">{error}</p>
        )}

        {/* Social buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleSocial("google")}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 border rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {/* Google icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading === "google" ? "Signing in…" : "Continue with Google"}
          </button>

          <button
            onClick={() => handleSocial("facebook")}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {/* Facebook icon */}
            <svg className="w-5 h-5 shrink-0 fill-white" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            {loading === "facebook" ? "Signing in…" : "Continue with Facebook"}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <hr className="flex-1 border-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <hr className="flex-1 border-gray-200" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleCredentials} className="space-y-4">
          <div>
            <Label className="mb-1 block">Email</Label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <Label className="mb-1 block">Password</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={!!loading || !email || !password}
          >
            {loading === "credentials" ? "Signing in…" : "Sign in"}
          </Button>
        </form>

      </div>
    </div>
  )
}
