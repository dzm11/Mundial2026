# Strona Stats — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać podstronę `/stats` ze statystykami graczy, z wyróżnionym na górze bilansem „ile wygrałbyś/straciłbyś, stawiając 100 zł na dokładny wynik każdego meczu", liczonym z realnych kursów correct-score z OddsPortal.

**Architecture:** Czysta logika statystyk w `lib/stats.ts` (testowana Vitestem, reużywa `lib/scoring.ts`). Kursy w nowej tabeli Supabase `match_odds`, ładowane przez `lib/data.ts`. Strona `/stats` (Server Component) liczy statystyki i renderuje w stylu `/ranking`. Kursy zbiera lokalny skrypt Playwright (`npm run scrape:odds`) scrapujący OddsPortal i zapisujący do Supabase.

**Tech Stack:** Next.js 16 (App Router, React Server Components), TypeScript, Supabase (Postgres + SSR client), shadcn/ui + Tailwind, Vitest, Playwright (już w devDependencies), tsx.

## Global Constraints

- Język UI: **polski**. Terminy techniczne mogą zostać po angielsku w kodzie.
- Stawka zakładu: **100 zł** na mecz (stała `STAKE = 100`).
- Wzór bilansu na trafionym dokładnym wyniku: **netto** = `+100 × (kurs − 1)`; na pudle/zwykłym = `−100`. Liczone tylko dla meczów `status === 'FINISHED'` z `result1`/`result2` i tylko tam, gdzie gracz **ma** typ na dany mecz oraz **istnieje kurs** padłego wyniku.
- Klucz scoreline: `"{result1}:{result2}"` z perspektywy **team1:team2** naszej tabeli `matches`. Specjalny klucz `"OTHER"` = kurs „Inny wynik".
- Klasyfikacja trafień (3/1/0): **reużyj `calculatePoints` z `lib/scoring.ts`** — nie duplikuj logiki.
- Skrypty Node uruchamiane przez `tsx --env-file=.env.local`; klient Supabase tworzony jak w `scripts/seed.ts` (service role, `auth: { autoRefreshToken: false, persistSession: false }`).
- Komendy: testy `npm run test`; typy `npm run typecheck`; build `npm run build`.
- Każdy skrypt do bazy musi być **idempotentny**.

---

## Pliki — struktura

- **Create** `supabase/migrations/0002_match_odds.sql` — tabela `match_odds` + RLS.
- **Modify** `lib/types.ts` — typ `MatchOddsRow`.
- **Modify** `lib/data.ts` — `getMatchOdds()` zwraca `OddsByMatch`.
- **Create** `lib/stats.ts` — czysta logika statystyk (bilans + pozostałe).
- **Create** `lib/stats.test.ts` — testy Vitest dla `lib/stats.ts`.
- **Modify** `lib/utils.ts` — helper `formatPln`.
- **Create** `app/(app)/stats/page.tsx` — strona `/stats` (Server Component).
- **Create** `components/money-board.tsx` — ranking bilansu (hero).
- **Create** `components/stat-highlights.tsx` — karty z liderami pozostałych statystyk.
- **Modify** `app/(app)/layout.tsx` — link „Stats" w górnym navbarze.
- **Modify** `components/bottom-nav.tsx` — zakładka „Stats" w mobilnym tab barze.
- **Create** `scripts/scrape-odds/parsing.ts` — czyste helpery scrapera (scoreline, orientacja, nazwy drużyn).
- **Create** `scripts/scrape-odds/parsing.test.ts` — testy helperów.
- **Create** `scripts/scrape-odds/index.ts` — skrypt Playwright (I/O).
- **Modify** `package.json` — skrypt `scrape:odds`.

---

## Task 1: Migracja DB — tabela `match_odds`

**Files:**
- Create: `supabase/migrations/0002_match_odds.sql`

**Interfaces:**
- Produces: tabela `public.match_odds(match_id int, scoreline text, odds numeric, source text, captured_at timestamptz)`, PK `(match_id, scoreline)`, RLS read dla `authenticated`.

- [ ] **Step 1: Napisz migrację**

Create `supabase/migrations/0002_match_odds.sql`:

```sql
-- Kursy correct-score (dokładny wynik) per mecz, źródło: OddsPortal (scraper).

create table public.match_odds (
  match_id    int  not null references public.matches(id) on delete cascade,
  scoreline   text not null,                      -- "team1:team2" np. "1:0"; "OTHER" = inny wynik
  odds        numeric(8,2) not null check (odds > 0),
  source      text not null default 'oddsportal',
  captured_at timestamptz not null default now(),
  primary key (match_id, scoreline)
);

create index match_odds_match_idx on public.match_odds (match_id);

alter table public.match_odds enable row level security;

-- czyta każdy zalogowany; zapis tylko service-role (RLS bypass) — brak policy write
create policy "match_odds read" on public.match_odds
  for select to authenticated using (true);
```

- [ ] **Step 2: Zastosuj migrację**

Jeśli jest Supabase CLI: `supabase db push`.
W przeciwnym razie wklej treść pliku do SQL Editora w panelu Supabase i uruchom.

Expected: tabela utworzona bez błędów.

- [ ] **Step 3: Zweryfikuj**

W SQL Editorze / psql:

```sql
select count(*) from public.match_odds;
```

