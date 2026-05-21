"use client"

import { useState, useTransition, useRef } from "react"
import { upsertPrediction } from "@/app/(app)/actions"
import { cn } from "@/lib/utils"
import { Lock, Check, AlertCircle, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type Props = {
  matchId: number
  matchStarted: boolean
  isOwn: boolean
  pred1: number | null
  pred2: number | null
  confirmed: boolean
  actualResult1?: number | null
  actualResult2?: number | null
}

export function PredictionCell({
  matchId,
  matchStarted,
  isOwn,
  pred1: initial1,
  pred2: initial2,
  confirmed,
  actualResult1,
  actualResult2,
}: Props) {
  const [v1, setV1] = useState<string>(initial1?.toString() ?? "")
  const [v2, setV2] = useState<string>(initial2?.toString() ?? "")
  const [, startTransition] = useTransition()
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "err">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cudzy typ przed kick-offem — ukryty
  if (!isOwn && !matchStarted) {
    return (
      <span className="text-muted-foreground/40 inline-block px-1 text-sm" aria-label="Ukryty typ">
        — : —
      </span>
    )
  }

  // Zablokowane (po kick-offie LUB cudzy typ — read-only)
  const isLocked = matchStarted || !isOwn

  const correct =
    isLocked &&
    actualResult1 != null &&
    actualResult2 != null &&
    initial1 != null &&
    initial2 != null
      ? initial1 === actualResult1 && initial2 === actualResult2
        ? "exact"
        : Math.sign(initial1 - initial2) === Math.sign(actualResult1 - actualResult2)
          ? "outcome"
          : "miss"
      : null

  if (isLocked) {
    if (initial1 == null || initial2 == null) {
      return (
        <span className="text-muted-foreground/40 inline-block px-1 text-sm">— : —</span>
      )
    }

    const tooltipText =
      correct === "exact"
        ? "Dokładny wynik (3 pkt)"
        : correct === "outcome"
          ? "Trafiony zwycięzca (1 pkt)"
          : correct === "miss"
            ? "Pudło (0 pkt)"
            : "Typ zablokowany"

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-mono tabular-nums",
                correct === "exact" && "border-success/60 bg-success/15 text-success",
                correct === "outcome" && "border-warning/60 bg-warning/15 text-warning",
                correct === "miss" && "border-border text-muted-foreground",
                !correct && "border-border",
              )}
            >
              {isOwn && !matchStarted && <Lock className="size-3" aria-hidden />}
              {initial1}:{initial2}
            </span>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Edytowalne (własne, przed kick-offem)
  const save = (n1: string, n2: string) => {
    if (n1 === "" || n2 === "") return
    const p1 = Number(n1)
    const p2 = Number(n2)
    if (!Number.isInteger(p1) || !Number.isInteger(p2)) {
      setErrorMsg("Tylko liczby całkowite")
      setSaved("err")
      return
    }
    if (p1 < 0 || p2 < 0 || p1 > 99 || p2 > 99) {
      setErrorMsg("Wynik 0–99")
      setSaved("err")
      return
    }

    setErrorMsg(null)
    setSaved("saving")
    startTransition(async () => {
      const result = await upsertPrediction(matchId, p1, p2)
      if (result.ok) {
        setSaved("ok")
        setTimeout(() => setSaved("idle"), 1200)
      } else {
        setErrorMsg(result.error ?? "Nie udało się zapisać")
        setSaved("err")
      }
    })
  }

  const onChange = (idx: 0 | 1, value: string) => {
    if (!/^\d{0,2}$/.test(value)) return
    if (idx === 0) {
      setV1(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => save(value, v2), 400)
    } else {
      setV2(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => save(v1, value), 400)
    }
  }

  return (
    // Stała szerokość kontenera — status (icon) jest pozycjonowany absolutnie,
    // więc pojawienie się ✓/⚠ nie przesuwa wiersza tabeli.
    <span className="relative inline-flex w-[5.5rem] items-center justify-center gap-0.5">
      <Input
        type="text"
        inputMode="numeric"
        pattern="\d*"
        maxLength={2}
        value={v1}
        onChange={(e) => onChange(0, e.target.value)}
        onBlur={() => save(v1, v2)}
        className={cn(
          "h-9 w-11 text-center font-mono tabular-nums text-base sm:h-8 sm:w-9",
          confirmed && saved !== "err" && "border-primary/40",
          saved === "ok" && "border-success",
          saved === "err" && "border-destructive",
        )}
        aria-label="Wynik gospodarzy"
        aria-invalid={saved === "err"}
      />
      <span className="text-muted-foreground text-xs">:</span>
      <Input
        type="text"
        inputMode="numeric"
        pattern="\d*"
        maxLength={2}
        value={v2}
        onChange={(e) => onChange(1, e.target.value)}
        onBlur={() => save(v1, v2)}
        className={cn(
          "h-9 w-11 text-center font-mono tabular-nums text-base sm:h-8 sm:w-9",
          confirmed && saved !== "err" && "border-primary/40",
          saved === "ok" && "border-success",
          saved === "err" && "border-destructive",
        )}
        aria-label="Wynik gości"
        aria-invalid={saved === "err"}
      />
      <StatusBadge state={saved} errorMsg={errorMsg} />
    </span>
  )
}

function StatusBadge({
  state,
  errorMsg,
}: {
  state: "idle" | "saving" | "ok" | "err"
  errorMsg: string | null
}) {
  if (state === "idle") return null

  return (
    <span
      className={cn(
        "absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full",
        "pointer-events-none",
      )}
      aria-live="polite"
    >
      {state === "saving" && (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Zapisuję" />
      )}
      {state === "ok" && (
        <Check className="size-3.5 text-success" aria-label="Zapisane" />
      )}
      {state === "err" && (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-destructive bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive whitespace-nowrap shadow-sm"
          title={errorMsg ?? "Błąd zapisu"}
        >
          <AlertCircle className="size-3" aria-hidden />
          {errorMsg ?? "Błąd"}
        </span>
      )}
    </span>
  )
}
