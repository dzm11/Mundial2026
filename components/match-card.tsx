"use client"

import { useState } from "react"
import { Users } from "lucide-react"

import { cn } from "@/lib/utils"
import type { MatchWithTeams, Player, PredictionRow } from "@/lib/types"
import { shortStage } from "@/lib/groups"
import { calculatePoints } from "@/lib/scoring"

import { Flag } from "@/components/flag"
import { PredictionCell } from "@/components/prediction-cell"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchCardProps = {
  match: MatchWithTeams
  players: Player[]
  predMap: Map<string, PredictionRow>
  currentUserId: string
  now: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getMatchInitials(name: string | null | undefined): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// Points badge for the current user
// ---------------------------------------------------------------------------

function PointsBadge({ points }: { points: number }) {
  return (
    <Badge
      className={cn(
        "font-mono tabular-nums text-xs",
        points === 3 && "bg-success/15 text-success border-success/30",
        points === 1 && "bg-warning/15 text-warning border-warning/30",
        points === 0 && "bg-muted/50 text-muted-foreground border-border",
      )}
      variant="outline"
    >
      {points} pkt
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Score block — center stage
// ---------------------------------------------------------------------------

function ScoreBlock({
  result1,
  result2,
  isLive,
}: {
  result1: number | null
  result2: number | null
  isLive: boolean
}) {
  const hasScore = result1 !== null && result2 !== null

  return (
    <div
      className={cn(
        "flex min-w-[4.5rem] flex-col items-center justify-center gap-0.5",
        "rounded-lg border px-3 py-1.5",
        isLive
          ? "border-destructive/40 bg-destructive/10"
          : "border-border bg-muted/40",
      )}
    >
      <span
        className={cn(
          "font-mono tabular-nums text-lg font-bold leading-none tracking-tight",
          isLive ? "text-destructive" : "text-foreground",
          !hasScore && "text-muted-foreground",
        )}
      >
        {hasScore ? `${result1} : ${result2}` : "– : –"}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Friends Sheet body (private sub-component)
// ---------------------------------------------------------------------------

function FriendsSheetBody({
  match,
  players,
  predMap,
  matchStarted,
}: {
  match: MatchWithTeams
  players: Player[]
  predMap: Map<string, PredictionRow>
  matchStarted: boolean
}) {
  return (
    <ScrollArea className="flex-1 overflow-auto">
      <div className="flex flex-col gap-1 px-4 pb-6">
        {players.map((player, idx) => {
          const row = predMap.get(player.id)
          const initials = player.username
            ? player.username.slice(0, 2).toUpperCase()
            : getMatchInitials(player.first_name + " " + player.last_name)

          return (
            <div key={player.id}>
              {idx > 0 && <Separator className="my-1 opacity-40" />}
              <div className="flex items-center gap-3 py-2">
                {/* Avatar */}
                <Avatar size="default">
                  {player.avatar_url ? (
                    <AvatarImage src={player.avatar_url} alt={player.username} />
                  ) : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>

                {/* Username */}
                <span className="flex-1 truncate text-sm font-medium text-foreground">
                  {player.username}
                </span>

                {/* Read-only prediction */}
                <PredictionCell
                  matchId={match.id}
                  matchStarted={matchStarted}
                  isOwn={false}
                  pred1={row?.pred1 ?? null}
                  pred2={row?.pred2 ?? null}
                  confirmed={row?.confirmed_at != null}
                  actualResult1={match.result1}
                  actualResult2={match.result2}
                />
              </div>
            </div>
          )
        })}

        {players.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Brak znajomych w tej grupie.
          </p>
        )}
      </div>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function MatchCard({
  match,
  players,
  predMap,
  currentUserId,
  now,
}: MatchCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const matchStarted = new Date(match.kickoff_at).getTime() <= now
  const isLive =
    match.status === "IN_PLAY" || match.status === "PAUSED"
  const isFinished = match.status === "FINISHED"

  const currentUserRow = predMap.get(currentUserId)

  // Points for the current user (only meaningful when FINISHED)
  const currentUserPoints =
    isFinished && currentUserRow
      ? calculatePoints(
          { status: match.status, result1: match.result1, result2: match.result2 },
          {
            pred1: currentUserRow.pred1,
            pred2: currentUserRow.pred2,
            confirmedAt: currentUserRow.confirmed_at,
          },
        )
      : null

  // Sheet title: "Brazylia – Chorwacja" style
  const sheetTitle =
    [match.team1?.name, match.team2?.name].filter(Boolean).join(" – ") ||
    "Mecz"

  return (
    <Card size="sm" className="gap-0 py-0 overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Header: kickoff time + phase label + status badge                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono tabular-nums text-xs font-medium text-muted-foreground shrink-0">
            {formatKickoff(match.kickoff_at)}
          </span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="font-heading uppercase tracking-wide text-xs text-muted-foreground truncate">
            {shortStage(match.stage, match.group_letter)}
          </span>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          {isLive && (
            <Badge
              variant="destructive"
              className="animate-pulse font-heading uppercase tracking-widest text-[10px] px-2"
            >
              LIVE
            </Badge>
          )}
          {isFinished && (
            <Badge variant="secondary" className="font-heading uppercase tracking-wide text-[10px] px-2">
              FT
            </Badge>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Teams + score row                                                   */}
      {/* ------------------------------------------------------------------ */}
      <CardContent className="px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Team 1 — left side, text-right aligned */}
          <div className="flex min-w-0 flex-1 flex-col items-end gap-1 text-right">
            <Flag
              isoCode={match.team1?.iso_code}
              className="h-5 w-7 rounded-sm"
              alt={match.team1?.name ?? undefined}
            />
            <span className="font-medium text-sm leading-tight line-clamp-2 w-full">
              {match.team1?.name ?? "—"}
            </span>
          </div>

          {/* Score block — center */}
          <ScoreBlock
            result1={match.result1}
            result2={match.result2}
            isLive={isLive}
          />

          {/* Team 2 — right side, text-left aligned */}
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left">
            <Flag
              isoCode={match.team2?.iso_code}
              className="h-5 w-7 rounded-sm"
              alt={match.team2?.name ?? undefined}
            />
            <span className="font-medium text-sm leading-tight line-clamp-2 w-full">
              {match.team2?.name ?? "—"}
            </span>
          </div>
        </div>
      </CardContent>

      {/* ------------------------------------------------------------------ */}
      {/* Your prediction row                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-t border-border/60 bg-muted/20 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-heading uppercase tracking-wide text-[11px] text-muted-foreground">
            Twój typ
          </span>

          <div className="flex items-center gap-2">
            {/* Points badge shown after match FINISHED */}
            {isFinished && currentUserPoints !== null && (
              <PointsBadge points={currentUserPoints} />
            )}

            <PredictionCell
              matchId={match.id}
              matchStarted={matchStarted}
              isOwn={true}
              pred1={currentUserRow?.pred1 ?? null}
              pred2={currentUserRow?.pred2 ?? null}
              confirmed={currentUserRow?.confirmed_at != null}
              actualResult1={match.result1}
              actualResult2={match.result2}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer: Friends sheet trigger                                       */}
      {/* ------------------------------------------------------------------ */}
      <CardFooter className="px-4 py-2 border-t border-border/40">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Users className="size-3.5" aria-hidden />
              Typy znajomych
            </Button>
          </SheetTrigger>

          <SheetContent
            side="bottom"
            className="max-h-[80dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
          >
            <SheetHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                {/* Mini flags in the sheet header */}
                <Flag
                  isoCode={match.team1?.iso_code}
                  className="h-4 w-6 rounded-sm"
                  alt={match.team1?.name ?? undefined}
                />
                <SheetTitle className="font-heading text-base uppercase tracking-wide">
                  {sheetTitle}
                </SheetTitle>
                <Flag
                  isoCode={match.team2?.iso_code}
                  className="h-4 w-6 rounded-sm"
                  alt={match.team2?.name ?? undefined}
                />
              </div>
            </SheetHeader>

            <FriendsSheetBody
              match={match}
              players={players}
              predMap={predMap}
              matchStarted={matchStarted}
            />
          </SheetContent>
        </Sheet>
      </CardFooter>
    </Card>
  )
}
