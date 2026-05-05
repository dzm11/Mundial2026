import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-gradient-to-br from-background to-muted flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Meczyki</h1>
          <p className="text-muted-foreground mt-2">Mundial 2026 — typer dla znajomych</p>
        </div>
        {children}
      </div>
    </div>
  )
}
