import { createClient } from "@/lib/supabase/server"
import { getLeaderboard, getPredictions, getMatches, getMatchOdds } from "@/lib/data"
import { computeAllStats, oddsCoverage, type MatchLite } from "@/lib/stats"
import { MoneyBoard, type MatchInfo } from "@/components/money-board"
import { StatHighlights } from "@/components/stat-highlights"

export const dynamic = "force-dynamic"

export default async function StatsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [players, predictions, matches, odds] = await Promise.all([
    getLeaderboard(),
    getPredictions(),
    getMatches(),
    getMatchOdds(),
  ])

  const matchLite: MatchLite[] = matches.map((m) => ({
    id: m.id,
    status: m.status,
    result1: m.result1,
    result2: m.result2,
  }))

  const stats = computeAllStats(
    players.map((p) => p.id),
    predictions,
    matchLite,
    odds,
  )
  const statsByUser = new Map(stats.map((s) => [s.userId, s]))

  const rows = players
    .map((player) => ({ player, stats: statsByUser.get(player.id)! }))
    .sort((a, b) => b.stats.moneyBalance - a.stats.moneyBalance)

  const coverage = oddsCoverage(matchLite, odds)
  const missing = coverage.finished - coverage.withOdds
  const coveragePct =
    coverage.finished > 0 ? Math.round((coverage.withOdds / coverage.finished) * 100) : 0

  // Etykiety meczów (team1:team2) do rozwijanej listy trafionych kuponów.
  const matchInfo: MatchInfo = new Map(
    matches.map((m) => [m.id, { home: m.team1?.name ?? "?", away: m.team2?.name ?? "?" }]),
  )

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Stats</h1>
        <p className="text-muted-foreground text-sm">
          Bilans, gdyby każdy stawiał 100 zł na dokładny wynik swojego typu w każdym meczu.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">💰 Bilans 100 zł / mecz</h2>

        {/* Pokrycie kursami — ile rozegranych meczów ma pobrane kursy (dokładność bilansu) */}
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-xl border border-border bg-card/60 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Rozegrane mecze
            </p>
            <p className="font-display text-2xl font-extrabold tabular-nums">{coverage.finished}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/60 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Z pobranymi kursami
            </p>
            <p className="font-display text-2xl font-extrabold tabular-nums">
              {coverage.withOdds}
              <span className="text-muted-foreground text-sm font-semibold ml-1">
                / {coverage.finished} ({coveragePct}%)
              </span>
            </p>
          </div>
        </div>

        <MoneyBoard rows={rows} currentUserId={user.id} matchInfo={matchInfo} />
        <p className="text-muted-foreground text-xs">
          Kliknij gracza z trafieniami, aby zobaczyć mecze składające się na dodatnią część bilansu.
          {missing > 0 && ` Bilans pomija ${missing} rozegranych meczów bez kursów.`}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Pozostałe statystyki</h2>
        <StatHighlights rows={rows} />
      </section>
    </div>
  )
}
