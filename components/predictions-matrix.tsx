"use client"

import { useEffect, useMemo, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Flag } from "@/components/flag"
import { PhaseFilter } from "@/components/phase-filter"
import { PredictionCell } from "@/components/prediction-cell"
import type { MatchWithTeams, Player, PredictionRow } from "@/lib/types"
import { matchInPhase, shortStage, type PhaseKey } from "@/lib/groups"
import { matchClock } from "@/lib/match-clock"
import { cn, displayName } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  matches: MatchWithTeams[]
  players: Player[]
  predictions: PredictionRow[]
  currentUserId: string
  // Znacznik czasu z serwera (prop) — identyczny na serwerze i przy
  // hydratacji, eliminuje rozjazd hydratacji.
  serverNow: number
}

type GroupedSection = {
  key: string
  title: string
  matches: MatchWithTeams[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Krótki 3-literowy kod drużyny (FIFA) — fallback: pierwsze 3 litery nazwy.
function teamCode(team: { fifa_code?: string | null; name?: string | null } | null): string {
  if (team?.fifa_code) return team.fifa_code.toUpperCase()
  const name = team?.name ?? ""
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3).toUpperCase() || "—"
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


// ── Sub-components ────────────────────────────────────────────────────────────

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
        <span className="bg-success/15 border-success/60 inline-block h-3 w-3 rounded border" />
        3 pkt — dokładny wynik
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-warning/15 border-warning/60 inline-block h-3 w-3 rounded border" />
        1 pkt — trafiony zwycięzca/remis
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="border-border inline-block h-3 w-3 rounded border" />
        0 pkt — pudło
      </span>
      <span>· Cudze typy odsłaniają się w momencie kick-offu.</span>
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
      {/* Day-section header row — single cell spanning the whole row so the long
          day label doesn't dictate the first column's width (auto table-layout
          sizes a column to its widest cell).  An inner `sticky left-0` keeps the
          label pinned to the left while the grid scrolls horizontally. */}
      <TableRow className="bg-muted hover:bg-muted">
        <TableCell colSpan={5 + players.length} className="bg-muted p-0">
          <div className="sticky left-0 inline-block px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </div>
        </TableCell>
      </TableRow>

      {section.matches.map((match) => {
        const matchStarted = new Date(match.kickoff_at).getTime() <= now
        const userPreds = predMap.get(match.id) ?? new Map()

        return (
          <TableRow key={match.id} className="border-t">
            {/* ── Sticky first column: match info ── */}
            <TableCell className="sticky left-0 z-10 w-[120px] min-w-[120px] bg-card px-2 py-2 sm:px-3">
              {/* This cell needs bg-card to mask scrolling rows */}
              <div className="flex flex-col gap-0.5 whitespace-nowrap">
                <span className="font-mono font-medium text-foreground">
                  {formatKickoff(match.kickoff_at)}
                </span>
                <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                  {shortStage(match.stage, match.group_letter)}
                </span>

                {/* Mobile-only: kompaktowy mecz (flagi + kody + wynik) — na desktopie
                    te dane są w osobnych kolumnach Gospodarz/Wynik/Gość */}
                <div className="mt-1 flex flex-col gap-0.5 sm:hidden">
                  <div className="flex items-center gap-1.5">
                    <Flag isoCode={match.team1?.iso_code} alt={match.team1?.name ?? ""} className="h-3.5 w-5" />
                    <span className="text-xs font-medium">{teamCode(match.team1)}</span>
                    <span className="ml-auto pl-1 font-mono text-sm tabular-nums">{match.result1 ?? "–"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flag isoCode={match.team2?.iso_code} alt={match.team2?.name ?? ""} className="h-3.5 w-5" />
                    <span className="text-xs font-medium">{teamCode(match.team2)}</span>
                    <span className="ml-auto pl-1 font-mono text-sm tabular-nums">{match.result2 ?? "–"}</span>
                  </div>
                </div>

                {(() => {
                  const clock = matchClock(match, now)
                  if (clock.phase === "live") {
                    return (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-500">
                        <span className="relative flex size-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                          <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
                        </span>
                        <span className="font-mono tabular-nums">{clock.minute}&apos;</span>
                      </span>
                    )
                  }
                  if (clock.phase === "halftime") {
                    return <span className="text-[10px] font-semibold text-muted-foreground">Przerwa</span>
                  }
                  if (clock.phase === "finished") {
                    return <span className="text-success text-[10px]">FT</span>
                  }
                  return null
                })()}
              </div>
            </TableCell>

            {/* Home team (desktop only) */}
            <TableCell className="hidden px-2 py-2 text-right sm:table-cell">
              <span className="inline-flex items-center gap-2">
                <span className="font-medium">{match.team1?.name ?? "—"}</span>
                <Flag isoCode={match.team1?.iso_code} alt={match.team1?.name ?? ""} />
              </span>
            </TableCell>

            {/* Result boxes (desktop only) */}
            <TableCell className="hidden px-1 py-2 text-center sm:table-cell">
              <ResultBox value={match.result1} status={match.status} />
            </TableCell>
            <TableCell className="hidden px-1 py-2 text-center sm:table-cell">
              <ResultBox value={match.result2} status={match.status} />
            </TableCell>

            {/* Away team (desktop only) */}
            <TableCell className="hidden px-2 py-2 text-left sm:table-cell">
              <span className="inline-flex items-center gap-2">
                <Flag isoCode={match.team2?.iso_code} alt={match.team2?.name ?? ""} />
                <span className="font-medium">{match.team2?.name ?? "—"}</span>
              </span>
            </TableCell>

            {/* Per-player prediction cells */}
            {players.map((player) => {
              const p = userPreds.get(player.id)
              return (
                <TableCell
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
                    actualResult1={match.result1}
                    actualResult2={match.result2}
                  />
                </TableCell>
              )
            })}
          </TableRow>
        )
      })}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PredictionsMatrix({
  matches,
  players,
  predictions,
  currentUserId,
  serverNow,
}: Props) {
  const [phase, setPhase] = useState<PhaseKey>("upcoming")

  // `now` startuje od serverNow (prop — identyczny na serwerze i przy
  // hydratacji), po zamontowaniu odświeża się co 30 s realnym czasem.
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Twoja kolumna jako pierwsza (zaraz po meczu) — lepszy UX.
  // Reszta zachowuje kolejność rankingową (`players` przychodzi posortowane).
  const orderedPlayers = useMemo(() => {
    const me = players.find((p) => p.id === currentUserId)
    if (!me) return players
    return [me, ...players.filter((p) => p.id !== currentUserId)]
  }, [players, currentUserId])

  // Lider rankingu = pierwszy w oryginalnej (posortowanej) liście — używany
  // do wyróżnienia odznaki, niezależnie od kolejności kolumn.
  const leaderId = players[0]?.id

  // Build predMap: matchId → userId → PredictionRow
  const predMap = useMemo(() => {
    const m = new Map<number, Map<string, PredictionRow>>()
    for (const p of predictions) {
      if (!m.has(p.match_id)) m.set(p.match_id, new Map())
      m.get(p.match_id)!.set(p.user_id, p)
    }
    return m
  }, [predictions])

  // Filter matches by selected phase
  const filteredMatches = useMemo(
    () => matches.filter((m) => matchInPhase(m, phase, now)),
    [matches, phase, now],
  )

  // Group filtered matches by calendar day (local timezone), sorted chronologically
  const sections = useMemo<GroupedSection[]>(() => {
    const buckets = new Map<string, MatchWithTeams[]>()
    for (const match of filteredMatches) {
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
  }, [filteredMatches])

  return (
    <div className="space-y-4">
      {/* Controls row: phase filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PhaseFilter value={phase} onValueChange={setPhase} />
      </div>

      {/* Empty state when no matches match the filter */}
      {sections.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">
            Brak meczów w wybranej fazie.
          </p>
        </div>
      ) : (
        /*
         * Scroll container strategy:
         * - The shadcn `Table` component is intentionally NOT used here because its
         *   wrapper `<div>` has a non-configurable `overflow-x-auto` that would create
         *   a nested scroll container and break two-axis `position: sticky`.
         * - A raw `<table>` is placed directly inside the single ScrollArea viewport,
         *   which is the sole scroll root for both axes.  `TableHeader`, `TableBody`,
         *   `TableRow`, `TableHead`, and `TableCell` from shadcn/ui are used for the
         *   inner structure.
         * - No vertical height cap on any breakpoint: the table renders at full
         *   height and the *page* scrolls naturally (no cramped inner scroll
         *   window).  Trade-off: `sticky top-0` on the header has no effect without
         *   an inner scroll container — the day-section rows act as separators
         *   instead.  The sticky LEFT match column still works; it depends on
         *   horizontal overflow, not the vertical height cap.
         */
        <ScrollArea className="rounded-lg border bg-card">
            <table className="w-full caption-bottom text-sm">
              {/* ── Sticky header ── */}
              <TableHeader>
                <TableRow className="border-b">
                  {/*
                   * Top-left intersection cell — must have the HIGHEST z-index (z-30)
                   * and a solid background to mask both horizontally and vertically
                   * scrolled content.
                   */}
                  <TableHead
                    className={cn(
                      "sticky left-0 top-0 z-30 bg-card",
                      "w-[120px] min-w-[120px] px-2 py-3 sm:px-3",
                    )}
                  >
                    <span className="font-display text-xs uppercase tracking-wide text-muted-foreground">
                      <span className="sm:hidden">Mecz</span>
                      <span className="hidden sm:inline">Termin</span>
                    </span>
                  </TableHead>

                  {/* Home team header — sticky top, not left (desktop only) */}
                  <TableHead className="sticky top-0 z-20 hidden bg-card px-3 py-3 text-right sm:table-cell">
                    <span className="text-xs font-medium text-muted-foreground">Gospodarz</span>
                  </TableHead>

                  {/* Score headers (desktop only) */}
                  <TableHead
                    className="sticky top-0 z-20 hidden bg-card px-1 py-3 text-center sm:table-cell"
                    colSpan={2}
                  >
                    <span className="font-display text-xs uppercase tracking-wide text-muted-foreground">
                      Wynik
                    </span>
                  </TableHead>

                  {/* Away team header (desktop only) */}
                  <TableHead className="sticky top-0 z-20 hidden bg-card px-3 py-3 text-left sm:table-cell">
                    <span className="text-xs font-medium text-muted-foreground">Gość</span>
                  </TableHead>

                  {/* Per-player header cells */}
                  {orderedPlayers.map((p) => (
                    <TableHead
                      key={p.id}
                      className={cn(
                        "sticky top-0 z-20 bg-card min-w-[6rem] px-2 py-3 text-center",
                        p.id === currentUserId && "bg-primary/10",
                      )}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Avatar className="size-7">
                          {p.avatar_url && (
                            <AvatarImage src={p.avatar_url} alt={p.username} />
                          )}
                          <AvatarFallback className="text-xs">
                            {p.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className="break-words text-xs font-normal leading-tight"
                          title={`@${p.username}`}
                        >
                          {displayName(p)}
                        </span>
                        <Badge
                          variant={p.id === leaderId ? "default" : "secondary"}
                          className="font-mono"
                        >
                          {p.total_points}
                        </Badge>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              {/* ── Body ── */}
              <TableBody>
                {sections.map((section) => (
                  <SectionBlock
                    key={section.key}
                    section={section}
                    players={orderedPlayers}
                    predMap={predMap}
                    currentUserId={currentUserId}
                    now={now}
                  />
                ))}
              </TableBody>
            </table>
        </ScrollArea>
      )}

      <Legend />
    </div>
  )
}
