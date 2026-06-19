import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Player } from "@/lib/types"
import type { PlayerStats } from "@/lib/stats"
import { cn, displayName, getInitials, formatPln } from "@/lib/utils"

type Row = { player: Player; stats: PlayerStats }

type Props = {
  rows: Row[] // posortowane malejąco po moneyBalance
  currentUserId: string
}

export function MoneyBoard({ rows, currentUserId }: Props) {
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
          return (
            <li
              key={player.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors",
                isCurrentUser ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/20",
              )}
              aria-current={isCurrentUser ? "true" : undefined}
            >
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
            </li>
          )
        })}
      </ul>
    </div>
  )
}
