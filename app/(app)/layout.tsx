import Link from "next/link"
import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { logoutAction } from "../(auth)/actions"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Toaster } from "@/components/ui/sonner"
import { BottomNav } from "@/components/bottom-nav"
import { AutoRefresh } from "@/components/auto-refresh"
import { Settings, LogOut, FileText } from "lucide-react"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .single()

  const initials = profile?.username ? profile.username.slice(0, 2).toUpperCase() : "?"

  return (
    <div className="min-h-svh bg-background">
      <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 border-b backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link
            href="/"
            className="font-display font-extrabold tracking-tight text-xl"
          >
            Meczyki <span className="text-primary text-sm font-sans font-semibold">· WC 2026</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm">
                Mecze
              </Button>
            </Link>
            <Link href="/ranking">
              <Button variant="ghost" size="sm">
                Ranking
              </Button>
            </Link>
            <Link href="/siatka">
              <Button variant="ghost" size="sm">
                Siatka
              </Button>
            </Link>
            <Link href="/stats">
              <Button variant="ghost" size="sm">
                Stats
              </Button>
            </Link>
            <Link href="/regulamin">
              <Button variant="ghost" size="sm">
                Regulamin
              </Button>
            </Link>
          </nav>

          {/* Avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Menu użytkownika"
              >
                <Avatar className="size-8">
                  {profile?.avatar_url && (
                    <AvatarImage src={profile.avatar_url} alt={profile.username ?? ""} />
                  )}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="size-4" />
                  Ustawienia
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/regulamin" className="flex items-center gap-2">
                  <FileText className="size-4" />
                  Regulamin
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action={logoutAction} className="w-full">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 text-left"
                  >
                    <LogOut className="size-4" />
                    Wyloguj
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 pb-24 lg:pb-6">{children}</main>

      <BottomNav />
      <Toaster />
      <AutoRefresh />
    </div>
  )
}
