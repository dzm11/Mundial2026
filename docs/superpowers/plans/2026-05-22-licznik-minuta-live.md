# Licznik kick-offu + znacznik live + minuta — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na karcie meczu i w Siatce: odliczanie do kick-offu, zielone pulsujące kółko + minuta gdy mecz trwa, znacznik „Przerwa" w przerwie.

**Architecture:** Czysta funkcja `matchClock(match, now)` w `lib/match-clock.ts` to jedno źródło prawdy o fazie i minucie. Prawdziwe mecze: faza/minuta z `status` + nowej kolumny `matches.minute` synchronizowanej z football-data.org. Mecz demo: faza/minuta liczone z `kickoff_at` + stałych faz demo; `settleDemoMatches` steruje kolumną `status`. Karta meczu dla meczu demo odświeża się co 1 s (fazy demo są 15-sekundowe).

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Tailwind/shadcn, vitest.

**Spec:** `docs/superpowers/specs/2026-05-22-licznik-minuta-live-design.md`

**Weryfikacja w każdym zadaniu:** `npm run build`, `npm run typecheck`, `npm run lint` przechodzą. `npm run test` sprawdzany w zadaniach z testem i na końcu.

**Uwaga o akcjach:** klient admina — wzorzec w `app/(auth)/actions.ts` (`const admin = createAdminClient()`, synchronicznie).

---

## Mapa plików

**Nowe:** `supabase/migrations/0005_match_minute.sql`, `lib/match-clock.ts`, `lib/match-clock.test.ts`
**Zmieniane:** `lib/types.ts`, `lib/data.ts`, `app/api/cron/sync-matches/route.ts`, `app/(app)/demo-actions.ts`, `components/match-card.tsx`, `components/predictions-matrix.tsx`, `components/demo-panel.tsx`

---

## Task 1: Kolumna `minute` — baza, typ, select, synchronizacja

**Files:** Create `supabase/migrations/0005_match_minute.sql`; Modify `lib/types.ts`, `lib/data.ts`, `app/api/cron/sync-matches/route.ts`

- [ ] **Step 1: Migracja** — utwórz `supabase/migrations/0005_match_minute.sql`:

```sql
-- Minuta meczu (z football-data.org) — dla znacznika live na kartach meczów.
alter table public.matches add column minute int;
```

- [ ] **Step 2: Typ `Match`** — w `lib/types.ts`, w typie `Match`, po `result2: number | null` dodaj linię:

```ts
  minute: number | null
```

(Typ `Match` ma już pole `is_demo: boolean` — zostaw je.)

- [ ] **Step 3: `MATCH_SELECT`** — w `lib/data.ts` dodaj `minute` do stringa selecta. Pierwsza linia `MATCH_SELECT` ma kończyć się na `..., result1, result2, minute, is_demo, ` (dopisz `minute,` przed `is_demo,`).

- [ ] **Step 4: Sync route** — w `app/api/cron/sync-matches/route.ts`:
  - W typie `FdMatch` dodaj pole: `minute: number | null`
  - W obiekcie przekazywanym do `.update({...})` na tabeli `matches` dodaj: `minute: m.minute ?? null,`

- [ ] **Step 5: Weryfikacja** — `npm run build && npm run typecheck && npm run lint` — przechodzą.

- [ ] **Step 6: Commit**
```bash
git add supabase/migrations/0005_match_minute.sql lib/types.ts lib/data.ts app/api/cron/sync-matches/route.ts
git commit -m "feat: kolumna minute + synchronizacja minuty z API"
```

---

## Task 2: `lib/match-clock.ts` — czysta funkcja zegara meczu

**Files:** Create `lib/match-clock.ts`, `lib/match-clock.test.ts`

- [ ] **Step 1: Test `lib/match-clock.test.ts`** (najpierw — ma nie przechodzić):

