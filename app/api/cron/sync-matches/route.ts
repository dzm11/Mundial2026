import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type FdMatch = {
  id: number
  utcDate: string
  status: string
  stage: string
  group: string | null
  homeTeam: { id: number; name: string; tla: string | null }
  awayTeam: { id: number; name: string; tla: string | null }
  score: {
    fullTime: { home: number | null; away: number | null }
  }
  minute: number | null
}

type FdResponse = { matches: FdMatch[] }

const STAGE_MAP: Record<string, string> = {
  GROUP_STAGE: "GROUP",
  LAST_32: "R32",
  LAST_16: "R16",
  ROUND_OF_16: "R16",
  QUARTER_FINALS: "QF",
  SEMI_FINALS: "SF",
  THIRD_PLACE: "3RD",
  FINAL: "F",
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// fetch z timeoutem i retry — football-data bywa zrywa połączenie (SocketError:
// "other side closed"). Ponawiamy błędy sieci oraz 429/5xx, z prostym backoffem.
async function fetchFootballData(url: string, token: string): Promise<Response> {
  const RETRIES = 3
  const TIMEOUT_MS = 10_000
  let lastErr: unknown
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "X-Auth-Token": token, "User-Agent": "mundial2026-cron/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      // 429/5xx — przejściowe; ponawiamy, chyba że to ostatnia próba
      if ((res.status === 429 || res.status >= 500) && attempt < RETRIES) {
        await sleep(attempt * 1000)
        continue
      }
      return res
    } catch (e) {
      lastErr = e
      if (attempt < RETRIES) {
        await sleep(attempt * 1000)
        continue
      }
    }
  }
  throw lastErr
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const token = process.env.FOOTBALL_DATA_API_TOKEN
  if (!token) {
    return NextResponse.json({ error: "FOOTBALL_DATA_API_TOKEN not set" }, { status: 500 })
  }

  // Pobieramy mecze WC 2026 (id 2000) — TIER_ONE, dostępne na free planie
  let res: Response
  try {
    res = await fetchFootballData(
      "https://api.football-data.org/v4/competitions/2000/matches",
      token,
    )
  } catch (e) {
    // Błąd sieci/timeout (np. SocketError "other side closed") — zwracamy 502
    // z czytelnym komunikatem zamiast crashować pustym 500.
    return NextResponse.json(
      { error: "football-data unreachable", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json(
      { error: "football-data fetch failed", status: res.status, body },
      { status: 502 },
    )
  }
  const data = (await res.json()) as FdResponse
  const supabase = createAdminClient()

  // Pobierz lokalne mecze i drużyny do mapowania
  const { data: localMatches, error: lmErr } = await supabase
    .from("matches")
    .select("id, external_id, kickoff_at, team1_id, team2_id, status")
  if (lmErr) {
    return NextResponse.json({ error: lmErr.message }, { status: 500 })
  }
  const { data: teams, error: tErr } = await supabase
    .from("teams")
    .select("id, fifa_code, iso_code")
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

  const teamByFifa = new Map<string, number>()
  for (const t of teams ?? []) {
    if (t.fifa_code) teamByFifa.set(t.fifa_code.toUpperCase(), t.id)
    if (t.iso_code) teamByFifa.set(t.iso_code.toUpperCase(), t.id)
  }

  let updated = 0
  let matched = 0

  for (const m of data.matches) {
    const stage = STAGE_MAP[m.stage] ?? "GROUP"
    const fullStatus = m.status
    const r1 = m.score.fullTime.home
    const r2 = m.score.fullTime.away

    // 1) Spróbuj match po external_id
    let local = (localMatches ?? []).find((lm) => lm.external_id === m.id)

    // 2) Spróbuj po dacie + drużynach (tla → fifa/iso)
    if (!local) {
      const t1 = m.homeTeam.tla ? teamByFifa.get(m.homeTeam.tla.toUpperCase()) : undefined
      const t2 = m.awayTeam.tla ? teamByFifa.get(m.awayTeam.tla.toUpperCase()) : undefined
      if (t1 && t2) {
        const utc = new Date(m.utcDate).getTime()
        local = (localMatches ?? []).find((lm) => {
          const ko = new Date(lm.kickoff_at).getTime()
          return (
            ((lm.team1_id === t1 && lm.team2_id === t2) ||
              (lm.team1_id === t2 && lm.team2_id === t1)) &&
            Math.abs(ko - utc) < 24 * 3600 * 1000
          )
        })
      }
    }

    if (!local) continue
    matched++

    const { error: updErr } = await supabase
      .from("matches")
      .update({
        external_id: m.id,
        kickoff_at: m.utcDate,
        status: fullStatus,
        result1: r1,
        result2: r2,
        minute: m.minute ?? null,
        stage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", local.id)
    if (!updErr) updated++
  }

  return NextResponse.json({
    received: data.matches.length,
    matched,
    updated,
    timestamp: new Date().toISOString(),
  })
}