Expected: `0` (pusta tabela, brak błędu).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_match_odds.sql
git commit -m "feat(db): tabela match_odds na kursy correct-score"
```

---

## Task 2: Logika statystyk — `lib/stats.ts` (TDD)

**Files:**
- Create: `lib/stats.ts`
- Test: `lib/stats.test.ts`

**Interfaces:**
- Consumes: `calculatePoints`, `MatchOutcome`, `Prediction` z `@/lib/scoring`.
- Produces:
  - `STAKE = 100`
  - `type OddsByMatch = Map<number, Record<string, number>>`
  - `type MatchLite = { id: number; status: string; result1: number | null; result2: number | null }`
  - `type PredictionLite = { user_id: string; match_id: number; pred1: number; pred2: number }`
  - `type PlayerStats = { userId: string; moneyBalance: number; evaluatedBets: number; exactHits: number; outcomeHits: number; scored: number; accuracy: number; bestWin: { matchId: number; odds: number; amount: number } | null }`
  - `scorelineKey(r1: number, r2: number): string`
  - `oddsForResult(odds: Record<string, number> | undefined, r1: number, r2: number): number | null`
  - `computePlayerStats(userId: string, predictions: PredictionLite[], matchesById: Map<number, MatchLite>, odds: OddsByMatch): PlayerStats`
  - `computeAllStats(userIds: string[], predictions: PredictionLite[], matches: MatchLite[], odds: OddsByMatch): PlayerStats[]`
  - `oddsCoverage(matches: MatchLite[], odds: OddsByMatch): { finished: number; withOdds: number }`

- [ ] **Step 1: Napisz testy (failing)**

Create `lib/stats.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  STAKE,
  scorelineKey,
  oddsForResult,
  computePlayerStats,
  computeAllStats,
  oddsCoverage,
  type MatchLite,
  type PredictionLite,
  type OddsByMatch,
} from "./stats"

const finished = (id: number, r1: number, r2: number): MatchLite => ({
  id,
  status: "FINISHED",
  result1: r1,
  result2: r2,
})

const pred = (user: string, match: number, p1: number, p2: number): PredictionLite => ({
  user_id: user,
  match_id: match,
  pred1: p1,
  pred2: p2,
})

describe("scorelineKey / oddsForResult", () => {
  it("buduje klucz wyniku", () => {
    expect(scorelineKey(1, 0)).toBe("1:0")
  })

  it("zwraca kurs dokładnego wyniku", () => {
    expect(oddsForResult({ "1:0": 7.5 }, 1, 0)).toBe(7.5)
  })

  it("spada na OTHER, gdy brak dokładnego wyniku", () => {
    expect(oddsForResult({ "1:0": 7.5, OTHER: 60 }, 4, 3)).toBe(60)
  })

  it("zwraca null, gdy nic nie pasuje", () => {
    expect(oddsForResult({ "1:0": 7.5 }, 4, 3)).toBeNull()
    expect(oddsForResult(undefined, 1, 0)).toBeNull()
  })
})

describe("computePlayerStats — bilans", () => {
  const matches = [finished(1, 1, 0), finished(2, 2, 1), finished(3, 0, 0)]
  const matchesById = new Map(matches.map((m) => [m.id, m]))

  it("trafiony dokładny wynik daje +100*(kurs-1) netto", () => {
    const odds: OddsByMatch = new Map([[1, { "1:0": 7.5 }]])
    const s = computePlayerStats("u", [pred("u", 1, 1, 0)], matchesById, odds)
    expect(s.moneyBalance).toBeCloseTo(650)
    expect(s.exactHits).toBe(1)
    expect(s.evaluatedBets).toBe(1)
    expect(s.bestWin).toEqual({ matchId: 1, odds: 7.5, amount: 650 })
  })

  it("pudło daje -100", () => {
    const odds: OddsByMatch = new Map([[1, { "1:0": 7.5, "2:1": 9 }]])
    const s = computePlayerStats("u", [pred("u", 1, 2, 1)], matchesById, odds)
    expect(s.moneyBalance).toBeCloseTo(-100)
    expect(s.exactHits).toBe(0)
    expect(s.evaluatedBets).toBe(1)
    expect(s.bestWin).toBeNull()
  })

  it("zwykłe trafienie (1 pkt) liczy się jako -100 w kasie, ale jako outcomeHit", () => {
    // mecz 2 = 2:1, typ 3:0 -> ten sam znak (gosp. wygrywa) = 1 pkt, ale nie dokładny
    const odds: OddsByMatch = new Map([[2, { "2:1": 9 }]])
    const s = computePlayerStats("u", [pred("u", 2, 3, 0)], matchesById, odds)
    expect(s.outcomeHits).toBe(1)
    expect(s.exactHits).toBe(0)
    expect(s.moneyBalance).toBeCloseTo(-100)
  })

  it("używa kursu OTHER dla rzadkiego trafionego wyniku", () => {
    const m = new Map([[9, finished(9, 4, 3)]])
    const odds: OddsByMatch = new Map([[9, { OTHER: 60 }]])
    const s = computePlayerStats("u", [pred("u", 9, 4, 3)], m, odds)
    expect(s.moneyBalance).toBeCloseTo(5900)
  })

  it("mecz bez kursu nie wchodzi do bilansu, ale liczy się do trafień/scored", () => {
    const odds: OddsByMatch = new Map() // brak kursów
    const s = computePlayerStats("u", [pred("u", 1, 1, 0)], matchesById, odds)
    expect(s.moneyBalance).toBe(0)
    expect(s.evaluatedBets).toBe(0)
    expect(s.exactHits).toBe(1)
    expect(s.scored).toBe(1)
  })

  it("ignoruje mecze bez typu gracza i mecze niezakończone", () => {
    const m = new Map<number, MatchLite>([
      [1, finished(1, 1, 0)],
      [5, { id: 5, status: "IN_PLAY", result1: 1, result2: 1 }],
    ])
    const odds: OddsByMatch = new Map([[1, { "1:0": 7.5 }]])
    // typ tylko na mecz 5 (niezakończony) -> nic nie liczone
    const s = computePlayerStats("u", [pred("u", 5, 1, 1)], m, odds)
    expect(s.scored).toBe(0)
    expect(s.moneyBalance).toBe(0)
  })

  it("accuracy = (dokładne+zwykłe)/scored", () => {
    const odds: OddsByMatch = new Map()
    const preds = [pred("u", 1, 1, 0), pred("u", 2, 5, 0), pred("u", 3, 1, 1)]
    // m1 1:0 typ 1:0 -> dokładny; m2 2:1 typ 5:0 -> zwykły; m3 0:0 typ 1:1 -> pudło
    const s = computePlayerStats("u", preds, matchesById, odds)
    expect(s.scored).toBe(3)
    expect(s.exactHits).toBe(1)
    expect(s.outcomeHits).toBe(1)
    expect(s.accuracy).toBeCloseTo(2 / 3)
  })
})