```ts
import { describe, it, expect } from "vitest"

import {
  matchClock,
  DEMO_HALF1_MS,
  DEMO_BREAK_MS,
  DEMO_HALF2_MS,
} from "./match-clock"
import type { MatchWithTeams } from "./types"

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0)

function match(overrides: Partial<MatchWithTeams>): MatchWithTeams {
  return {
    id: 1,
    external_id: null,
    stage: "GROUP",
    group_letter: "A",
    team1_id: null,
    team2_id: null,
    kickoff_at: new Date(NOW).toISOString(),
    status: "SCHEDULED",
    result1: null,
    result2: null,
    minute: null,
    is_demo: false,
    team1: null,
    team2: null,
    ...overrides,
  }
}

describe("matchClock — mecz demo", () => {
  const demo = (kickoffOffsetMs: number) =>
    match({ is_demo: true, kickoff_at: new Date(NOW - kickoffOffsetMs).toISOString() })

  it("przed kick-offem: scheduled z msToKickoff", () => {
    const c = matchClock(demo(-10_000), NOW) // kickoff 10s w przyszłości
    expect(c.phase).toBe("scheduled")
    if (c.phase === "scheduled") expect(c.msToKickoff).toBe(10_000)
  })

  it("1. połowa: live, minuta 1..45", () => {
    const c = matchClock(demo(1_000), NOW) // 1s po kick-offie
    expect(c.phase).toBe("live")
    if (c.phase === "live") {
      expect(c.minute).toBeGreaterThanOrEqual(1)
      expect(c.minute).toBeLessThanOrEqual(45)
    }
  })

  it("przerwa: halftime", () => {
    const c = matchClock(demo(DEMO_HALF1_MS + 1_000), NOW)
    expect(c.phase).toBe("halftime")
  })

  it("2. połowa: live, minuta 46..90", () => {
    const c = matchClock(demo(DEMO_HALF1_MS + DEMO_BREAK_MS + 1_000), NOW)
    expect(c.phase).toBe("live")
    if (c.phase === "live") {
      expect(c.minute).toBeGreaterThanOrEqual(46)
      expect(c.minute).toBeLessThanOrEqual(90)
    }
  })

  it("po meczu: finished", () => {
    const c = matchClock(demo(DEMO_HALF1_MS + DEMO_BREAK_MS + DEMO_HALF2_MS + 1_000), NOW)
    expect(c.phase).toBe("finished")
  })
})

describe("matchClock — prawdziwy mecz", () => {
  it("IN_PLAY → live z minutą z pola minute", () => {
    const c = matchClock(match({ status: "IN_PLAY", minute: 67 }), NOW)
    expect(c).toEqual({ phase: "live", minute: 67 })
  })

  it("PAUSED → halftime", () => {
    expect(matchClock(match({ status: "PAUSED" }), NOW).phase).toBe("halftime")
  })

  it("FINISHED → finished", () => {
    expect(matchClock(match({ status: "FINISHED" }), NOW).phase).toBe("finished")
  })

  it("SCHEDULED → scheduled", () => {
    const future = match({ status: "SCHEDULED", kickoff_at: new Date(NOW + 600_000).toISOString() })
    const c = matchClock(future, NOW)
    expect(c.phase).toBe("scheduled")
    if (c.phase === "scheduled") expect(c.msToKickoff).toBe(600_000)
  })
})
```

- [ ] **Step 2: Uruchom test — ma FAILOWAĆ**

Run: `npx vitest run lib/match-clock.test.ts`
Expected: błąd — `match-clock` nie istnieje.

- [ ] **Step 3: Utwórz `lib/match-clock.ts`:**

```ts
import type { MatchWithTeams } from "@/lib/types"

// Stałe faz meczu demo (czas rzeczywisty).
export const DEMO_KICKOFF_DELAY_MS = 15_000
export const DEMO_HALF1_MS = 15_000
export const DEMO_BREAK_MS = 5_000
export const DEMO_HALF2_MS = 15_000

export type MatchClock =
  | { phase: "scheduled"; msToKickoff: number }
  | { phase: "live"; minute: number }
  | { phase: "halftime" }
  | { phase: "finished" }

// Faza i minuta meczu. Mecz demo — liczone z kickoff_at + stałych faz.
// Prawdziwy mecz — z status + minute (synchronizowane z API).
export function matchClock(match: MatchWithTeams, now: number): MatchClock {
  const kickoff = new Date(match.kickoff_at).getTime()

  if (match.is_demo) {
    const elapsed = now - kickoff
    if (elapsed < 0) return { phase: "scheduled", msToKickoff: -elapsed }
    if (elapsed < DEMO_HALF1_MS) {
      return { phase: "live", minute: 1 + Math.floor((45 * elapsed) / DEMO_HALF1_MS) }
    }
    if (elapsed < DEMO_HALF1_MS + DEMO_BREAK_MS) return { phase: "halftime" }
    const half2End = DEMO_HALF1_MS + DEMO_BREAK_MS + DEMO_HALF2_MS
    if (elapsed < half2End) {
      const inHalf2 = elapsed - DEMO_HALF1_MS - DEMO_BREAK_MS
      return { phase: "live", minute: 46 + Math.floor((45 * inHalf2) / DEMO_HALF2_MS) }
    }
    return { phase: "finished" }
  }

  switch (match.status) {
    case "IN_PLAY":
      return { phase: "live", minute: match.minute ?? 0 }
    case "PAUSED":
      return { phase: "halftime" }
    case "FINISHED":
      return { phase: "finished" }
    default:
      // SCHEDULED, TIMED, POSTPONED, SUSPENDED, CANCELLED
      return { phase: "scheduled", msToKickoff: kickoff - now }
  }
}
```

