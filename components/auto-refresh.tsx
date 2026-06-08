"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const REFRESH_INTERVAL_MS = 30_000

// Niewidoczny komponent: co ~30 s odświeża stronę, żeby wyniki na żywo
// i statusy meczów aktualizowały się bez ręcznego przeładowania.
export function AutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [router])

  return null
}
