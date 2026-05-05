"use client"

import { useMemo, useSyncExternalStore, useTransition } from "react"
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

type GroupedSection = {
  key: string
  title: string
  matches: MatchWithTeams[]
}

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  })
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
    year: "numeric",
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

export function LeaderboardTable({
  matches,
  players,
  predictions,
  currentUserId,
}: Props) {
  const [pending, startTransition] = useTransition()

  // Mapa: matchId -> userId -> prediction
  const predMap = useMemo(() => {
    const m = new Map<number, Map<string, PredictionRow>>()
    for (const p of predictions) {
      if (!m.has(p.match_id)) m.set(p.match_id, new Map())
      m.get(p.match_id)!.set(p.user_id, p)
    }
    return m
  }, [predictions])

  // Grupowanie po dniu kalendarzowym (lokalna strefa czasowa), chronologicznie
  const sections = useMemo<GroupedSection[]>(() => {
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

  const onConfirmAll = () => {
    startTransition(async () => {
      await confirmAllPredictions()
    })
  }

  const now = useNowTick()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tabela typerska</h1>
          <p className="text-muted-foreground text-sm">
            {matches.length} meczów · {players.length} graczy
          </p>
        </div>
        <Button onClick={onConfirmAll} disabled={pending}>
          {pending ? "Zapisuję…" : "Zatwierdź moje typy"}
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 text-left font-medium w-[7rem]">Termin</th>
              <th className="px-3 py-3 text-right font-medium">Gospodarz</th>
              <th className="px-2 py-3 text-center font-medium" colSpan={2}>
                Wynik
              </th>
              <th className="px-3 py-3 text-left font-medium">Gość</th>
              {players.map((p, idx) => (
                <th
                  key={p.id}
                  className={cn(
                    "px-2 py-3 text-center font-medium min-w-[6rem]",
                    p.id === currentUserId && "bg-primary/10",
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Avatar className="size-7">
                      {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.username} />}
                      <AvatarFallback className="text-xs">
                        {(p.first_name[0] ?? "") + (p.last_name[0] ?? "")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs leading-tight font-normal">
                      {p.first_name}
                      <br />
                      {p.last_name}
                    </span>
                    <Badge variant={idx === 0 ? "default" : "secondary"} className="font-mono">
                      {p.total_points}
                    </Badge>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <SectionBlock
                key={section.key}
                section={section}
                players={players}
                predMap={predMap}
                currentUserId={currentUserId}
                now={now}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Legend />
    </div>
  )
}

function SectionBlock({
  section,
  players,
  predMap,
  currentUserId,
  now,
}: {
  section: GroupedSection
  players: Player[]
  predMap: Map<number, Map<string, PredictionRow>>
  currentUserId: string
  now: number
}) {
  return (
    <>
      <tr className="bg-muted/30">
        <td
          colSpan={5 + players.length}
          className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {section.title}
        </td>
      </tr>
      {section.matches.map((match) => {
        const matchStarted = new Date(match.kickoff_at).getTime() <= now
        const userPreds = predMap.get(match.id) ?? new Map()
        return (
          <tr key={match.id} className="border-t hover:bg-muted/20">
            <td className="px-3 py-2 text-xs whitespace-nowrap">
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-mono font-medium">
                  {formatKickoff(match.kickoff_at)}
                </span>
                <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                  {stageBadge(match.stage, match.group_letter)}
                </span>
                {match.status === "IN_PLAY" && (
                  <Badge variant="destructive" className="animate-pulse text-[10px] w-fit">
                    LIVE
                  </Badge>
                )}
                {match.status === "FINISHED" && (
                  <span className="text-[10px] text-green-600">FT</span>
                )}
              </div>
            </td>
            <td className="px-2 py-2 text-right">
              <span className="inline-flex items-center gap-2">
                <span className="font-medium">{match.team1?.name ?? "—"}</span>
                <Flag isoCode={match.team1?.iso_code} alt={match.team1?.name ?? ""} />
              </span>
            </td>
            <td className="px-1 py-2 text-center">
              <ResultBox value={match.result1} status={match.status} />
            </td>
            <td className="px-1 py-2 text-center">
              <ResultBox value={match.result2} status={match.status} />
            </td>
            <td className="px-2 py-2 text-left">
              <span className="inline-flex items-center gap-2">
                <Flag isoCode={match.team2?.iso_code} alt={match.team2?.name ?? ""} />
                <span className="font-medium">{match.team2?.name ?? "—"}</span>
              </span>
            </td>
            {players.map((player) => {
              const p = userPreds.get(player.id)
              return (
                <td
                  key={player.id}
                  className={cn(
                    "px-2 py-2 text-center align-middle",
                    player.id === currentUserId && "bg-primary/5",
                  )}
                >
                  <PredictionCell
                    key={`${match.id}-${player.id}-${p?.pred1 ?? "x"}-${p?.pred2 ?? "x"}`}
                    matchId={match.id}
                    matchStarted={matchStarted}
                    isOwn={player.id === currentUserId}
                    pred1={p?.pred1 ?? null}
                    pred2={p?.pred2 ?? null}
                    confirmed={!!p?.confirmed_at}
                    actualResult1={match.result1}
                    actualResult2={match.result2}
                  />
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}

// Subscribe + getSnapshot poza komponentem — referencje muszą być stabilne między renderami.
const subscribeNow = (cb: () => void) => {
  const id = setInterval(cb, 30_000)
  return () => clearInterval(id)
}
const getNowBucket = () => Math.floor(Date.now() / 30_000) * 30_000
const getServerNow = () => 0

function useNowTick(): number {
  return useSyncExternalStore(subscribeNow, getNowBucket, getServerNow)
}

function ResultBox({ value, status }: { value: number | null; status: string }) {
  const isFinal = status === "FINISHED" || status === "IN_PLAY" || status === "PAUSED"
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded border px-1.5 font-mono text-base tabular-nums",
        isFinal ? "border-foreground/30 font-semibold" : "border-dashed text-muted-foreground/40",
      )}
    >
      {value ?? "–"}
    </span>
  )
}

function Legend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded border border-green-500 bg-green-50" />3 pkt
        — dokładny wynik
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded border border-amber-400 bg-amber-50" />1 pkt
        — trafiony zwycięzca/remis
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded border border-muted-foreground/30" />0 pkt —
        pudło
      </span>
      <span>· Cudze typy odsłaniają się w momencie kick-offu.</span>
    </div>
  )
}
