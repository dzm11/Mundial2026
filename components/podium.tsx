import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Player } from "@/lib/types"
import { cn } from "@/lib/utils"

type Props = {
  players: Player[]
  currentUserId: string
}

type PodiumSlot = {
  player: Player
  place: 1 | 2 | 3
  order: number // visual left-to-right order
}

function getInitials(player: Player): string {
  const first = player.first_name?.[0] ?? ""
  const last = player.last_name?.[0] ?? ""
  return (first + last).toUpperCase() || player.username.slice(0, 2).toUpperCase()
}

const PLACE_LABEL: Record<1 | 2 | 3, string> = { 1: "I", 2: "II", 3: "III" }

const PEDESTAL_HEIGHT: Record<1 | 2 | 3, string> = {
  1: "h-20 sm:h-24",
  2: "h-14 sm:h-16",
  3: "h-10 sm:h-12",
}

const PODIUM_SLOT_CONFIG: Record<
  1 | 2 | 3,
  {
    avatarSize: string
    nameSize: string
    ptsSize: string
    placeSize: string
    pedestalAccent: string
    glowClass: string
  }
> = {
  1: {
    avatarSize: "size-20 sm:size-24",
    nameSize: "text-sm font-semibold",
    ptsSize: "text-xl",
    placeSize: "text-2xl",
    pedestalAccent:
      "bg-primary text-primary-foreground ring-2 ring-primary/30 shadow-[0_0_24px_2px_color-mix(in_oklch,var(--color-primary)_25%,transparent)]",
    glowClass: "ring-2 ring-primary",
  },
  2: {
    avatarSize: "size-16 sm:size-18",
    nameSize: "text-xs font-medium",
    ptsSize: "text-base",
    placeSize: "text-xl",
    pedestalAccent: "bg-secondary text-secondary-foreground ring-1 ring-border",
    glowClass: "ring-2 ring-primary",
  },
  3: {
    avatarSize: "size-14 sm:size-16",
    nameSize: "text-xs font-medium",
    ptsSize: "text-base",
    placeSize: "text-xl",
    pedestalAccent: "bg-secondary text-secondary-foreground ring-1 ring-border",
    glowClass: "ring-2 ring-primary",
  },
}

function PodiumSpot({
  player,
  place,
  isCurrentUser,
}: {
  player: Player
  place: 1 | 2 | 3
  isCurrentUser: boolean
}) {
  const cfg = PODIUM_SLOT_CONFIG[place]

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0 max-w-[160px]">
      {/* Avatar + glow */}
      <div className="relative">
        {/* Gold crown for 1st */}
        {place === 1 && (
          <span
            className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl select-none"
            aria-hidden="true"
          >
            👑
          </span>
        )}
        <Avatar
          className={cn(
            cfg.avatarSize,
            "ring-offset-background",
            isCurrentUser ? cfg.glowClass : place === 1 ? "ring-2 ring-primary/60" : "",
          )}
        >
          {player.avatar_url && (
            <AvatarImage src={player.avatar_url} alt={player.username} />
          )}
          <AvatarFallback
            className={cn(
              "font-display font-bold uppercase",
              place === 1
                ? "bg-primary/20 text-primary text-lg"
                : "bg-muted text-muted-foreground text-base",
            )}
          >
            {getInitials(player)}
          </AvatarFallback>
        </Avatar>
        {isCurrentUser && (
          <span className="absolute -bottom-1 -right-1 size-3 rounded-full bg-primary border-2 border-background" />
        )}
      </div>

      {/* Username */}
      <p
        className={cn(
          cfg.nameSize,
          "truncate w-full text-center leading-tight",
          isCurrentUser ? "text-primary" : "text-card-foreground",
        )}
        title={player.username}
      >
        {player.username}
      </p>

      {/* Points */}
      <p
        className={cn(
          cfg.ptsSize,
          "font-mono font-bold tabular-nums",
          isCurrentUser ? "text-primary" : place === 1 ? "text-primary" : "text-foreground",
        )}
      >
        {player.total_points}
        <span className="text-muted-foreground text-xs font-normal ml-0.5">pkt</span>
      </p>

      {/* Pedestal */}
      <div
        className={cn(
          "w-full rounded-t-md flex items-center justify-center",
          PEDESTAL_HEIGHT[place],
          cfg.pedestalAccent,
        )}
        aria-label={`${place}. miejsce`}
      >
        <span
          className={cn(
            "font-display font-extrabold uppercase tracking-wide",
            cfg.placeSize,
            place === 1 ? "text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {PLACE_LABEL[place]}
        </span>
      </div>
    </div>
  )
}

export function Podium({ players, currentUserId }: Props) {
  if (players.length === 0) return null

  // Visual order: 2nd | 1st | 3rd
  const slots: PodiumSlot[] = []
  const places: (1 | 2 | 3)[] = [1, 2, 3]
  for (let i = 0; i < Math.min(players.length, 3); i++) {
    slots.push({ player: players[i], place: places[i], order: i })
  }

  // Rearrange to visual left-to-right: 2nd (order=1), 1st (order=0), 3rd (order=2)
  const visualOrder = [1, 0, 2].filter((i) => i < slots.length)
  const visualSlots = visualOrder.map((i) => slots[i])

  return (
    <div
      className="w-full rounded-xl border border-border bg-card/60 p-4 sm:p-6"
      aria-label="Podium — top 3"
    >
      <div className="flex items-end justify-center gap-2 sm:gap-4">
        {visualSlots.map(({ player, place }) => (
          <PodiumSpot
            key={player.id}
            player={player}
            place={place}
            isCurrentUser={player.id === currentUserId}
          />
        ))}
      </div>
    </div>
  )
}