- [ ] **Step 4: Uruchom test — ma PRZEJŚĆ**

Run: `npx vitest run lib/match-clock.test.ts`
Expected: wszystkie testy zielone.

- [ ] **Step 5: Weryfikacja** — `npm run build && npm run typecheck && npm run lint` — przechodzą.

- [ ] **Step 6: Commit**
```bash
git add lib/match-clock.ts lib/match-clock.test.ts
git commit -m "feat: lib/match-clock — faza i minuta meczu (demo + API)"
```

---

## Task 3: `settleDemoMatches` — oś czasu z połowami i przerwą

**Files:** Modify `app/(app)/demo-actions.ts`

- [ ] **Step 1: Zaktualizuj `app/(app)/demo-actions.ts`**

Read the file first. Wprowadź zmiany:

1. Dodaj import na górze: `import { DEMO_KICKOFF_DELAY_MS, DEMO_HALF1_MS, DEMO_BREAK_MS, DEMO_HALF2_MS } from "@/lib/match-clock"`.
2. Usuń istniejące lokalne stałe `DEMO_KICKOFF_DELAY_MS` i `DEMO_DURATION_MS` (zastępują je importowane).
3. W `createDemoMatch` — `kickoff_at` liczone z importowanego `DEMO_KICKOFF_DELAY_MS` (bez zmian w samej linii, jeśli używa tej nazwy; usuń tylko lokalną definicję stałej).
4. Zastąp pętlę w `settleDemoMatches` poniższą wersją (reszta funkcji — pobranie `matches`, klient admina, `revalidateViews` gdy `didUpdate` — bez zmian):

```ts
  const now = Date.now()
  let didUpdate = false

  const HALF1_END = DEMO_HALF1_MS
  const BREAK_END = DEMO_HALF1_MS + DEMO_BREAK_MS
  const MATCH_END = DEMO_HALF1_MS + DEMO_BREAK_MS + DEMO_HALF2_MS

  for (const m of matches) {
    const kickoffMs = new Date(m.kickoff_at as string).getTime()
    if (now < kickoffMs) continue // przed kick-offem — SCHEDULED, nic nie robimy
    const elapsed = now - kickoffMs

    // Docelowy status z osi czasu demo.
    let targetStatus: "IN_PLAY" | "PAUSED" | "FINISHED"
    if (elapsed < HALF1_END) targetStatus = "IN_PLAY"
    else if (elapsed < BREAK_END) targetStatus = "PAUSED"
    else if (elapsed < MATCH_END) targetStatus = "IN_PLAY"
    else targetStatus = "FINISHED"

    // Wynik ustawiamy raz, przy pierwszym wejściu w grę.
    let result1 = m.result1 as number | null
    let result2 = m.result2 as number | null
    if (result1 == null || result2 == null) {
      result1 = Math.floor(Math.random() * 5)
      result2 = Math.floor(Math.random() * 5)
    }

    if (m.status === targetStatus && m.result1 != null && m.result2 != null) {
      continue // nic się nie zmienia
    }

    const { error: updErr } = await admin
      .from("matches")
      .update({
        status: targetStatus,
        result1,
        result2,
        updated_at: new Date().toISOString(),
      })
      .eq("id", m.id)
    if (updErr) return { ok: false, error: updErr.message }
    didUpdate = true
  }

  if (didUpdate) revalidateViews()
  return { ok: true }
```

