"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { settleDemoMatches } from "@/app/(app)/demo-actions"

const REFRESH_INTERVAL_MS = 30_000

// Niewidoczny komponent: co ~30 s przesuwa statusy meczów demo w czasie
// i odświeża stronę, żeby mecz „działał się sam". Przydaje się też jako
// odświeżanie wyników na żywo podczas Mundialu.
export function AutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      await settleDemoMatches()
      if (!cancelled) router.refresh()
    }

    void tick() // przy zamontowaniu
    const id = setInterval(tick, REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [router])

  return null
}
