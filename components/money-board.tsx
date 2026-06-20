import { ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Player } from "@/lib/types"
import type { PlayerStats } from "@/lib/stats"
import { cn, displayName, getInitials, formatPln } from "@/lib/utils"

type Row = { player: Player; stats: PlayerStats }

// matchId -> nazwy drużyn (team1:team2) do etykiety trafionego meczu
export type MatchInfo = Map<number, { home: string; away: string }>

type Props = {
  rows: Row[] // posortowane malejąco po moneyBalance
  currentUserId: string
  matchInfo: MatchInfo
}

export function MoneyBoard({ rows, currentUserId, matchInfo }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground text-sm">
        Brak danych do bilansu.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      <div className="hidden md:grid md:grid-cols-[3rem_1fr_auto] items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">#</span>
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gracz</span>
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right pr-1">Bilans</span>
      </div>

      <ul role="list" className="divide-y divide-border">
        {rows.map(({ player, stats }, index) => {
          const isCurrentUser = player.id === currentUserId
          const positive = stats.moneyBalance >= 0
          const hasWins = stats.wins.length > 0
          const winsTotal = stats.wins.reduce((sum, w) => sum + w.amount, 0)

          // Wspólna treść wiersza (ranking, avatar, nick, bilans).
          const rowInner = (
            <>
              <span className="shrink-0 w-8 text-center font-display font-bold tabular-nums text-base text-muted-foreground">
                {index + 1}
              </span>
              <div className="flex flex-1 items-center gap-2.5 min-w-0">
                <Avatar
                  className={cn(
                    "size-8 shrink-0",
                    isCurrentUser ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "",
                  )}
                >
                  {player.avatar_url && <AvatarImage src={player.avatar_url} alt={player.username} />}
                  <AvatarFallback
                    className={cn(
                      "text-xs font-semibold",
                      isCurrentUser ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {getInitials(player)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "truncate text-sm font-medium leading-tight",
                    isCurrentUser ? "text-primary" : "text-card-foreground",
                  )}
                  title={`@${player.username}`}
                >
                  {displayName(player)}
                </span>
              </div>
              <span
                className={cn(
                  "shrink-0 font-mono font-bold tabular-nums text-base",
                  positive ? "text-emerald-500" : "text-red-500",
                )}
                title={`${stats.evaluatedBets} obstawionych meczów`}
              >
                {formatPln(stats.moneyBalance)}
              </span>
              {hasWins ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              ) : (
                <span className="size-4 shrink-0" aria-hidden />
              )}
            </>
          )

          return (
            <li
              key={player.id}
              className={cn("transition-colors", isCurrentUser ? "bg-primary/10" : "")}
              aria-current={isCurrentUser ? "true" : undefined}
            >
              {hasWins ? (
                <details className="group">
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-muted/20">
                    {rowInner}
                  </summary>
                  <div className="px-4 pb-3 pl-14 space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Trafione kupony ({stats.wins.length})
                    </p>
                    {stats.wins.map((w) => {
                      const info = matchInfo.get(w.matchId)
                      const label = info ? `${info.home} ${w.scoreline} ${info.away}` : `Mecz #${w.matchId} (${w.scoreline})`
                      return (
                        <div
                          key={w.matchId}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="truncate text-card-foreground">{label}</span>
                          <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                            kurs {w.odds.toFixed(2)} ·{" "}
                            <span className="font-bold text-emerald-500">{formatPln(w.amount)}</span>
                          </span>
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-1.5 text-xs">
                      <span className="font-semibold text-card-foreground">Suma trafionych kuponów</span>
                      <span className="shrink-0 font-mono font-bold tabular-nums text-emerald-500">
                        {formatPln(winsTotal)}
                      </span>
                    </div>
                  </div>
                </details>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">{rowInner}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
