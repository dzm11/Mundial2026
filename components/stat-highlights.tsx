import type { Player } from "@/lib/types"
import type { PlayerStats } from "@/lib/stats"
import { displayName, formatPln } from "@/lib/utils"

type Row = { player: Player; stats: PlayerStats }

type Highlight = {
  label: string
  winner: Row | undefined
  value: (r: Row) => string
}

function leaderBy(rows: Row[], key: (s: PlayerStats) => number): Row | undefined {
  if (rows.length === 0) return undefined
  return [...rows].sort((a, b) => key(b.stats) - key(a.stats))[0]
}

export function StatHighlights({ rows }: { rows: Row[] }) {
  const highlights: Highlight[] = [
    {
      label: "Najwięcej dokładnych wyników",
      winner: leaderBy(rows, (s) => s.exactHits),
      value: (r) => `${r.stats.exactHits}`,
    },
    {
      label: "Najwięcej trafionych zwykłych wyników",
      winner: leaderBy(rows, (s) => s.outcomeHits),
      value: (r) => `${r.stats.outcomeHits}`,
    },
    {
      label: "Najwyższa skuteczność",
      winner: leaderBy(rows, (s) => s.accuracy),
      value: (r) => `${Math.round(r.stats.accuracy * 100)}%`,
    },
    {
      label: "Największa pojedyncza wygrana",
      winner: leaderBy(rows, (s) => s.bestWin?.amount ?? -Infinity),
      value: (r) => (r.stats.bestWin ? formatPln(r.stats.bestWin.amount) : "—"),
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {highlights.map((h) => (
        <div key={h.label} className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{h.label}</p>
          {h.winner ? (
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-card-foreground">
                {displayName(h.winner.player)}
              </span>
              <span className="font-mono font-bold tabular-nums text-lg text-primary">
                {h.value(h.winner)}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">—</p>
          )}
        </div>
      ))}
    </div>
  )
}