Uwaga: zapytanie pobierające mecze w `settleDemoMatches` ma już filtr `.eq("is_demo", true).neq("status", "FINISHED")` — zostaw je. Jeśli pętla różni się szczegółami (nazwy zmiennych) — dopasuj, zachowując semantykę powyżej.

- [ ] **Step 2: Weryfikacja** — `npm run build && npm run typecheck && npm run lint` — przechodzą.

- [ ] **Step 3: Commit**
```bash
git add "app/(app)/demo-actions.ts"
git commit -m "feat: oś czasu demo z połowami i przerwą (15/5/15 s)"
```

---

## Task 4: Karta meczu — odliczanie, kółko live, minuta, przerwa

**Files:** Modify `components/match-card.tsx`

Invoke the **frontend-design** skill for the visual work.

- [ ] **Step 1: Zaktualizuj `components/match-card.tsx`**

Read the file first. `MatchCard` dostaje już prop `now: number` i `match: MatchWithTeams`. Wprowadź:

1. Importy: `import { useEffect, useState } from "react"` (dołącz do istniejącego importu z `react`); `import { matchClock } from "@/lib/match-clock"`.

2. W komponencie, blisko góry, dodaj lokalny zegar 1 s dla meczu demo (fazy demo trwają 15 s — globalny tick 30 s jest za wolny):

```tsx
  // Mecz demo: własny tick 1 s (fazy demo są krótkie). Prawdziwy mecz:
  // prop `now` (tick 30 s). useState zainicjowane propsem — brak rozjazdu hydratacji.
  const [localNow, setLocalNow] = useState(now)
  useEffect(() => {
    if (!match.is_demo) return
    const id = setInterval(() => setLocalNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [match.is_demo])
  const effectiveNow = match.is_demo ? localNow : now
  const clock = matchClock(match, effectiveNow)
```

3. Helper-y (zdefiniuj w pliku, poza komponentem):

```tsx
function isToday(iso: string, now: number): boolean {
  const d = new Date(iso)
  const n = new Date(now)
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  )
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  if (totalSec < 60) return `za ${totalSec} s`
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 60) return `za ${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `za ${h} godz ${m} min` : `za ${h} godz`
}
```

4. W miejscu, gdzie karta renderuje obecnie badge statusu (`match.status === "IN_PLAY"` → „LIVE", `=== "FINISHED"` → „FT"), zastąp logikę renderem zależnym od `clock`:

- `clock.phase === "live"` → zielone pulsujące kółko + minuta:

```tsx
<span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-500">
  <span className="relative flex size-2.5">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
    <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
  </span>
  <span className="font-mono tabular-nums">{clock.minute}'</span>