describe("computeAllStats", () => {
  it("liczy statystyki dla wielu graczy", () => {
    const matches = [finished(1, 1, 0)]
    const odds: OddsByMatch = new Map([[1, { "1:0": 7.5 }]])
    const preds = [pred("a", 1, 1, 0), pred("b", 1, 0, 1)]
    const all = computeAllStats(["a", "b"], preds, matches, odds)
    expect(all.find((s) => s.userId === "a")!.moneyBalance).toBeCloseTo(650)
    expect(all.find((s) => s.userId === "b")!.moneyBalance).toBeCloseTo(-100)
  })
})

describe("oddsCoverage", () => {
  it("liczy zakończone mecze i te z kursem padłego wyniku", () => {
    const matches = [finished(1, 1, 0), finished(2, 2, 2), { id: 3, status: "SCHEDULED", result1: null, result2: null }]
    const odds: OddsByMatch = new Map([[1, { "1:0": 7.5 }]]) // mecz 2 bez kursu
    expect(oddsCoverage(matches, odds)).toEqual({ finished: 2, withOdds: 1 })
  })
})

describe("STAKE", () => {
  it("wynosi 100", () => {
    expect(STAKE).toBe(100)
  })
})
```

- [ ] **Step 2: Uruchom testy — mają nie przejść**

Run: `npm run test`
Expected: FAIL — `Cannot find module './stats'` / brak eksportów.

- [ ] **Step 3: Zaimplementuj `lib/stats.ts`**

Create `lib/stats.ts`:

```ts
import { calculatePoints, type MatchOutcome, type Prediction } from "@/lib/scoring"

export const STAKE = 100

// match_id -> { "1:0": 7.5, ..., "OTHER": 60 }
export type OddsByMatch = Map<number, Record<string, number>>

export type MatchLite = {
  id: number
  status: string
  result1: number | null
  result2: number | null
}

export type PredictionLite = {
  user_id: string
  match_id: number
  pred1: number
  pred2: number
}

export type PlayerStats = {
  userId: string
  moneyBalance: number
  evaluatedBets: number
  exactHits: number
  outcomeHits: number
  scored: number
  accuracy: number
  bestWin: { matchId: number; odds: number; amount: number } | null
}

export function scorelineKey(r1: number, r2: number): string {
  return `${r1}:${r2}`
}

export function oddsForResult(
  odds: Record<string, number> | undefined,
  r1: number,
  r2: number,
): number | null {
  if (!odds) return null
  const exact = odds[scorelineKey(r1, r2)]
  if (typeof exact === "number") return exact
  const other = odds["OTHER"]
  return typeof other === "number" ? other : null
}

function isFinished(m: MatchLite): boolean {
  return m.status === "FINISHED" && m.result1 != null && m.result2 != null
}

export function computePlayerStats(
  userId: string,
  predictions: PredictionLite[],
  matchesById: Map<number, MatchLite>,
  odds: OddsByMatch,
): PlayerStats {
  let moneyBalance = 0
  let evaluatedBets = 0
  let exactHits = 0
  let outcomeHits = 0
  let scored = 0
  let bestWin: PlayerStats["bestWin"] = null

  for (const p of predictions) {
    if (p.user_id !== userId) continue
    const m = matchesById.get(p.match_id)
    if (!m || !isFinished(m)) continue

    const pts = calculatePoints(m as MatchOutcome, p as Prediction)
    scored++
    if (pts === 3) exactHits++
    else if (pts === 1) outcomeHits++

    const kurs = oddsForResult(odds.get(p.match_id), m.result1!, m.result2!)
    if (kurs == null) continue // brak kursu — poza bilansem pieniężnym

    evaluatedBets++
    if (pts === 3) {
      const win = STAKE * (kurs - 1)
      moneyBalance += win
      if (!bestWin || win > bestWin.amount) {
        bestWin = { matchId: p.match_id, odds: kurs, amount: win }
      }
    } else {
      moneyBalance -= STAKE
    }
  }

  const accuracy = scored > 0 ? (exactHits + outcomeHits) / scored : 0
  return { userId, moneyBalance, evaluatedBets, exactHits, outcomeHits, scored, accuracy, bestWin }
}

