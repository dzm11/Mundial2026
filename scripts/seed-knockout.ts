/**
 * Seed fazy pucharowej Mundialu 2026 z football-data.org (kompetycja 2000).
 *
 * Uruchomienie: npm run seed:knockout
 *
 * W przeciwieństwie do `npm run seed` (openfootball — tylko mecze z dwiema realnymi
 * drużynami), ten skrypt zaciąga WSZYSTKIE 32 mecze pucharowe (R32→Finał) wprost z API.
 * Drabinka jest stała (terminy + miejsca), a drużyny dochodzą w miarę rozstrzygania grup
 * i kolejnych rund. Dla meczu, w którym potwierdzona jest tylko jedna drużyna, wstawiamy
 * tę pewną, a brakującą zostawiamy pustą (null). Mecze całkiem nierozstrzygnięte trafiają
 * jako TBD vs TBD — slot w drabince istnieje, drużyny wskoczą przy następnej synchronizacji.
 *
 * Idempotentny: upsert po external_id (id z football-data), więc można puszczać wielokrotnie.
 *
 * Wymaga w .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FOOTBALL_DATA_API_TOKEN
 */

import { createClient } from "@supabase/supabase-js"

type FdMatch = {
  id: number
  utcDate: string
  status: string
  stage: string
  homeTeam: { id: number | null; name: string | null; tla: string | null }
  awayTeam: { id: number | null; name: string | null; tla: string | null }
  // regularTime = wynik po 90 min (tylko gdy była dogrywka/karne); fullTime = wynik łączny.
  score: {
    fullTime: { home: number | null; away: number | null }
    regularTime?: { home: number | null; away: number | null }
  }
}

type FdResponse = { matches: FdMatch[] }

// football-data → nasze stage. Faza pucharowa WC2026: 32 → 16 → ćwierć → półfinał → mecz o 3. → finał.
const STAGE_MAP: Record<string, "R32" | "R16" | "QF" | "SF" | "3RD" | "F"> = {
  LAST_32: "R32",
  LAST_16: "R16",
  ROUND_OF_16: "R16",
  QUARTER_FINALS: "QF",
  SEMI_FINALS: "SF",
  THIRD_PLACE: "3RD",
  FINAL: "F",
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = process.env.FOOTBALL_DATA_API_TOKEN
  if (!url || !key) throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w env")
  if (!token) throw new Error("Brak FOOTBALL_DATA_API_TOKEN w env")

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log("📥 Pobieram mecze WC2026 z football-data.org (id 2000)")
  const res = await fetch("https://api.football-data.org/v4/competitions/2000/matches", {
    headers: { "X-Auth-Token": token, "User-Agent": "mundial2026-seed/1.0" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`football-data ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as FdResponse

  const knockout = data.matches.filter((m) => STAGE_MAP[m.stage])
  console.log(`   ${knockout.length} meczów pucharowych w API`)

  // Mapowanie drużyn po kodzie (tla → fifa_code, z fallbackiem na iso_code).
  const { data: teams, error: tErr } = await supabase.from("teams").select("id, fifa_code, iso_code")
  if (tErr) throw tErr
  const teamByCode = new Map<string, number>()
  for (const t of teams ?? []) {
    if (t.fifa_code) teamByCode.set(t.fifa_code.toUpperCase(), t.id)
    if (t.iso_code) teamByCode.set(t.iso_code.toUpperCase(), t.id)
  }

  const resolve = (tla: string | null): number | null =>
    tla ? (teamByCode.get(tla.toUpperCase()) ?? null) : null

  const payload = knockout.map((m) => ({
    external_id: m.id,
    stage: STAGE_MAP[m.stage],
    group_letter: null as string | null,
    team1_id: resolve(m.homeTeam.tla),
    team2_id: resolve(m.awayTeam.tla),
    kickoff_at: m.utcDate,
    status: m.status,
    // Pucharowe rozliczamy wynikiem po 90 min — bez dogrywki i karnych.
    result1: (m.score.regularTime ?? m.score.fullTime).home,
    result2: (m.score.regularTime ?? m.score.fullTime).away,
    updated_at: new Date().toISOString(),
  }))

  const { error: upErr } = await supabase
    .from("matches")
    .upsert(payload, { onConflict: "external_id" })
  if (upErr) throw upErr

  const withBoth = payload.filter((p) => p.team1_id && p.team2_id).length
  const withOne = payload.filter((p) => (p.team1_id ? 1 : 0) + (p.team2_id ? 1 : 0) === 1).length
  const empty = payload.filter((p) => !p.team1_id && !p.team2_id).length
  const byStage = payload.reduce<Record<string, number>>((a, p) => ((a[p.stage] = (a[p.stage] ?? 0) + 1), a), {})

  console.log(`✅ Upsert ${payload.length} meczów pucharowych`)
  console.log(`   wg fazy: ${JSON.stringify(byStage)}`)
  console.log(`   obie drużyny: ${withBoth} | jedna pewna: ${withOne} | TBD vs TBD: ${empty}`)
  console.log("🎉 Gotowe")
}

main().catch((e) => {
  console.error("❌ Seed pucharowy nie powiódł się:", e)
  process.exit(1)
})