</span>
```

- `clock.phase === "halftime"` → `<Badge variant="secondary">Przerwa</Badge>`
- `clock.phase === "finished"` → `<Badge variant="secondary">FT</Badge>`
- `clock.phase === "scheduled"` → jeśli `isToday(match.kickoff_at, effectiveNow)` i `clock.msToKickoff > 0`: `<span className="text-xs font-medium text-muted-foreground">{formatCountdown(clock.msToKickoff)}</span>`; w przeciwnym razie nie renderuj nic w slocie statusu (sama godzina kick-offu zostaje w nagłówku).

Zachowaj resztę karty bez zmian (godzina kick-offu, etykieta fazy, drużyny, `ScoreBlock`, `PredictionCell`, `Sheet` z typami znajomych). Jeśli `match.status`/`matchStarted` były używane gdzie indziej w karcie do innych celów — zostaw je; podmieniasz tylko slot znacznika statusu.

Wykończenie wizualne (rozmieszczenie kółka/minuty/odliczania w nagłówku karty) — wg skilla frontend-design, spójnie z motywem.

- [ ] **Step 2: Weryfikacja** — `npm run build && npm run typecheck && npm run lint` — przechodzą.

- [ ] **Step 3: Commit**
```bash
git add components/match-card.tsx
git commit -m "feat: karta meczu — odliczanie, kółko live, minuta, przerwa"
```

---

## Task 5: Siatka — kompaktowy znacznik live w komórce statusu

**Files:** Modify `components/predictions-matrix.tsx`

- [ ] **Step 1: Zaktualizuj `components/predictions-matrix.tsx`**

Read the file first. Macierz ma już zmienną `now` (stan komponentu) i renderuje per-mecz znacznik statusu — obecnie `match.status === "IN_PLAY"` → badge „LIVE", `=== "FINISHED"` → „FT".

1. Import: `import { matchClock } from "@/lib/match-clock"` (dołącz do istniejących importów z `@/lib/...`).
2. W miejscu renderowania znacznika statusu meczu policz `const clock = matchClock(match, now)` i renderuj:
   - `clock.phase === "live"` → kompaktowo: zielone pulsujące kółko + `{clock.minute}'`:
     ```tsx
     <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-500">
       <span className="relative flex size-1.5">
         <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
         <span className="relative inline-flex size-1.5 rounded-full bg-green-500" />
       </span>
       <span className="font-mono tabular-nums">{clock.minute}'</span>
     </span>
     ```
   - `clock.phase === "halftime"` → `<span className="text-[10px] font-semibold text-muted-foreground">Przerwa</span>`
   - `clock.phase === "finished"` → `<span className="text-[10px] text-muted-foreground">FT</span>` (zachowaj obecny styl „FT", jeśli inny)
   - `clock.phase === "scheduled"` → nic (godzina kick-offu zostaje).

Nie dodawaj odliczania w Siatce. `now` w macierzy odświeża się co 30 s — dla meczu demo minuta w Siatce będzie zgrubna; to akceptowalne (demo obserwuje się na karcie meczu).

- [ ] **Step 2: Weryfikacja** — `npm run build && npm run typecheck && npm run lint` — przechodzą.

- [ ] **Step 3: Commit**
```bash
git add components/predictions-matrix.tsx
git commit -m "feat: Siatka — kompaktowy znacznik live/przerwa/FT"
```

---

## Task 6: Tekst panelu demo + weryfikacja końcowa

**Files:** Modify `components/demo-panel.tsx`

- [ ] **Step 1: Zaktualizuj tekst w `components/demo-panel.tsx`**

Read the file. Zaktualizuj akapit opisu, by odpowiadał nowej osi czasu — kick-off 15 s po kliknięciu, 1. połowa 15 s, przerwa 5 s, 2. połowa 15 s. Przykładowy tekst:

```tsx
        Tworzy mecz testowy: kick-off 15 s po kliknięciu, dwie połowy po
        15 s z 5-sekundową przerwą. Wpisz na niego typ poniżej i kliknij
        „Zatwierdź typy” — punkty naliczają się tylko dla zatwierdzonych
        typów. Po kick-offie wiersz typu się zablokuje; obserwuj odliczanie,
        minutę meczu, przerwę i drugą połowę.
```

Zaktualizuj też toast w `onCreate` (jeśli mówi o „za 3 minuty") na „za 15 s": `toast.success("Mecz demo dodany — kick-off za 15 s.")`.

- [ ] **Step 2: Weryfikacja końcowa**

Run: `npm run build && npm run typecheck && npm run lint && npm run test`
Expected: wszystkie przechodzą; `lib/match-clock.test.ts` i pozostałe testy zielone.

- [ ] **Step 3: Commit**
```bash
git add components/demo-panel.tsx
git commit -m "feat: tekst panelu demo — nowa oś czasu 15/15/5/15 s"
```

- [ ] **Step 4: Nota o migracji**

Migracja `supabase/migrations/0005_match_minute.sql` musi zostać wgrana do Supabase ręcznie (Dashboard → SQL Editor). Bez tego synchronizacja z API i select będą odwoływać się do nieistniejącej kolumny `minute`. Odnotuj to w raporcie końcowym.

---

## Self-review — pokrycie spec

- Kolumna `minute` + typ + select + sync → Task 1 ✓
- `lib/match-clock.ts` (`matchClock`, stałe demo, fazy) + test → Task 2 ✓
- `settleDemoMatches` — oś czasu z połowami i przerwą → Task 3 ✓
- Karta meczu: odliczanie / kółko live + minuta / przerwa; tick 1 s dla demo, prop `now` dla reszty; `useState(now)` bez rozjazdu hydratacji → Task 4 ✓
- Siatka: kompaktowy znacznik live/przerwa/FT → Task 5 ✓
- Tekst panelu demo → Task 6 ✓
- Bez zmian: blokada, scoring, widoki punktów, RLS — żadne zadanie ich nie rusza ✓
- Kryteria ukończenia (build/typecheck/lint/test + nota o migracji) → Task 6 ✓