export function computeAllStats(
  userIds: string[],
  predictions: PredictionLite[],
  matches: MatchLite[],
  odds: OddsByMatch,
): PlayerStats[] {
  const matchesById = new Map(matches.map((m) => [m.id, m]))
  return userIds.map((id) => computePlayerStats(id, predictions, matchesById, odds))
}

export function oddsCoverage(
  matches: MatchLite[],
  odds: OddsByMatch,
): { finished: number; withOdds: number } {
  let finished = 0
  let withOdds = 0
  for (const m of matches) {
    if (!isFinished(m)) continue
    finished++
    if (oddsForResult(odds.get(m.id), m.result1!, m.result2!) != null) withOdds++
  }
  return { finished, withOdds }
}
```

- [ ] **Step 4: Uruchom testy — mają przejść**

Run: `npm run test`
Expected: PASS (wszystkie testy `lib/stats.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/stats.ts lib/stats.test.ts
git commit -m "feat(stats): logika bilansu 100zł + statystyki graczy (TDD)"
```

---

## Task 3: Dostęp do danych — `getMatchOdds()` + typ + helper formatPln

**Files:**
- Modify: `lib/types.ts` (dodanie typu)
- Modify: `lib/data.ts` (dodanie funkcji)
- Modify: `lib/utils.ts` (dodanie `formatPln`)

**Interfaces:**
- Consumes: `OddsByMatch` z `@/lib/stats`; `createClient` z `@/lib/supabase/server`.
- Produces:
  - `type MatchOddsRow = { match_id: number; scoreline: string; odds: number }` (w `lib/types.ts`)
  - `getMatchOdds(): Promise<OddsByMatch>` (w `lib/data.ts`)
  - `formatPln(amount: number): string` (w `lib/utils.ts`) — np. `+650 zł`, `−100 zł`, `0 zł`

- [ ] **Step 1: Dodaj typ w `lib/types.ts`**

Dopisz na końcu `lib/types.ts`:

```ts
export type MatchOddsRow = {
  match_id: number
  scoreline: string
  odds: number
}
```

- [ ] **Step 2: Dodaj `getMatchOdds` w `lib/data.ts`**

Dopisz import na górze (rozszerz istniejący import z `@/lib/types` o `MatchOddsRow`) i dodaj nowy import:

```ts
import type { OddsByMatch } from "@/lib/stats"
```

Dopisz funkcję na końcu `lib/data.ts`:

```ts
export async function getMatchOdds(): Promise<OddsByMatch> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("match_odds")
    .select("match_id, scoreline, odds")
  const map: OddsByMatch = new Map()
  for (const row of (data ?? []) as MatchOddsRow[]) {
    const rec = map.get(row.match_id) ?? {}
    rec[row.scoreline] = Number(row.odds)
    map.set(row.match_id, rec)
  }
  return map
}
```

(Upewnij się, że `MatchOddsRow` jest w imporcie z `@/lib/types`.)

- [ ] **Step 3: Dodaj `formatPln` w `lib/utils.ts`**

Najpierw zobacz istniejące eksporty: `Read lib/utils.ts`. Dopisz na końcu:

```ts
// Formatuje kwotę w zł ze znakiem: +650 zł / −100 zł / 0 zł
export function formatPln(amount: number): string {
  const rounded = Math.round(amount)
  if (rounded === 0) return "0 zł"
  const sign = rounded > 0 ? "+" : "−"
  return `${sign}${Math.abs(rounded)} zł`
}
```

- [ ] **Step 4: Sprawdź typy**

Run: `npm run typecheck`
Expected: brak błędów.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/data.ts lib/utils.ts
git commit -m "feat(stats): dostęp do match_odds + formatPln"
```

---

## Task 4: Strona `/stats` + komponenty

**Files:**
- Create: `app/(app)/stats/page.tsx`
- Create: `components/money-board.tsx`
- Create: `components/stat-highlights.tsx`

**Interfaces:**
- Consumes: `getLeaderboard`, `getPredictions`, `getMatches`, `getMatchOdds` z `@/lib/data`; `computeAllStats`, `oddsCoverage`, `type PlayerStats` z `@/lib/stats`; `formatPln`, `displayName`, `getInitials`, `cn` z `@/lib/utils`; `Player` z `@/lib/types`.
- Produces: trasa `/stats`. Komponenty `MoneyBoard` i `StatHighlights`.

- [ ] **Step 1: Komponent `MoneyBoard`**

Create `components/money-board.tsx`:

```tsx
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
                <Avatar className="size-8 shrink-0">
                  {player.avatar_url && <AvatarImage src={player.avatar_url} alt={player.username} />}
                  <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
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
```

- [ ] **Step 2: Komponent `StatHighlights`**

Create `components/stat-highlights.tsx`:

