import Link from "next/link"
import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logoutAction } from "../(auth)/actions"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Settings, LogOut } from "lucide-react"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, first_name, last_name, avatar_url")
    .eq("id", user.id)
    .single()

  const initials = profile
    ? `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase()
    : "?"

  return (
    <div className="min-h-svh bg-background">
      <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 border-b backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Meczyki <span className="text-primary">·</span> WC 2026
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/settings" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                <Settings className="mr-2 size-4" />
                Ustawienia
              </Button>
            </Link>
            <Link href="/settings" className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label="Ustawienia">
                <Settings className="size-4" />
              </Button>
            </Link>
            <form action={logoutAction}>
              <Button variant="ghost" size="icon" type="submit" aria-label="Wyloguj">
                <LogOut className="size-4" />
              </Button>
            </form>
            <Link href="/settings" className="ml-1">
              <Avatar className="size-8">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={profile.username} />
                )}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-2 py-6 sm:px-4">{children}</main>
    </div>
  )
}
