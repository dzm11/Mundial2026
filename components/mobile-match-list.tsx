"use client"

import { useMemo, useSyncExternalStore, useTransition } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Flag } from "@/components/flag"
import { PredictionCell } from "@/components/prediction-cell"
import { confirmAllPredictions } from "@/app/(app)/actions"
import type { MatchWithTeams, Player, PredictionRow } from "@/lib/types"
import { cn } from "@/lib/utils"

type Props = {
  matches: MatchWithTeams[]
  players: Player[]
  predictions: PredictionRow[]
  currentUserId: string
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  })
}

function stageBadge(stage: string, groupLetter: string | null): string {
  if (stage === "GROUP") return `Grupa ${groupLetter ?? "?"}`
  if (stage === "R32") return "1/16"
  if (stage === "R16") return "1/8"
  if (stage === "QF") return "Ćwierćfinał"
  if (stage === "SF") return "Półfinał"
  if (stage === "3RD") return "O 3. miejsce"
  if (stage === "F") return "Finał"
  return stage
}

export function MobileMatchList({ matches, players, predictions, currentUserId }: Props) {
  const [pending, startTransition] = useTransition()

  const predMap = useMemo(() => {
    const m = new Map<number, Map<string, PredictionRow>>()
    for (const p of predictions) {
      if (!m.has(p.match_id)) m.set(p.match_id, new Map())
      m.get(p.match_id)!.set(p.user_id, p)
    }
    return m
  }, [predictions])

  const sections = useMemo(() => {
    const buckets = new Map<string, MatchWithTeams[]>()
    for (const match of matches) {
      const key = dayKey(match.kickoff_at)
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(match)
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, dayMatches]) => ({
        key,
        title: dayLabel(dayMatches[0].kickoff_at),
        matches: dayMatches,
      }))
  }, [matches])

  const onConfirm = () => {
    startTransition(async () => {
      await confirmAllPredictions()
    })
  }

  const now = useNowTick()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mecze</h1>
        <Button size="sm" onClick={onConfirm} disabled={pending}>
          Zatwierdź typy
        </Button>
      </div>

      <PlayerStrip players={players} currentUserId={currentUserId} />

      {sections.map((section) => (
        <div key={section.key} className="space-y-2">
          <h2 className="text-muted-foreground px-2 text-xs font-bold uppercase tracking-wider">
            {section.title}
          </h2>
          <div className="rounded-lg border bg-card divide-y">
            {section.matches.map((match) => {
              const matchStarted = new Date(match.kickoff_at).getTime() <= now
              const userPreds = predMap.get(match.id) ?? new Map()
              const ownPred = userPreds.get(currentUserId)
              return (
                <Sheet key={match.id}>
                  <SheetTrigger asChild>
                    <button className="flex w-full items-center gap-3 p-3 text-left active:bg-muted/40">
                      <div className="w-16 text-xs leading-tight">
                        <div className="font-mono font-medium">{fmtTime(match.kickoff_at)}</div>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                          {stageBadge(match.stage, match.group_letter)}
                        </div>
                        {match.status === "IN_PLAY" && (
                          <Badge variant="destructive" className="mt-1 text-[10px]">
                            LIVE
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-1 items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <Flag isoCode={match.team1?.iso_code} />
                          <span className="truncate font-medium">{match.team1?.name}</span>
                        </div>
                        <div className="text-center font-mono text-base font-semibold">
                          {match.result1 ?? "–"} : {match.result2 ?? "–"}
                        </div>
                        <div className="flex items-center gap-2 truncate justify-end">
                          <span className="truncate font-medium">{match.team2?.name}</span>
                          <Flag isoCode={match.team2?.iso_code} />
                        </div>
                      </div>
                      <div
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs font-mono tabular-nums",
                          ownPred?.confirmed_at && "border-primary text-primary",
                        )}
                      >
                        {ownPred ? `${ownPred.pred1}:${ownPred.pred2}` : "—:—"}
                      </div>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[80svh] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>
                        {match.team1?.name} – {match.team2?.name}
                      </SheetTitle>
                      <SheetDescription>
                        {fmtDay(match.kickoff_at)} · {fmtTime(match.kickoff_at)}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4 space-y-4 px-4 pb-6">
                      <div className="rounded-md border bg-muted/30 p-3">
                        <div className="text-muted-foreground mb-2 text-xs">Twój typ</div>
                        <PredictionCell
                          matchId={match.id}
                          matchStarted={matchStarted}
                          isOwn
                          pred1={ownPred?.pred1 ?? null}
                          pred2={ownPred?.pred2 ?? null}
                          confirmed={!!ownPred?.confirmed_at}
                          actualResult1={match.result1}
                          actualResult2={match.result2}
                        />
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-2 text-xs">Pozostali</div>
                        <ul className="space-y-1.5">
                          {players
                            .filter((p) => p.id !== currentUserId)
                            .map((player) => {
                              const p = userPreds.get(player.id)
                              return (
                                <li
                                  key={player.id}
                                  className="flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <Avatar className="size-6">
                                      {player.avatar_url && (
                                        <AvatarImage src={player.avatar_url} />
                                      )}
                                      <AvatarFallback className="text-[10px]">
                                        {player.first_name[0]}
                                        {player.last_name[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">
                                      {player.first_name} {player.last_name}
                                    </span>
                                  </div>
                                  <PredictionCell
                                    matchId={match.id}
                                    matchStarted={matchStarted}
                                    isOwn={false}
                                    pred1={p?.pred1 ?? null}
                                    pred2={p?.pred2 ?? null}
                                    confirmed={!!p?.confirmed_at}
                                    actualResult1={match.result1}
                                    actualResult2={match.result2}
                                  />
                                </li>
                              )
                            })}
                        </ul>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

const subscribeNow = (cb: () => void) => {
  const id = setInterval(cb, 30_000)
  return () => clearInterval(id)
}
const getNowBucket = () => Math.floor(Date.now() / 30_000) * 30_000
const getServerNow = () => 0

function useNowTick(): number {
  return useSyncExternalStore(subscribeNow, getNowBucket, getServerNow)
}

function PlayerStrip({ players, currentUserId }: { players: Player[]; currentUserId: string }) {
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <ol className="flex gap-2">
        {players.map((p, idx) => (
          <li
            key={p.id}
            className={cn(
              "shrink-0 rounded-md border bg-card px-2 py-1.5 flex items-center gap-2",
              p.id === currentUserId && "border-primary",
            )}
          >
            <span className="text-muted-foreground text-xs font-mono w-4 text-center">
              {idx + 1}.
            </span>
            <Avatar className="size-6">
              {p.avatar_url && <AvatarImage src={p.avatar_url} />}
              <AvatarFallback className="text-[10px]">
                {p.first_name[0]}
                {p.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm leading-none">
              {p.first_name} {p.last_name[0]}.
            </span>
            <Badge variant="secondary" className="font-mono">
              {p.total_points}
            </Badge>
          </li>
        ))}
      </ol>
    </div>
  )
}