```tsx
import type { Player } from "@/lib/types"
import type { PlayerStats } from "@/lib/stats"
import { displayName, formatPln } from "@/lib/utils"

type Row = { player: Player; stats: PlayerStats }

type Highlight = {
  label: string
  winner: Row | undefined
  value: (r: Row) => string
}

function leaderBy(rows: Row[], key: (s: PlayerStats) => number): Row | undefined {
  if (rows.length === 0) return undefined
  return [...rows].sort((a, b) => key(b.stats) - key(a.stats))[0]
}

export function StatHighlights({ rows }: { rows: Row[] }) {
  const highlights: Highlight[] = [
    {
      label: "Najwięcej dokładnych wyników",
      winner: leaderBy(rows, (s) => s.exactHits),
      value: (r) => `${r.stats.exactHits}`,
    },
    {
      label: "Najwięcej trafionych zwykłych wyników",
      winner: leaderBy(rows, (s) => s.outcomeHits),
      value: (r) => `${r.stats.outcomeHits}`,
    },
    {
      label: "Najwyższa skuteczność",
      winner: leaderBy(rows, (s) => s.accuracy),
      value: (r) => `${Math.round(r.stats.accuracy * 100)}%`,
    },
    {
      label: "Największa pojedyncza wygrana",
      winner: leaderBy(rows, (s) => s.bestWin?.amount ?? -Infinity),
      value: (r) => (r.stats.bestWin ? formatPln(r.stats.bestWin.amount) : "—"),
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {highlights.map((h) => (
        <div key={h.label} className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{h.label}</p>
          {h.winner ? (
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-card-foreground">
                {displayName(h.winner.player)}
              </span>
              <span className="font-mono font-bold tabular-nums text-lg text-primary">
                {h.value(h.winner)}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">—</p>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Strona `/stats`**

Create `app/(app)/stats/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server"
import { getLeaderboard, getPredictions, getMatches, getMatchOdds } from "@/lib/data"
import { computeAllStats, oddsCoverage, type MatchLite } from "@/lib/stats"
import { MoneyBoard } from "@/components/money-board"
import { StatHighlights } from "@/components/stat-highlights"

export const dynamic = "force-dynamic"

