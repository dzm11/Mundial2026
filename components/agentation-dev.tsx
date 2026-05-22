"use client"

import dynamic from "next/dynamic"

// Agentation — narzędzie anotacji UI dla agentów AI. Ładowane wyłącznie
// w trybie deweloperskim; w buildzie produkcyjnym (Vercel) ta gałąź jest
// martwa, więc pakiet nie trafia do bundla.
const Agentation =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("agentation").then((m) => m.Agentation), { ssr: false })
    : null

export function AgentationDev() {
  if (!Agentation) return null
  return <Agentation />
}
