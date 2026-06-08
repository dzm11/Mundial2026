import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { Player } from "@/lib/types"
import { cn, displayName, getInitials } from "@/lib/utils"

type Props = {
  players: Player[]
  currentUserId: string
}

function computePlace(players: Player[], index: number): number {
  if (index === 0) return 1
  const prev = players[index - 1]
  const curr = players[index]
  if (
    curr.total_points === prev.total_points &&
    curr.exact_hits === prev.exact_hits
  ) {
    return computePlace(players, index - 1)
  }
  return index + 1
}

const TOP3_PLACE_STYLES: Record<number, string> = {
  1: "text-primary font-extrabold",
  2: "text-muted-foreground font-bold",
  3: "text-muted-foreground font-bold",
}

export function RankingList({ players, currentUserId }: Props) {
  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground text-sm">
        Brak graczy w rankingu.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      {/* Header row */}
      <div className="hidden md:grid md:grid-cols-[3rem_1fr_auto_auto] items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">
          #
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Gracz
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">
          Dokładne
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right pr-1">
          Punkty
        </span>
      </div>

      {/* Player rows */}
      <ul role="list" className="divide-y divide-border">
        {players.map((player, index) => {
          const place = computePlace(players, index)
          const isCurrentUser = player.id === currentUserId
          const isTop3 = place <= 3

          return (
            <li
              key={player.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors",
                isCurrentUser
                  ? "bg-primary/10 hover:bg-primary/15"
                  : "hover:bg-muted/20",
              )}
              aria-current={isCurrentUser ? "true" : undefined}
            >
              {/* Place number */}
              <span
                className={cn(
                  "shrink-0 w-8 text-center font-display font-bold tabular-nums text-base",
                  isTop3
                    ? TOP3_PLACE_STYLES[place]
                    : "text-muted-foreground font-mono text-sm",
                )}
              >
                {place}
              </span>

              {/* Avatar + username + (mobile) stats */}
              <div className="flex flex-1 items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <Avatar
                    className={cn(
                      "size-8",
                      isCurrentUser ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "",
                    )}
                  >
                    {player.avatar_url && (
                      <AvatarImage src={player.avatar_url} alt={player.username} />
                    )}
                    <AvatarFallback
                      className={cn(
                        "text-xs font-semibold",
                        isCurrentUser
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {getInitials(player)}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                  <span
                    className={cn(
                      "truncate text-sm font-medium leading-tight",
                      isCurrentUser ? "text-primary" : "text-card-foreground",
                    )}
                    title={`@${player.username}`}
                  >
                    {displayName(player)}
                  </span>

                  {/* Mobile: inline stats */}
                  <div className="flex items-center gap-2 md:hidden shrink-0">
                    <Badge
                      variant="secondary"
                      className="font-mono text-xs tabular-nums"
                    >
                      {player.exact_hits}×3
                    </Badge>
                    <span
                      className={cn(
                        "font-mono font-bold tabular-nums text-sm",
                        isCurrentUser ? "text-primary" : "text-foreground",
                      )}
                    >
                      {player.total_points}
                      <span className="text-muted-foreground font-normal text-xs ml-0.5">
                        pkt
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Desktop: exact hits badge */}
              <div className="hidden md:flex shrink-0 w-20 justify-center">
                <Badge
                  variant="secondary"
                  className="font-mono tabular-nums text-xs"
                  title={`${player.exact_hits} dokładnych trafień (3 pkt)`}
                >
                  {player.exact_hits}×3 pkt
                </Badge>
              </div>

              {/* Desktop: total points */}
              <div className="hidden md:flex shrink-0 w-16 justify-end">
                <span
                  className={cn(
                    "font-mono font-bold tabular-nums text-base",
                    isCurrentUser ? "text-primary" : "text-foreground",
                  )}
                >
                  {player.total_points}
                  <span className="text-muted-foreground font-normal text-xs ml-0.5">
                    pkt
                  </span>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