export default async function StatsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [players, predictions, matches, odds] = await Promise.all([
    getLeaderboard(),
    getPredictions(),
    getMatches(),
    getMatchOdds(),
  ])

  const matchLite: MatchLite[] = matches.map((m) => ({
    id: m.id,
    status: m.status,
    result1: m.result1,
    result2: m.result2,
  }))

  const stats = computeAllStats(
    players.map((p) => p.id),
    predictions,
    matchLite,
    odds,
  )
  const statsByUser = new Map(stats.map((s) => [s.userId, s]))

  const rows = players
    .map((player) => ({ player, stats: statsByUser.get(player.id)! }))
    .sort((a, b) => b.stats.moneyBalance - a.stats.moneyBalance)

  const coverage = oddsCoverage(matchLite, odds)
  const missing = coverage.finished - coverage.withOdds

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Stats</h1>
        <p className="text-muted-foreground text-sm">
          Bilans, gdyby każdy stawiał 100 zł na dokładny wynik swojego typu w każdym meczu.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">💰 Bilans 100 zł / mecz</h2>
        <MoneyBoard rows={rows} currentUserId={user.id} />
        {missing > 0 && (
          <p className="text-muted-foreground text-xs">
            Bilans liczony z {coverage.withOdds} z {coverage.finished} rozegranych meczów
            (brak kursów dla {missing}).
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Pozostałe statystyki</h2>
        <StatHighlights rows={rows} />
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Sprawdź typy i build**

Run: `npm run typecheck`
Expected: brak błędów.

Run: `npm run build`
Expected: build przechodzi; trasa `/stats` na liście.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/stats/page.tsx" components/money-board.tsx components/stat-highlights.tsx
git commit -m "feat(stats): strona /stats — bilans 100zł + highlighty"
```

---

## Task 5: Nawigacja — link „Stats"

**Files:**
- Modify: `app/(app)/layout.tsx` (górny navbar, ok. linie 47-68)
- Modify: `components/bottom-nav.tsx` (mobilny tab bar)

**Interfaces:**
- Consumes: trasa `/stats` z Task 4.

- [ ] **Step 1: Dodaj link w górnym navbarze**

W `app/(app)/layout.tsx`, w bloku `<nav className="hidden lg:flex ...">`, dodaj po linku „Siatka" (przed „Regulamin"):

```tsx
            <Link href="/stats">
              <Button variant="ghost" size="sm">
                Stats
              </Button>
            </Link>
```

- [ ] **Step 2: Dodaj zakładkę w `bottom-nav.tsx`**

W `components/bottom-nav.tsx`:
1. Rozszerz import ikon o `BarChart3`:

```tsx
import { CircleDot, Trophy, Grid3x3, BarChart3, User } from "lucide-react"
```

2. Dodaj wpis do `TABS` (między „Siatka" a „Profil"):

```tsx
  { href: "/stats", label: "Stats", icon: BarChart3 },
```

3. Zmień siatkę z 4 na 5 kolumn — w `<ul>` zamień `grid-cols-4` na `grid-cols-5`:

```tsx
      <ul className="grid grid-cols-5">
```

- [ ] **Step 3: Sprawdź typy i build**

Run: `npm run typecheck && npm run build`
Expected: brak błędów.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/layout.tsx" components/bottom-nav.tsx
git commit -m "feat(stats): link Stats w nawigacji (desktop + mobile)"
```

---

## Task 6: Scraper OddsPortal — helpery (TDD)

**Files:**
- Create: `scripts/scrape-odds/parsing.ts`
- Test: `scripts/scrape-odds/parsing.test.ts`

**Interfaces:**
- Produces:
  - `normalizeTeamName(name: string): string`
  - `TEAM_ALIASES: Record<string, string>` (znormalizowana nazwa OddsPortal → znormalizowana nazwa z naszej bazy)
  - `teamNameMatches(dbName: string, scrapedName: string): boolean`
  - `flipScoreline(scoreline: string): string` (`"2:1"` → `"1:2"`; `"OTHER"` → `"OTHER"`)
  - `parseScore(text: string): { r1: number; r2: number } | null` (`"2:1"`/`"2 - 1"` → `{r1:2,r2:1}`)

- [ ] **Step 1: Napisz testy (failing)**

Create `scripts/scrape-odds/parsing.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  normalizeTeamName,
  teamNameMatches,
  flipScoreline,
  parseScore,
} from "./parsing"

describe("normalizeTeamName", () => {
  it("lowercase + bez diakrytyków + trim", () => {
    expect(normalizeTeamName("  Korea Płd. ")).toBe("korea pld.")
    expect(normalizeTeamName("Côte d'Ivoire")).toBe("cote d'ivoire")
  })
})

describe("teamNameMatches", () => {
  it("dopasowuje identyczne po normalizacji", () => {
    expect(teamNameMatches("USA", "usa")).toBe(true)
  })
  it("dopasowuje przez alias", () => {
    // alias: "south korea" (oddsportal) -> "korea republic" (nasza baza)
    expect(teamNameMatches("Korea Republic", "South Korea")).toBe(true)
  })
  it("odrzuca różne drużyny", () => {
    expect(teamNameMatches("Brazil", "Argentina")).toBe(false)
  })
})

describe("flipScoreline", () => {
  it("odwraca wynik", () => {
    expect(flipScoreline("2:1")).toBe("1:2")
  })
  it("nie rusza OTHER", () => {
    expect(flipScoreline("OTHER")).toBe("OTHER")
  })
})

describe("parseScore", () => {
  it("parsuje '2:1' i '2 - 1'", () => {
    expect(parseScore("2:1")).toEqual({ r1: 2, r2: 1 })
    expect(parseScore("2 - 1")).toEqual({ r1: 2, r2: 1 })
  })
  it("zwraca null dla śmieci", () => {
    expect(parseScore("inny wynik")).toBeNull()
  })
})
```

- [ ] **Step 2: Uruchom testy — mają nie przejść**

Run: `npm run test`
Expected: FAIL — brak modułu `./parsing`.

- [ ] **Step 3: Zaimplementuj `parsing.ts`**

Create `scripts/scrape-odds/parsing.ts`:

```ts
// Czyste helpery scrapera OddsPortal — bez I/O, testowalne.

export function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // usuń diakrytyki
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

// Klucz = znormalizowana nazwa z OddsPortal; wartość = znormalizowana nazwa z naszej bazy.
// Uzupełniać podczas realnego uruchomienia, gdy nazwy się nie zgadzają.
export const TEAM_ALIASES: Record<string, string> = {
  "south korea": "korea republic",
  "usa": "united states",
  "ir iran": "iran",
}

export function teamNameMatches(dbName: string, scrapedName: string): boolean {
  const db = normalizeTeamName(dbName)
  const scraped = normalizeTeamName(scrapedName)
  if (db === scraped) return true
  const aliased = TEAM_ALIASES[scraped]
  return aliased === db
}

export function flipScoreline(scoreline: string): string {
  if (scoreline === "OTHER") return "OTHER"
  const [a, b] = scoreline.split(":")
  return `${b}:${a}`
}

export function parseScore(text: string): { r1: number; r2: number } | null {
  const m = text.match(/(\d+)\s*[:\-]\s*(\d+)/)
  if (!m) return null
  return { r1: Number(m[1]), r2: Number(m[2]) }
}
```

- [ ] **Step 4: Uruchom testy — mają przejść**

Run: `npm run test`
Expected: PASS.

> Uwaga: jeśli `teamNameMatches("Korea Republic", "South Korea")` nie przejdzie, sprawdź, czy nazwa w naszej tabeli `teams` to dokładnie „Korea Republic"; dostosuj wartość aliasu do realnej nazwy z bazy (patrz `lib/wc2026-teams.ts`).

- [ ] **Step 5: Commit**

```bash
git add scripts/scrape-odds/parsing.ts scripts/scrape-odds/parsing.test.ts
git commit -m "feat(scraper): helpery parsowania kursów OddsPortal (TDD)"
```

---

## Task 7: Scraper OddsPortal — skrypt Playwright (I/O)

**Files:**
- Create: `scripts/scrape-odds/index.ts`
- Modify: `package.json` (skrypt `scrape:odds`)

**Interfaces:**
- Consumes: `normalizeTeamName`, `teamNameMatches`, `flipScoreline`, `parseScore` z `./parsing`; `chromium` z `playwright`; `createClient` z `@supabase/supabase-js`.
- Produces: skrypt `npm run scrape:odds`, który zapisuje wiersze do `match_odds`.

> Ten task ma I/O zależne od żywej strony OddsPortal, więc selektory DOM **trzeba potwierdzić na żywo** (krok 2). Helpery z Taska 6 są już przetestowane jednostkowo.

- [ ] **Step 1: Szkielet skryptu**

Create `scripts/scrape-odds/index.ts`:

```ts
/**
 * Scraper kursów correct-score z OddsPortal -> Supabase (tabela match_odds).
 *
 * Uruchomienie: npm run scrape:odds
 * Wymaga w .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Wymaga przeglądarki Playwright: npx playwright install chromium
 *
 * Idempotentny: upsert po (match_id, scoreline).
 */
import { chromium, type Page } from "playwright"
import { createClient } from "@supabase/supabase-js"
import { teamNameMatches, flipScoreline, parseScore } from "./parsing"

const RESULTS_URL =
  "https://www.oddsportal.com/football/world/world-championship-2026/results/"

type DbMatch = {
  id: number
  kickoff_at: string
  result1: number | null
  result2: number | null
  status: string
  team1: { name: string } | null
  team2: { name: string } | null
}

// Mapa kursów z perspektywy GOSPODARZA OddsPortal: { "1:0": 7.5, ..., "OTHER": 60 }
type ScrapedOdds = { home: string; away: string; scores: Record<string, number> }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function collectMatchUrls(page: Page): Promise<string[]> {
  await page.goto(RESULTS_URL, { waitUntil: "domcontentloaded" })
  // TODO(step 2): potwierdź selektor linków meczów na żywo.
  await page.waitForSelector("a[href*='/football/world/world-championship-2026/']", { timeout: 30000 })
  const hrefs = await page.$$eval(
    "a[href*='/football/world/world-championship-2026/']",
    (els) =>
      els
        .map((e) => (e as HTMLAnchorElement).href)
        .filter((h) => /-[A-Za-z0-9]{6,}\/$/.test(h)), // linki konkretnych meczów
  )
  return Array.from(new Set(hrefs))
}

async function scrapeMatch(page: Page, url: string): Promise<ScrapedOdds | null> {
  await page.goto(url, { waitUntil: "domcontentloaded" })
  // Otwórz zakładkę "Correct Score".
  // TODO(step 2): potwierdź tekst/selektor zakładki i wierszy kursów na żywo.
  const tab = page.getByText(/Correct Score/i).first()
  if (await tab.count()) await tab.click()
  await page.waitForTimeout(2500)

  const home = (await page.locator("[class*='participant'] >> nth=0").innerText().catch(() => "")) || ""
  const away = (await page.locator("[class*='participant'] >> nth=1").innerText().catch(() => "")) || ""

  // Wiersze kursów: każdy ma etykietę wyniku (np. "1:0") i kurs.
  const raw = await page.$$eval("[class*='row']", (rows) =>
    rows
      .map((r) => r.textContent ?? "")
      .filter((t) => /\d+\s*[:\-]\s*\d+|other/i.test(t)),
  )

  const scores: Record<string, number> = {}
  for (const line of raw) {
    const oddsMatch = line.match(/(\d+\.\d{1,2})/)
    if (!oddsMatch) continue
    const odds = Number(oddsMatch[1])
    if (/other/i.test(line)) {
      scores["OTHER"] = odds
      continue
    }
    const sc = parseScore(line)
    if (sc) scores[`${sc.r1}:${sc.r2}`] = odds
  }

  if (Object.keys(scores).length === 0) return null
  return { home: home.trim(), away: away.trim(), scores }
}

// Dopasuj scraped -> nasz mecz; zwróć czy trzeba odwrócić scoreline.
function orient(scraped: ScrapedOdds, m: DbMatch): { ok: boolean; flip: boolean } {
  const t1 = m.team1?.name ?? ""
  const t2 = m.team2?.name ?? ""
  if (teamNameMatches(t1, scraped.home) && teamNameMatches(t2, scraped.away)) return { ok: true, flip: false }
  if (teamNameMatches(t1, scraped.away) && teamNameMatches(t2, scraped.home)) return { ok: true, flip: true }
  return { ok: false, flip: false }
}

async function main() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("matches")
    .select("id, kickoff_at, result1, result2, status, team1:team1_id(name), team2:team2_id(name)")
    .eq("status", "FINISHED")
  if (error) throw error
  const matches = (data ?? []) as unknown as DbMatch[]
  console.log(`📋 ${matches.length} zakończonych meczów do pokrycia kursami`)

  const browser = await chromium.launch()
  const page = await browser.newPage()

  const urls = await collectMatchUrls(page)
  console.log(`🔗 Znaleziono ${urls.length} linków meczów na OddsPortal`)

  let saved = 0
  const skipped: string[] = []

  for (const url of urls) {
    try {
      const scraped = await scrapeMatch(page, url)
      if (!scraped) {
        skipped.push(`${url} (brak kursów)`)
        continue
      }
      // znajdź pasujący mecz po nazwach drużyn
      const m = matches.find((mm) => orient(scraped, mm).ok)
      if (!m) {
        skipped.push(`${url} (${scraped.home} vs ${scraped.away} — brak dopasowania)`)
        continue
      }
      const { flip } = orient(scraped, m)
      const rows = Object.entries(scraped.scores).map(([scoreline, odds]) => ({
        match_id: m.id,
        scoreline: flip ? flipScoreline(scoreline) : scoreline,
        odds,
        source: "oddsportal",
      }))
      const { error: upErr } = await supabase
        .from("match_odds")
        .upsert(rows, { onConflict: "match_id,scoreline" })
      if (upErr) throw upErr
      saved += rows.length
      console.log(`✅ ${scraped.home} vs ${scraped.away} -> mecz #${m.id} (${rows.length} kursów)`)
    } catch (e) {
      skipped.push(`${url} (błąd: ${(e as Error).message})`)
    }
  }

  await browser.close()
  console.log(`\n🎉 Zapisano ${saved} wierszy kursów. Pominięto ${skipped.length}:`)
  for (const s of skipped) console.log(`   - ${s}`)
}

