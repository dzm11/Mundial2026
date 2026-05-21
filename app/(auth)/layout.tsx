import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-svh bg-background flex items-center justify-center p-6 overflow-hidden">
      {/* Subtle radial glow — lime/primary accent in bottom-right corner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 h-[480px] w-[480px] rounded-full opacity-[0.07]"
        style={{
          background:
            "radial-gradient(circle at 70% 70%, var(--primary) 0%, transparent 70%)",
        }}
      />
      {/* Secondary glow — top-left, even subtler */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-[320px] w-[320px] rounded-full opacity-[0.04]"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, var(--primary) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Wordmark / hero */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            Meczyki
            <span className="text-primary">26</span>
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Mundial 2026 — typer dla znajomych
          </p>
        </div>

        {children}
      </div>
    </div>
  )
}
