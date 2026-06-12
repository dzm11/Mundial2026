"use client"

import { useEffect, useMemo, useState } from "react"

import { MatchCard } from "@/components/match-card"
import { PhaseFilter } from "@/components/phase-filter"
import { matchInPhase, type PhaseKey } from "@/lib/groups"
import type { MatchWithTeams, Player, PredictionRow } from "@/lib/types"

// ---------------------------------------------------------------------------
// Day grouping helpers (local timezone)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type MatchesBoardProps = {
  matches: MatchWithTeams[]
  players: Player[]
  predictions: PredictionRow[]
  currentUserId: string
  // Znacznik czasu policzony na serwerze i przekazany propsem — ten sam na
  // serwerze i przy hydratacji, więc nie powoduje rozjazdu hydratacji.
  serverNow: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MatchesBoard({
  matches,
  players,
  predictions,
  currentUserId,
  serverNow,
}: MatchesBoardProps) {
  const [phase, setPhase] = useState<PhaseKey>("upcoming")

  // `now` startuje od serverNow (prop — identyczny na serwerze i przy
  // hydratacji), po zamontowaniu odświeża się co 30 s realnym czasem.
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // matchId → userId → PredictionRow
  const predMap = useMemo(() => {
    const m = new Map<number, Map<string, PredictionRow>>()
    for (const p of predictions) {
      if (!m.has(p.match_id)) m.set(p.match_id, new Map())
      m.get(p.match_id)!.set(p.user_id, p)
    }
    return m
  }, [predictions])

  // Filter by selected phase
  const filteredMatches = useMemo(
    () => matches.filter((m) => matchInPhase(m, phase, now)),
    [matches, phase, now],
  )

  // Group filtered matches by calendar day, sorted chronologically
  const sections = useMemo(() => {
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
      {/* Top bar: phase filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PhaseFilter value={phase} onValueChange={setPhase} />
      </div>

      {/* Empty state */}
      {filteredMatches.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Brak meczów w tej fazie.
        </p>
      )}

      {/* Day-grouped match cards */}
      {sections.map((section) => (
        <div key={section.key} className="space-y-3">
          <h2 className="font-heading uppercase tracking-wide text-xs text-muted-foreground px-0.5">
            {section.title}
          </h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {section.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                players={players}
                predMap={predMap.get(match.id) ?? new Map()}
                currentUserId={currentUserId}
                now={now}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