main().catch((e) => {
  console.error("❌ Scraper nie powiódł się:", e)
  process.exit(1)
})
```

- [ ] **Step 2: Potwierdź selektory na żywo (investigation)**

Zainstaluj przeglądarkę: `npx playwright install chromium`.

Uruchom Playwright codegen na jednym meczu, żeby zobaczyć realne selektory zakładki „Correct Score", nazw drużyn i wierszy kursów:

```bash
npx playwright codegen "https://www.oddsportal.com/football/world/world-championship-2026/results/"
```

Wejdź w jeden mecz, kliknij zakładkę correct-score i odczytaj selektory z panelu codegen. Zaktualizuj w `index.ts` miejsca oznaczone `TODO(step 2)`:
- selektor linków meczów w `collectMatchUrls`,
- selektor/tekst zakładki „Correct Score" i wierszy kursów w `scrapeMatch`,
- selektory nazw `home`/`away`.

> To oczekiwany krok — OddsPortal renderuje JS-em, więc dokładne selektory można poznać tylko na żywo. Helpery parsujące (Task 6) są już stabilne i przetestowane.

- [ ] **Step 3: Dodaj skrypt npm**

W `package.json`, w sekcji `scripts`, dodaj po `"set:password"`:

```json
    "scrape:odds": "tsx --env-file=.env.local scripts/scrape-odds/index.ts",
