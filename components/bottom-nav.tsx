"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CircleDot, Trophy, Grid3x3, User } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/", label: "Mecze", icon: CircleDot },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/siatka", label: "Siatka", icon: Grid3x3 },
  { href: "/settings", label: "Profil", icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="bg-card/95 supports-[backdrop-filter]:bg-card/80 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur lg:hidden">
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
