"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DEMO_KICKOFF_DELAY_MS, DEMO_HALF1_MS, DEMO_BREAK_MS, DEMO_HALF2_MS } from "@/lib/match-clock"

export type DemoResult = { ok: boolean; error?: string }

function revalidateViews() {
  revalidatePath("/")
  revalidatePath("/siatka")
  revalidatePath("/ranking")
}

// Tworzy jeden mecz demo: kick-off za 15 s, status SCHEDULED, dwie losowe drużyny.
export async function createDemoMatch(): Promise<DemoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Niezalogowany" }

  const admin = createAdminClient()

  // Dwie różne, losowe drużyny (lub null gdy brak danych).
  let team1Id: number | null = null
  let team2Id: number | null = null
  const { data: teams } = await admin.from("teams").select("id")
  if (teams && teams.length >= 2) {
    const shuffled = [...teams].sort(() => Math.random() - 0.5)
    team1Id = shuffled[0].id as number
    team2Id = shuffled[1].id as number
  }

  const kickoffAt = new Date(Date.now() + DEMO_KICKOFF_DELAY_MS).toISOString()

  const { error } = await admin.from("matches").insert({
    is_demo: true,
    stage: "GROUP",
    status: "SCHEDULED",
    kickoff_at: kickoffAt,
    team1_id: team1Id,
    team2_id: team2Id,
  })
  if (error) return { ok: false, error: error.message }

  revalidateViews()
  return { ok: true }
}

// Przesuwa statusy meczów demo w czasie. Idempotentne, bez wymogu logowania
// (czysto czasowa operacja, brak danych wejściowych). Wołane cyklicznie.
export async function settleDemoMatches(): Promise<DemoResult> {
  const admin = createAdminClient()
  const { data: matches, error } = await admin
    .from("matches")
    .select("id, kickoff_at, status, result1, result2")
    .eq("is_demo", true)
    .neq("status", "FINISHED")
  if (error) return { ok: false, error: error.message }
  if (!matches || matches.length === 0) return { ok: true }

  const now = Date.now()
  let didUpdate = false

  const HALF1_END = DEMO_HALF1_MS
  const BREAK_END = DEMO_HALF1_MS + DEMO_BREAK_MS
  const MATCH_END = DEMO_HALF1_MS + DEMO_BREAK_MS + DEMO_HALF2_MS

  for (const m of matches) {
    const kickoffMs = new Date(m.kickoff_at as string).getTime()
    if (now < kickoffMs) continue // przed kick-offem — SCHEDULED, nic nie robimy
    const elapsed = now - kickoffMs

    // Docelowy status z osi czasu demo.
    let targetStatus: "IN_PLAY" | "PAUSED" | "FINISHED"
    if (elapsed < HALF1_END) targetStatus = "IN_PLAY"
    else if (elapsed < BREAK_END) targetStatus = "PAUSED"
    else if (elapsed < MATCH_END) targetStatus = "IN_PLAY"
    else targetStatus = "FINISHED"

    // Wynik ustawiamy raz, przy pierwszym wejściu w grę.
    let result1 = m.result1 as number | null
    let result2 = m.result2 as number | null
    if (result1 == null || result2 == null) {
      result1 = Math.floor(Math.random() * 5)
      result2 = Math.floor(Math.random() * 5)
    }

    if (m.status === targetStatus && m.result1 != null && m.result2 != null) {
      continue // nic się nie zmienia
    }

    const { error: updErr } = await admin
      .from("matches")
      .update({
        status: targetStatus,
        result1,
        result2,
        updated_at: new Date().toISOString(),
      })
      .eq("id", m.id)
    if (updErr) return { ok: false, error: updErr.message }
    didUpdate = true
  }

  if (didUpdate) revalidateViews()
  return { ok: true }
}

// Kasuje wszystkie mecze demo (typy znikają kaskadą przez FK).
export async function deleteDemoMatches(): Promise<DemoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Niezalogowany" }

  const admin = createAdminClient()
  const { error } = await admin.from("matches").delete().eq("is_demo", true)
  if (error) return { ok: false, error: error.message }

  revalidateViews()
  return { ok: true }
}