```

- [ ] **Step 4: Smoke test — jeden mecz**

Tymczasowo ogranicz pętlę do pierwszego URL (dodaj `.slice(0, 1)` przy `for (const url of urls.slice(0, 1))`), uruchom:

```bash
npm run scrape:odds
```

Expected: log `✅ ... -> mecz #N (X kursów)` i w Supabase pojawiają się wiersze w `match_odds`. Po sukcesie cofnij `.slice(0, 1)`.

- [ ] **Step 5: Commit**

```bash
git add scripts/scrape-odds/index.ts package.json
git commit -m "feat(scraper): skrypt Playwright scrape:odds -> match_odds"
```

---

## Task 8: Pełny backfill + weryfikacja na realnych danych

**Files:** brak zmian w kodzie (uruchomienie + weryfikacja).

- [ ] **Step 1: Uruchom pełny scraper**

```bash
npm run scrape:odds
```

Przejrzyj raport końcowy. Dla każdego meczu z listy „pominięto (brak dopasowania)" dodaj brakujący alias do `TEAM_ALIASES` w `scripts/scrape-odds/parsing.ts` i uruchom ponownie (idempotentne). Powtarzaj, aż wszystkie zakończone mecze mają kursy.

- [ ] **Step 2: Zweryfikuj pokrycie w bazie**

```sql
select
  (select count(*) from matches where status = 'FINISHED') as finished,
  (select count(distinct match_id) from match_odds) as with_odds;
```

Expected: `with_odds` = `finished` (lub różnica = liczba pokazana w adnotacji na stronie).

- [ ] **Step 3: Zweryfikuj stronę**

Uruchom `npm run dev`, zaloguj się, wejdź na `/stats`. Sprawdź:
- bilans pieniężny posortowany malejąco, kwoty ze znakiem i kolorem,
- adnotacja o brakujących kursach znika, gdy pokrycie pełne,
- highlighty (dokładne / zwykłe / skuteczność / największa wygrana) pokazują sensownych liderów.

- [ ] **Step 4: Commit ewentualnych aliasów**

```bash
git add scripts/scrape-odds/parsing.ts
git commit -m "feat(scraper): aliasy nazw drużyn z realnego backfillu"
```

---

## Self-review (wykonane przy pisaniu planu)

- **Pokrycie specu:** sek. 4 → Task 1; sek. 5 → Task 6+7; sek. 6.1 (bilans) → Task 2; sek. 6.2 (statystyki) → Task 2 + Task 4 (`StatHighlights`); sek. 7 (strona/nawigacja) → Task 4 + Task 5; sek. 8 (kolejność) → Task 1→8. Adnotacja o brakach → `oddsCoverage` (Task 2) + strona (Task 4).
- **Spójność typów:** `OddsByMatch`, `MatchLite`, `PlayerStats`, `PredictionLite` zdefiniowane w Task 2 i używane identycznie w Task 3/4. `getMatchOdds → OddsByMatch`. `flipScoreline`/`parseScore`/`teamNameMatches` zdefiniowane w Task 6, użyte w Task 7.
- **Brak placeholderów w kodzie produkcyjnym:** jedyne `TODO(step 2)` dotyczą selektorów DOM, które z definicji wymagają inspekcji na żywo — objęte konkretną procedurą (Playwright codegen).
```
