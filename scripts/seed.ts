/**
 * Seed harmonogramu Mundialu 2026 z openfootball/worldcup.json (public domain).
 *
 * Uruchomienie: npm run seed
 *
 * Wymaga w .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotentny: wymazuje teams + matches (kaskadowo predictions) i zaciąga od nowa.
 */

import { createClient } from "@supabase/supabase-js"
import { WC2026_TEAMS } from "../lib/wc2026-teams"

const SOURCE_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"

type RawMatch = {
  num?: number
  date: string
  time?: string
  group?: string
  round?: string
  team1: string | { name: string; code?: string }
  team2: string | { name: string; code?: string }
  ground?: string
  city?: string
}

type RawData = {
  name: string
  matches?: RawMatch[]
  rounds?: { name: string; matches: RawMatch[] }[]
}

function parseStage(round: string | undefined): "GROUP" | "R32" | "R16" | "QF" | "SF" | "3RD" | "F" {
  const r = (round ?? "").toLowerCase()
  if (r.includes("third place")) return "3RD"
  if (r === "final" || r.startsWith("final")) return "F"
  if (r.includes("semi")) return "SF"
  if (r.includes("quarter")) return "QF"
  if (r.includes("round of 16") || r.includes("1/8")) return "R16"
  if (r.includes("round of 32") || r.includes("1/16")) return "R32"
  return "GROUP"
}

function teamName(t: RawMatch["team1"]): string {
  return typeof t === "string" ? t : t.name
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w env")
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`📥 Pobieram ${SOURCE_URL}`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`Nie udało się pobrać danych: ${res.status}`)
  const data = (await res.json()) as RawData

  const allMatches: (RawMatch & { round?: string })[] = []
  if (Array.isArray(data.matches)) allMatches.push(...data.matches)
  if (Array.isArray(data.rounds)) {
    for (const round of data.rounds) {
      for (const m of round.matches) allMatches.push({ ...m, round: round.name })
    }
  }
  console.log(`   znaleziono ${allMatches.length} meczów (z placeholderami)`)

  // Filtruj: zostaw tylko mecze gdzie obie drużyny są realne (z mapy WC2026_TEAMS).
  const validMatches = allMatches.filter((m) => {
    const n1 = teamName(m.team1)
    const n2 = teamName(m.team2)
    return WC2026_TEAMS[n1] && WC2026_TEAMS[n2]
  })
  const skipped = allMatches.length - validMatches.length
  console.log(`   ${validMatches.length} meczów z realnymi drużynami (pominięto ${skipped} z placeholderami knockout)`)

  // 1. Wyczyść stare dane (matches kaskadowo wyczyści predictions)
  console.log("🧹 Czyszczę stare matches + teams")
  await supabase.from("matches").delete().gte("id", 0)
  await supabase.from("teams").delete().gte("id", 0)

  // 2. Wstaw teams (48 uczestników WC2026)
  const teamsPayload = Object.entries(WC2026_TEAMS).map(([name, t]) => ({
    name,
    fifa_code: t.fifa,
    iso_code: t.iso,
    group_letter: null as string | null,
  }))

  // Dodaj group_letter z openfootball
  for (const m of validMatches) {
    if (m.group && parseStage(m.round) === "GROUP") {
      const letter = m.group.replace(/^Group\s+/i, "")
      const n1 = teamName(m.team1)
      const n2 = teamName(m.team2)
      const t1 = teamsPayload.find((t) => t.name === n1)
      const t2 = teamsPayload.find((t) => t.name === n2)
      if (t1 && !t1.group_letter) t1.group_letter = letter
      if (t2 && !t2.group_letter) t2.group_letter = letter
    }
  }

  const { error: teamsErr } = await supabase.from("teams").insert(teamsPayload)
  if (teamsErr) throw teamsErr
  console.log(`✅ Wstawiono ${teamsPayload.length} drużyn`)

  // 3. Pobierz id po fifa_code
  const { data: teamsRows, error: teamsRowsErr } = await supabase
    .from("teams")
    .select("id, fifa_code, name")
  if (teamsRowsErr) throw teamsRowsErr
  const idByName = new Map<string, number>()
  for (const t of teamsRows ?? []) idByName.set(t.name, t.id)

  // 4. Wstaw matches
  const matchesPayload = validMatches.map((m) => {
    const n1 = teamName(m.team1)
    const n2 = teamName(m.team2)
    const team1_id = idByName.get(n1)!
    const team2_id = idByName.get(n2)!

    const time = (m.time ?? "12:00").trim()
    const tz = time.match(/UTC([+-]\d{1,2})/)
    const baseTime = time.replace(/\s*UTC[+-]\d{1,2}\s*/, "").trim() || "12:00"
    const offsetIso = tz
      ? (tz[1].startsWith("-") ? "-" : "+") +
        Math.abs(parseInt(tz[1], 10)).toString().padStart(2, "0") +
        ":00"
      : "Z"
    const kickoff = new Date(`${m.date}T${baseTime}${offsetIso}`)

    return {
      external_id: m.num ?? null,
      stage: parseStage(m.round),
      group_letter: m.group?.replace(/^Group\s+/i, "") ?? null,
      team1_id,
      team2_id,
      kickoff_at: isNaN(kickoff.getTime())
        ? new Date(`${m.date}T12:00Z`).toISOString()
        : kickoff.toISOString(),
      status: "SCHEDULED" as const,
    }
  })

  const { error: matchesErr } = await supabase.from("matches").insert(matchesPayload)
  if (matchesErr) throw matchesErr

  console.log(`✅ Wstawiono ${matchesPayload.length} meczów`)
  console.log("🎉 Seed zakończony")
}

main().catch((e) => {
  console.error("❌ Seed nie powiódł się:", e)
  process.exit(1)
})
