# Redesign aplikacji Meczyki — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pełny redesign stylu i układu typera Mundial 2026 — kierunek "Stadion / Murawa" (ciemna zieleń, limonkowy akcent), trzy strefy (Mecze / Ranking / Siatka), wyłącznie komponenty shadcn/ui, responsywność mobile / tablet / desktop.

**Architecture:** Next.js 16 App Router. Logika gry (Supabase, scoring, lock typów, server actions, walidacja) pozostaje nietknięta — przepisujemy wyłącznie warstwę prezentacji. Trzy trasy widoków (`/`, `/ranking`, `/siatka`) korzystają ze wspólnej warstwy pobierania danych `lib/data.ts`. Nawigacja: dolny pasek zakładek na mobile, górny app bar na tablet/desktop.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Supabase, fonty Archivo / Inter / Geist Mono.

**Uwaga dla wykonawcy:** Przy implementacji komponentów wizualnych korzystaj ze skilla **frontend-design** — daje wyższą jakość wykończenia. Plan podaje strukturę, propsy, klucze responsywności i zachowania do utrzymania; dopracowanie wizualne (odstępy, hierarchia, mikrointerakcje) realizuj zgodnie z tym skillem i kierunkiem "Stadion".

**Spec:** `docs/superpowers/specs/2026-05-21-redesign-aplikacji-design.md`

**Weryfikacja w każdym zadaniu:** `npm run build`, `npm run typecheck`, `npm run lint` muszą przejść. To redesign UI — nie dopisujemy testów jednostkowych; istniejący `npm run test` (scoring) musi nadal przechodzić i jest sprawdzany w zadaniu końcowym.

**Uwaga o niezacommitowanej pracy:** `git status` pokazuje zmiany w kilku plikach. Przed przepisaniem każdego pliku odczytaj jego bieżącą zawartość (Read), żeby nie zgubić istniejącej logiki. Logika w `app/(auth)/actions.ts` i `lib/validation.ts` zostaje bez zmian.

---

## Mapa plików

**Nowe:**
- `lib/data.ts` — wspólne pobieranie danych (matches / leaderboard / predictions / profil)
- `components/phase-filter.tsx` — filtr fazy (`Tabs`), współdzielony przez Mecze i Siatkę
- `components/match-card.tsx` — karta jednego meczu w feedzie Mecze
- `components/matches-board.tsx` — klient: stan filtra + lista kart pogrupowana po dniu
- `components/predictions-matrix.tsx` — macierz mecze × gracze (następca `leaderboard-table.tsx`)
- `components/podium.tsx` — podium top 3 rankingu
- `components/ranking-list.tsx` — lista pozycji rankingu
- `components/bottom-nav.tsx` — dolny pasek zakładek (mobile)
- `app/(app)/ranking/page.tsx` — widok Ranking
- `app/(app)/siatka/page.tsx` — widok Siatka
- `components/ui/{tabs,tooltip,skeleton,scroll-area}.tsx` — dociągnięte z shadcn

**Przepisane:**
- `app/globals.css`, `app/layout.tsx`, `components/ui/sonner.tsx`
- `app/(app)/layout.tsx`, `app/(auth)/layout.tsx`
- `app/(app)/page.tsx` (widok Mecze)
- `app/(app)/settings/page.tsx`, `app/(app)/settings/forms.tsx`
- `app/(auth)/login/page.tsx`, `app/(auth)/login/form.tsx`
- `app/(auth)/register/page.tsx`, `app/(auth)/register/form.tsx`
- `components/prediction-cell.tsx`, `components/empty-state.tsx`, `components/flag.tsx`
- `lib/groups.ts` (dodanie helperów fazy)

**Usunięte:**
- `components/theme-provider.tsx`, `components/leaderboard-table.tsx`, `components/mobile-match-list.tsx`

---

## Task 1: Fundament — paleta Murawa, fonty, usunięcie motywu jasnego

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `components/ui/sonner.tsx`
- Delete: `components/theme-provider.tsx`

- [ ] **Step 1: Przepisz `app/globals.css`**

Zachowaj `@import` oraz `@custom-variant dark`. Zachowaj wszystkie mapowania `--color-*` i `--radius-*` z `@theme inline`. Dodaj do `@theme inline` mapowania fontu display i kolorów semantycznych. Zastąp bloki `:root` i `.dark` jednym blokiem `:root` z paletą Murawa. Usuń blok `.dark`.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --font-display: var(--font-display);
    --font-sans: var(--font-sans);
    --font-mono: var(--font-mono);
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-warning: var(--warning);
    --color-warning-foreground: var(--warning-foreground);
    --color-success: var(--success);
    --color-success-foreground: var(--success-foreground);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --color-foreground: var(--foreground);
    --color-background: var(--background);
    --radius-sm: calc(var(--radius) * 0.6);
    --radius-md: calc(var(--radius) * 0.8);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) * 1.4);
    --radius-2xl: calc(var(--radius) * 1.8);
    --radius-3xl: calc(var(--radius) * 2.2);
    --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
    /* Stadion / Murawa — jedyny motyw (ciemny) */
    --background: oklch(0.19 0.035 158);
    --foreground: oklch(0.95 0.012 145);
    --card: oklch(0.225 0.035 158);
    --card-foreground: oklch(0.95 0.012 145);
    --popover: oklch(0.225 0.035 158);
    --popover-foreground: oklch(0.95 0.012 145);
    --primary: oklch(0.87 0.20 122);
    --primary-foreground: oklch(0.24 0.06 150);
    --secondary: oklch(0.27 0.035 158);
    --secondary-foreground: oklch(0.95 0.012 145);
    --muted: oklch(0.26 0.03 158);
    --muted-foreground: oklch(0.72 0.035 150);
    --accent: oklch(0.30 0.04 158);
    --accent-foreground: oklch(0.96 0.012 145);
    --destructive: oklch(0.62 0.21 25);
    --success: oklch(0.87 0.20 122);
    --success-foreground: oklch(0.24 0.06 150);
    --warning: oklch(0.80 0.16 75);
    --warning-foreground: oklch(0.26 0.05 70);
    --border: oklch(0.31 0.03 158);
    --input: oklch(0.32 0.03 158);
    --ring: oklch(0.87 0.20 122);
    --chart-1: oklch(0.87 0.20 122);
    --chart-2: oklch(0.72 0.14 150);
    --chart-3: oklch(0.60 0.10 160);
    --chart-4: oklch(0.48 0.08 165);
    --chart-5: oklch(0.38 0.06 168);
    --radius: 0.625rem;
    --sidebar: oklch(0.21 0.035 158);
    --sidebar-foreground: oklch(0.95 0.012 145);
    --sidebar-primary: oklch(0.87 0.20 122);
    --sidebar-primary-foreground: oklch(0.24 0.06 150);
    --sidebar-accent: oklch(0.30 0.04 158);
    --sidebar-accent-foreground: oklch(0.96 0.012 145);
    --sidebar-border: oklch(0.31 0.03 158);
    --sidebar-ring: oklch(0.87 0.20 122);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 2: Przepisz `app/layout.tsx`**

Dodaj font Archivo (display). Usuń `ThemeProvider`. Ustaw `className="dark"` na `<html>` na stałe (paleta Murawa działa przez `:root`, klasa `dark` zapewnia spójność wariantów `dark:` w komponentach shadcn).

```tsx
import { Archivo, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Meczyki — Mundial 2026",
  description: "Aplikacja typerska na Mistrzostwa Świata 2026.",
}

const fontSans = Inter({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
const fontDisplay = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
})

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pl"
      className={cn(
        "dark antialiased",
        fontSans.variable,
        fontMono.variable,
        fontDisplay.variable,
      )}
    >
      <body className="font-sans">{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Zaktualizuj `components/ui/sonner.tsx`**

Usuń import i użycie `useTheme` z `next-themes`. Ustaw `theme="dark"` na stałe. Reszta pliku (ikony, `style`, `toastOptions`) bez zmian.

```tsx
"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "cn-toast" } }}
      {...props}
    />
  )
}

export { Toaster }
```

- [ ] **Step 4: Usuń `components/theme-provider.tsx`**

```bash
git rm components/theme-provider.tsx
```

- [ ] **Step 5: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: wszystkie przechodzą. Brak referencji do `next-themes` poza `package.json` (`grep -rn "next-themes" app components lib` → brak wyników).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/layout.tsx components/ui/sonner.tsx
git commit -m "feat: paleta Murawa, fonty Archivo, usuniecie motywu jasnego"
```

---

## Task 2: Dociągnięcie komponentów shadcn/ui

**Files:**
- Create: `components/ui/tabs.tsx`, `components/ui/tooltip.tsx`, `components/ui/skeleton.tsx`, `components/ui/scroll-area.tsx`

- [ ] **Step 1: Dodaj komponenty**

Run: `npx shadcn@latest add tabs tooltip skeleton scroll-area`
Jeśli CLI zapyta o nadpisanie istniejących plików — odmów (nie nadpisuj już istniejących komponentów). Powstać mają tylko cztery nowe pliki w `components/ui/`.

- [ ] **Step 2: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą. Cztery nowe pliki istnieją w `components/ui/`.

- [ ] **Step 3: Commit**

```bash
git add components/ui/tabs.tsx components/ui/tooltip.tsx components/ui/skeleton.tsx components/ui/scroll-area.tsx
git commit -m "chore: dociagniecie komponentow shadcn (tabs, tooltip, skeleton, scroll-area)"
```

---

## Task 3: Wspólna warstwa danych i helpery fazy

**Files:**
- Create: `lib/data.ts`
- Modify: `lib/groups.ts`
- Modify: `app/(app)/page.tsx`

- [ ] **Step 1: Dodaj helpery fazy do `lib/groups.ts`**

Dopisz na końcu pliku (zachowaj istniejącą zawartość). Model "fazy" filtra: `upcoming` + siedem etapów zmapowanych z `Match["stage"]`.

```ts
import type { MatchWithTeams } from "@/lib/types"

export type PhaseKey = "upcoming" | "GROUP" | "R32" | "R16" | "QF" | "SF" | "F"

export const PHASE_TABS: { key: PhaseKey; label: string }[] = [
  { key: "upcoming", label: "Nadchodzące" },
  { key: "GROUP", label: "Grupy" },
  { key: "R32", label: "1/16" },
  { key: "R16", label: "1/8" },
  { key: "QF", label: "ĆF" },
  { key: "SF", label: "PF" },
  { key: "F", label: "Finał" },
]

// Etykieta krótka fazy na kartach/wierszach.
export function shortStage(stage: string, groupLetter: string | null): string {
  if (stage === "GROUP") return `Grupa ${groupLetter ?? "?"}`
  if (stage === "R32") return "1/16 finału"
  if (stage === "R16") return "1/8 finału"
  if (stage === "QF") return "Ćwierćfinał"
  if (stage === "SF") return "Półfinał"
  if (stage === "3RD") return "Mecz o 3. miejsce"
  if (stage === "F") return "Finał"
  return stage
}

// Czy mecz należy do wybranej fazy. "Finał" zawiera też mecz o 3. miejsce.
// "upcoming" = mecz jeszcze się nie rozpoczął.
export function matchInPhase(match: MatchWithTeams, phase: PhaseKey, now: number): boolean {
  if (phase === "upcoming") return new Date(match.kickoff_at).getTime() > now
  if (phase === "F") return match.stage === "F" || match.stage === "3RD"
  return match.stage === phase
}
```

- [ ] **Step 2: Utwórz `lib/data.ts`**

Wyciąga zapytania Supabase z `page.tsx` do funkcji wielokrotnego użytku. Te same `select`-y co obecnie w `app/(app)/page.tsx`.

```ts
import { createClient } from "@/lib/supabase/server"
import type { MatchWithTeams, Player, PredictionRow } from "@/lib/types"

const MATCH_SELECT =
  "id, external_id, stage, group_letter, team1_id, team2_id, kickoff_at, status, result1, result2, " +
  "team1:team1_id(id,name,iso_code,fifa_code,group_letter), " +
  "team2:team2_id(id,name,iso_code,fifa_code,group_letter)"

export async function getMatches(): Promise<MatchWithTeams[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .order("kickoff_at", { ascending: true })
  return (data ?? []) as unknown as MatchWithTeams[]
}

export async function getLeaderboard(): Promise<Player[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("leaderboard")
    .select("id, username, first_name, last_name, avatar_url, total_points, exact_hits")
  return (data ?? []) as Player[]
}

export async function getPredictions(): Promise<PredictionRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("predictions")
    .select("user_id, match_id, pred1, pred2, confirmed_at")
  return (data ?? []) as PredictionRow[]
}

// Sortowanie rankingu: punkty desc, dokładne trafienia desc, login asc.
export function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    if (b.exact_hits !== a.exact_hits) return b.exact_hits - a.exact_hits
    return a.username.localeCompare(b.username, "pl")
  })
}
```

- [ ] **Step 3: Przełącz `app/(app)/page.tsx` na `lib/data.ts`**

Bez zmian wizualnych — zamień ręczne zapytania na funkcje z `lib/data.ts`. Pozostaw na razie istniejący render (`LeaderboardTable` / `MobileMatchList`) — zostanie przepisany w Task 10.

```tsx
import { getMatches, getLeaderboard, getPredictions, sortPlayers } from "@/lib/data"
import { LeaderboardTable } from "@/components/leaderboard-table"
import { MobileMatchList } from "@/components/mobile-match-list"
import { EmptyState } from "@/components/empty-state"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [matches, players, predictions] = await Promise.all([
    getMatches(),
    getLeaderboard(),
    getPredictions(),
  ])
  const sortedPlayers = sortPlayers(players)

  if (matches.length === 0) return <EmptyState />

  return (
    <>
      <div className="hidden lg:block">
        <LeaderboardTable
          matches={matches}
          players={sortedPlayers}
          predictions={predictions}
          currentUserId={user.id}
        />
      </div>
      <div className="lg:hidden">
        <MobileMatchList
          matches={matches}
          players={sortedPlayers}
          predictions={predictions}
          currentUserId={user.id}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 4: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą. Aplikacja działa wizualnie jak przed zadaniem (smoke test opcjonalny: `npm run dev`, strona `/` renderuje tabelę).

- [ ] **Step 5: Commit**

```bash
git add lib/data.ts lib/groups.ts "app/(app)/page.tsx"
git commit -m "refactor: wspolna warstwa danych lib/data.ts + helpery fazy"
```

---

## Task 4: Restyl komponentów liściastych — flag, prediction-cell, empty-state

**Files:**
- Modify: `components/flag.tsx`
- Modify: `components/prediction-cell.tsx`
- Modify: `components/empty-state.tsx`

- [ ] **Step 1: `components/flag.tsx`**

Bez zmian logiki (kody ISO, fallback, `flagcdn`). Restyl: pierścień dopasowany do ciemnego tła — zamień `ring-black/10` na `ring-white/15`, fallback `bg-muted` zostaje. Reszta bez zmian.

- [ ] **Step 2: `components/prediction-cell.tsx`**

Zachowaj CAŁĄ logikę: ukrywanie cudzych typów przed kick-offem, `isLocked`, debounce 400 ms, walidacja 0–99 i liczb całkowitych, `upsertPrediction`, stany `saved`, `StatusBadge`. Zmiany wyłącznie wizualne:

- Pola edytowalne: zastąp surowe `<input>` komponentem `Input` z `@/components/ui/input`, z `className` ustawiającym mały rozmiar: `"h-9 w-11 text-center font-mono tabular-nums text-base sm:h-8 sm:w-9"`. Stany błędu/zapisu nakładaj klasami `aria-invalid` lub dodatkowym `className` (`saved === "ok"` → `border-success`, `saved === "err"` → `border-destructive`).
- Stan zablokowany (`isLocked`): kolory wyników typów dostrojone do palety —
  - `correct === "exact"` → `border-success/60 bg-success/15 text-success`
  - `correct === "outcome"` → `border-warning/60 bg-warning/15 text-warning`
  - `correct === "miss"` → `border-border text-muted-foreground`
  - brak wyniku / `!correct` → `border-border`
- `title` na zablokowanym typie zastąp komponentem `Tooltip` (`TooltipProvider`, `TooltipTrigger asChild`, `TooltipContent`) z tą samą treścią ("Dokładny wynik (3 pkt)" itd.).
- Pola dotykowe na mobile min. 36 px wysokości (`h-9`), na ≥sm mniejsze (`sm:h-8`).
- `StatusBadge`: ikony `Check` → `text-success`, błąd → tło `bg-destructive/15 border-destructive text-destructive`.

- [ ] **Step 3: `components/empty-state.tsx`**

Opakuj w `Card` z `@/components/ui/card`. Struktura: wyśrodkowana `Card` (`max-w-md mx-auto mt-10`), w `CardContent` ikona piłki w kółku (`size-12 rounded-full bg-primary/15 text-primary` z `lucide-react`, np. `Trophy` lub emoji), nagłówek (`font-display font-bold`), opis z `<code>` na klasie `rounded bg-muted px-1`. Treść tekstowa bez zmian.

- [ ] **Step 4: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą.

- [ ] **Step 5: Commit**

```bash
git add components/flag.tsx components/prediction-cell.tsx components/empty-state.tsx
git commit -m "feat: restyl flag, prediction-cell (Input + Tooltip), empty-state (Card)"
```

---

## Task 5: Restyl auth — layout, strony i formularze logowania/rejestracji

**Files:**
- Modify: `app/(auth)/layout.tsx`
- Modify: `app/(auth)/login/page.tsx`, `app/(auth)/login/form.tsx`
- Modify: `app/(auth)/register/page.tsx`, `app/(auth)/register/form.tsx`

- [ ] **Step 1: `app/(auth)/layout.tsx`**

Tło Murawa z subtelnym akcentem (np. radialny gradient limonki w rogu przez `bg-[radial-gradient(...)]` lub `bg-background` + dekoracyjny element). Wyśrodkowanie zostaje (`min-h-svh flex items-center justify-center p-6`). Hero: wordmark "Meczyki" w `font-display` (`text-4xl font-extrabold tracking-tight`), pod nim podtytuł `text-muted-foreground`. Kropka/akcent w `text-primary`.

- [ ] **Step 2: `app/(auth)/login/page.tsx` i `register/page.tsx`**

Opakuj formularz w `Card` (`CardHeader` z `CardTitle` "Zaloguj się" / "Załóż konto", `CardContent` z formularzem, opcjonalnie `CardFooter` z linkiem do drugiej strony). Odczytaj bieżącą zawartość plików (Read) i zachowaj istniejące linki/teksty.

- [ ] **Step 3: `login/form.tsx` i `register/form.tsx`**

Logika bez zmian (`useActionState`, `loginAction`/`registerAction`, `fieldErrors`, `pending`). Restyl: zachowaj `Label` + `Input` shadcn, dopracuj odstępy (`space-y-4`), komunikaty błędów `text-destructive text-sm`, przycisk `w-full` z `font-display` (wersaliki opcjonalnie). Bez zmian nazw pól (`username`, `password`) i `autoComplete`.

- [ ] **Step 4: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)"
git commit -m "feat: restyl widokow logowania i rejestracji"
```

---

## Task 6: Restyl ustawień — profil, avatar, hasło

**Files:**
- Modify: `app/(app)/settings/page.tsx`
- Modify: `app/(app)/settings/forms.tsx`

- [ ] **Step 1: `app/(app)/settings/page.tsx`**

Logika bez zmian (pobranie usera + profilu, redirect). Restyl: nagłówek `h1` w `font-display font-extrabold`, sekcje w `Card` (Profil / Avatar / Zmiana hasła), kontener `mx-auto max-w-2xl space-y-6`. Avatar w karcie profilu `size-16`, login w `font-medium`.

- [ ] **Step 2: `app/(app)/settings/forms.tsx`**

Logika bez zmian (`AvatarForm`, `PasswordForm`, `useActionState`, akcje, `pending`). Restyl: spójne odstępy, komunikaty sukcesu `text-success` zamiast `text-green-600`, błędy `text-destructive`, przyciski z `font-display`.

- [ ] **Step 3: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/settings"
git commit -m "feat: restyl widoku ustawien"
```

---

## Task 7: Komponent phase-filter

**Files:**
- Create: `components/phase-filter.tsx`

- [ ] **Step 1: Utwórz `components/phase-filter.tsx`**

Klient. Pasek zakładek faz na `Tabs` z shadcn, sterowany z zewnątrz (`value` + `onValueChange`). Przewijalny poziomo na mobile.

```tsx
"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PHASE_TABS, type PhaseKey } from "@/lib/groups"

type Props = {
  value: PhaseKey
  onValueChange: (value: PhaseKey) => void
}

export function PhaseFilter({ value, onValueChange }: Props) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as PhaseKey)}>
      <TabsList className="flex w-full justify-start overflow-x-auto sm:w-auto">
        {PHASE_TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="font-display whitespace-nowrap">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
```

- [ ] **Step 2: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą.

- [ ] **Step 3: Commit**

```bash
git add components/phase-filter.tsx
git commit -m "feat: komponent phase-filter (Tabs)"
```

---

## Task 8: Komponent match-card

**Files:**
- Create: `components/match-card.tsx`

- [ ] **Step 1: Utwórz `components/match-card.tsx`**

Klient. Karta jednego meczu w feedzie Mecze. Propsy:

```ts
type MatchCardProps = {
  match: MatchWithTeams        // z @/lib/types
  players: Player[]            // posortowani — do sekcji "typy znajomych"
  predMap: Map<string, PredictionRow>  // userId -> typ DLA TEGO meczu
  currentUserId: string
  now: number                  // znacznik czasu z useNowTick (lock)
}
```

Struktura (komponent `Card`):
- `CardHeader` / górny pasek: godzina kick-offu (`font-mono`, helper `formatKickoff`), etykieta fazy (`shortStage` z `lib/groups`), badge statusu — `IN_PLAY` → `Badge` "LIVE" `animate-pulse` w kolorze `destructive`; `FINISHED` → `Badge` "FT" `variant="secondary"`.
- Środek: drużyna 1 i drużyna 2 — `Flag` + nazwa (`font-medium`), pomiędzy nimi wynik meczu w pudełku `font-mono tabular-nums` (gdy brak — kreski wygaszone). Drużyna 1 wyrównana do prawej, drużyna 2 do lewej (jak obecnie), na mobile może być układ pionowy jeśli ciasno.
- Sekcja typu: `PredictionCell` dla bieżącego gracza (`isOwn`, `matchStarted = new Date(match.kickoff_at).getTime() <= now`). Po kick-offie pokaż obok zdobyte punkty (wylicz z `lib/scoring.ts` — funkcja `scorePrediction` lub analogiczna; sprawdź sygnaturę w `lib/scoring.ts` i użyj jej).
- Stopka: przycisk `Button variant="ghost" size="sm"` "Typy znajomych" otwierający `Sheet` (side="bottom") z listą wszystkich graczy i ich `PredictionCell` (read-only, `isOwn={false}`). Lista jak w obecnym `mobile-match-list.tsx` — avatar + login + `PredictionCell`. Cudze typy i tak ukryte przed kick-offem przez samą `PredictionCell`.

Helpery `formatKickoff` (godzina `pl-PL`, 2-cyfrowo) skopiuj z obecnego `leaderboard-table.tsx`. Punktację licz funkcją z `lib/scoring.ts` — NIE duplikuj logiki 3/1/0.

Wykończenie wizualne: użyj skilla frontend-design. Karta ma być czytelna na szerokości ~320 px (mobile) i w siatce 2-kolumnowej (desktop).

- [ ] **Step 2: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą.

- [ ] **Step 3: Commit**

```bash
git add components/match-card.tsx
git commit -m "feat: komponent match-card"
```

---

## Task 9: Komponent matches-board

**Files:**
- Create: `components/matches-board.tsx`

- [ ] **Step 1: Utwórz `components/matches-board.tsx`**

Klient. Kontener widoku Mecze: stan filtra fazy + lista kart pogrupowana po dniu. Propsy:

```ts
type MatchesBoardProps = {
  matches: MatchWithTeams[]
  players: Player[]
  predictions: PredictionRow[]
  currentUserId: string
}
```

Zachowania:
- `useState<PhaseKey>("upcoming")` dla wybranej fazy; renderuj `<PhaseFilter>`.
- `useNowTick()` — skopiuj wzorzec `useSyncExternalStore` z obecnego `leaderboard-table.tsx` (subskrypcja `setInterval` 30 s, `getNowBucket`, `getServerNow`).
- `predMap`: `Map<number, Map<string, PredictionRow>>` (matchId → userId → typ) — `useMemo`, jak obecnie.
- Filtrowanie: `matches.filter((m) => matchInPhase(m, phase, now))` (helper z `lib/groups`).
- Grupowanie po dniu: `dayKey` / `dayLabel` — skopiuj z obecnego `leaderboard-table.tsx`. Nagłówek dnia w `font-display` wersaliki, `text-muted-foreground`.
- Renderuj `<MatchCard>` dla każdego meczu w siatce: `grid grid-cols-1 gap-3 md:grid-cols-2`.
- Przycisk "Zatwierdź typy" wywołujący `confirmAllPredictions` w `useTransition` (jak obecnie). Pokaż `toast` sukcesu/błędu (`sonner`).
- Gdy po filtrze brak meczów — komunikat `text-muted-foreground` "Brak meczów w tej fazie".

- [ ] **Step 2: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą.

- [ ] **Step 3: Commit**

```bash
git add components/matches-board.tsx
git commit -m "feat: komponent matches-board (filtr + lista kart)"
```

---

## Task 10: Widok Mecze — przepisanie strony głównej

**Files:**
- Modify: `app/(app)/page.tsx`

- [ ] **Step 1: Przepisz `app/(app)/page.tsx`**

Server component. Pobiera dane przez `lib/data.ts`. Renderuje pasek "Twoja kolej" + `<MatchesBoard>`. Przestaje importować `LeaderboardTable` i `MobileMatchList`.

```tsx
import { createClient } from "@/lib/supabase/server"
import { getMatches, getLeaderboard, getPredictions, sortPlayers } from "@/lib/data"
import { MatchesBoard } from "@/components/matches-board"
import { EmptyState } from "@/components/empty-state"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [matches, players, predictions] = await Promise.all([
    getMatches(),
    getLeaderboard(),
    getPredictions(),
  ])

  if (matches.length === 0) return <EmptyState />

  // Pasek "Twoja kolej": liczba nadchodzących meczów bez typu bieżącego gracza.
  const now = Date.now()
  const ownPredMatchIds = new Set(
    predictions.filter((p) => p.user_id === user.id).map((p) => p.match_id),
  )
  const todoCount = matches.filter(
    (m) => new Date(m.kickoff_at).getTime() > now && !ownPredMatchIds.has(m.id),
  ).length

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Mecze</h1>
        <p className="text-muted-foreground text-sm">
          {todoCount > 0
            ? `${todoCount} ${todoCount === 1 ? "mecz bez typu" : "meczów bez typu"} — Twoja kolej.`
            : "Wszystkie nadchodzące mecze obstawione."}
        </p>
      </header>
      <MatchesBoard
        matches={matches}
        players={sortPlayers(players)}
        predictions={predictions}
        currentUserId={user.id}
      />
    </div>
  )
}
```

Uwaga: pasek "Twoja kolej" może być osobnym komponentem prezentacyjnym, jeśli executor uzna za czytelniejsze — to dozwolone. Liczba odmiany słowa "mecz" może być dopracowana (1 / 2-4 / 5+), ale to opcjonalne.

- [ ] **Step 2: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą. `npm run dev` → `/` pokazuje feed kart Mecze, filtr fazy działa, wpisanie typu zapisuje się (toast / status).

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/page.tsx"
git commit -m "feat: widok Mecze (feed kart z filtrem fazy)"
```

---

## Task 11: Komponent predictions-matrix + widok Siatka

**Files:**
- Create: `components/predictions-matrix.tsx`
- Create: `app/(app)/siatka/page.tsx`

- [ ] **Step 1: Utwórz `components/predictions-matrix.tsx`**

Klient. Następca `leaderboard-table.tsx` — macierz mecze × gracze. Punkt wyjścia: skopiuj logikę z `components/leaderboard-table.tsx` (Read), następnie:

- Zamień surowy `<table>` na komponenty `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` z `@/components/ui/table`.
- Owiń tabelę w `ScrollArea` (poziomy scroll) — tabela jest szersza niż ekran przy wielu graczach.
- Nagłówek tabeli przyklejony (`sticky top-0`), pierwsza kolumna (informacja o meczu) przyklejona do lewej (`sticky left-0`) z tłem `bg-card`, żeby nie nachodził na nią scroll.
- Dodaj filtr fazy: `useState<PhaseKey>` + `<PhaseFilter>` nad tabelą; filtruj `matches` przez `matchInPhase`. Domyślnie `"upcoming"`.
- Zachowaj: `predMap`, grupowanie po dniach (`SectionBlock`), `useNowTick`, `ResultBox`, `Legend`, kolumna bieżącego gracza podświetlona (`bg-primary/10`).
- Kolory komórek/legendy dostrojone do palety: exact → `success`, outcome → `warning`, miss → `muted` (spójnie z `prediction-cell.tsx` z Task 4).
- Przycisk "Zatwierdź moje typy" → `confirmAllPredictions` + toast.

Propsy identyczne jak obecny `LeaderboardTable`: `{ matches, players, predictions, currentUserId }`.

- [ ] **Step 2: Utwórz `app/(app)/siatka/page.tsx`**

Server component analogiczny do `page.tsx`.

```tsx
import { createClient } from "@/lib/supabase/server"
import { getMatches, getLeaderboard, getPredictions, sortPlayers } from "@/lib/data"
import { PredictionsMatrix } from "@/components/predictions-matrix"
import { EmptyState } from "@/components/empty-state"

export const dynamic = "force-dynamic"

export default async function SiatkaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [matches, players, predictions] = await Promise.all([
    getMatches(),
    getLeaderboard(),
    getPredictions(),
  ])

  if (matches.length === 0) return <EmptyState />

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Siatka typów</h1>
        <p className="text-muted-foreground text-sm">
          {matches.length} meczów · {players.length} graczy
        </p>
      </header>
      <PredictionsMatrix
        matches={matches}
        players={sortPlayers(players)}
        predictions={predictions}
        currentUserId={user.id}
      />
    </div>
  )
}
```

- [ ] **Step 3: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą. `npm run dev` → `/siatka` pokazuje macierz z przyklejonym nagłówkiem i scrollem poziomym, filtr fazy działa.

- [ ] **Step 4: Commit**

```bash
git add components/predictions-matrix.tsx "app/(app)/siatka/page.tsx"
git commit -m "feat: widok Siatka (macierz na komponencie Table)"
```

---

## Task 12: Widok Ranking — podium, lista pozycji, strona

**Files:**
- Create: `components/podium.tsx`
- Create: `components/ranking-list.tsx`
- Create: `app/(app)/ranking/page.tsx`

- [ ] **Step 1: Utwórz `components/podium.tsx`**

Server-friendly (bez stanu). Propsy: `{ players: Player[]; currentUserId: string }` — `players` już posortowani. Renderuje pierwszą trójkę: kolejność wizualna 2-1-3 (najwyższy słupek w środku), avatar (`Avatar`, np. `size-16`/`size-20`), login, punkty w `font-mono`. Miejsce 1 z akcentem `primary`/limonka, słupki różnej wysokości. Bieżący gracz wyróżniony obwódką `ring-2 ring-primary`. Gdy graczy <3 — pokaż tyle ile jest. Responsywny: na mobile zwęża się, ale trzyma układ podium.

- [ ] **Step 2: Utwórz `components/ranking-list.tsx`**

Propsy: `{ players: Player[]; currentUserId: string }` (posortowani). Renderuje pozycje od 1 w górę. Miejsca dzielone ex aequo: dwóch graczy o tej samej liczbie punktów ORAZ dokładnych trafień dostaje ten sam numer miejsca (oblicz numer miejsca przez porównanie z poprzednim graczem — równi `total_points` i `exact_hits` → to samo miejsce). Każdy wiersz: numer miejsca (`font-mono`), `Avatar`, login, liczba dokładnych trafień jako `Badge variant="secondary"` ("X×3pkt" lub ikona), punkty w `font-mono font-bold`. Bieżący gracz: tło `bg-primary/10`.

Desktop (`md`+): komponent `Table`. Mobile: lista wierszy-kart (`flex` w obrębie `Card` lub `divide-y`). Można zrealizować jednym responsywnym układem flex/grid — `Table` nie jest wymagane, byle czytelnie.

- [ ] **Step 3: Utwórz `app/(app)/ranking/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server"
import { getLeaderboard, sortPlayers } from "@/lib/data"
import { Podium } from "@/components/podium"
import { RankingList } from "@/components/ranking-list"

export const dynamic = "force-dynamic"

export default async function RankingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const players = sortPlayers(await getLeaderboard())

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Ranking</h1>
        <p className="text-muted-foreground text-sm">{players.length} graczy w grze</p>
      </header>
      {players.length > 0 && <Podium players={players} currentUserId={user.id} />}
      <RankingList players={players} currentUserId={user.id} />
    </div>
  )
}
```

- [ ] **Step 4: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą. `npm run dev` → `/ranking` pokazuje podium + listę, bieżący gracz wyróżniony.

- [ ] **Step 5: Commit**

```bash
git add components/podium.tsx components/ranking-list.tsx "app/(app)/ranking/page.tsx"
git commit -m "feat: widok Ranking (podium + lista pozycji)"
```

---

## Task 13: Nawigacja — app bar i dolny pasek zakładek

**Files:**
- Create: `components/bottom-nav.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Utwórz `components/bottom-nav.tsx`**

Klient (`usePathname`). Dolny pasek zakładek widoczny tylko na mobile (`lg:hidden`). Cztery zakładki: Mecze (`/`, ikona `Goal`/`CircleDot`), Ranking (`/ranking`, `Trophy`), Siatka (`/siatka`, `Grid3x3`/`Table`), Profil (`/settings`, `User`). Aktywna zakładka — kolor `text-primary`, pozostałe `text-muted-foreground`.

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CircleDot, Trophy, Grid3x3, User } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/", label: "Mecze", icon: CircleDot },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/siatka", label: "Siatka", icon: Grid3x3 },
  { href: "/settings", label: "Profil", icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="bg-card/95 supports-[backdrop-filter]:bg-card/80 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur lg:hidden">
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Przepisz `app/(app)/layout.tsx`**

Zachowaj logikę: pobranie usera (`redirect("/login")` gdy brak), pobranie profilu (`username`, `avatar_url`), inicjały. Restyl + nawigacja:

- Górny app bar (`sticky top-0`): wordmark "Meczyki · WC 2026" w `font-display font-extrabold`. Linki nawigacyjne (Mecze / Ranking / Siatka) widoczne `hidden lg:flex` — użyj `Link` + `Button variant="ghost"`.
- Prawa strona app baru: `DropdownMenu` pod `Avatar` (jak dotychczas inicjały + `avatar_url`). Pozycje menu: "Ustawienia" (`Link href="/settings"`, ikona `Settings`) i "Wyloguj" — pozycja w `<form action={logoutAction}>` z `DropdownMenuItem asChild` lub przyciskiem typu submit. Zachowaj `logoutAction` z `app/(auth)/actions.ts`.
- `<main>`: kontener `container mx-auto px-4 py-6`; dodaj dolny padding na mobile, by treść nie chowała się pod paskiem: `pb-24 lg:pb-6`.
- Po `</main>` renderuj `<BottomNav />`.

- [ ] **Step 3: Weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint`
Expected: przechodzą. `npm run dev` → na wąskim oknie widać dolny pasek (4 zakładki, aktywna podświetlona), na szerokim — linki w app barze; menu pod avatarem działa (Ustawienia, Wyloguj).

- [ ] **Step 4: Commit**

```bash
git add components/bottom-nav.tsx "app/(app)/layout.tsx"
git commit -m "feat: nawigacja — app bar + dolny pasek zakladek"
```

---

## Task 14: Sprzątanie i weryfikacja końcowa

**Files:**
- Delete: `components/leaderboard-table.tsx`, `components/mobile-match-list.tsx`

- [ ] **Step 1: Sprawdź brak referencji**

Run: `grep -rn "leaderboard-table\|mobile-match-list\|theme-provider\|next-themes" app components lib`
Expected: brak wyników (poza ewentualnie `package.json`, którego nie skanujemy). Jeśli coś wyjdzie — popraw zanim usuniesz pliki.

- [ ] **Step 2: Usuń osierocone komponenty**

```bash
git rm components/leaderboard-table.tsx components/mobile-match-list.tsx
```

- [ ] **Step 3: (Opcjonalnie) odinstaluj `next-themes`**

Jeśli `grep -rn "next-themes" app components lib` nie zwraca nic — pakiet jest nieużywany. Można go usunąć: `npm uninstall next-themes`. Jeśli pominięte — nie blokuje to ukończenia.

- [ ] **Step 4: Pełna weryfikacja**

Run: `npm run build && npm run typecheck && npm run lint && npm run test`
Expected: wszystkie cztery przechodzą. Test scoringu (`lib/scoring.test.ts`) zielony.

- [ ] **Step 5: Przegląd wizualny na dev serverze**

Run: `npm run dev`
Sprawdź w przeglądarce (DevTools, tryb responsywny) w trzech szerokościach — ~390 px (mobile), ~820 px (tablet), ~1440 px (desktop):
- `/login`, `/register` — wyśrodkowana karta, formularze działają
- `/` (Mecze) — feed kart, filtr fazy, wpisanie typu zapisuje się, "typy znajomych" otwiera Sheet
- `/ranking` — podium + lista, bieżący gracz wyróżniony
- `/siatka` — macierz, przyklejony nagłówek, scroll poziomy, filtr fazy
- `/settings` — karty profil/avatar/hasło
- nawigacja: dolny pasek na mobile, app bar na desktop, menu pod avatarem
Wszystkie widoki czytelne i bez przewijania poziomego strony (poza zamierzonym scrollem macierzy w Siatce).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: usuniecie osieroconych komponentow + weryfikacja koncowa"
```

---

## Self-review — pokrycie spec

- Trzy strefy (Mecze / Ranking / Siatka) → Task 10 / 12 / 11 ✓
- Nawigacja mobile (dolny pasek) + desktop (app bar) → Task 13 ✓
- Paleta Murawa, ciemny motyw, usunięcie przełącznika → Task 1 ✓
- Font display Archivo → Task 1 ✓
- Tylko komponenty shadcn (Table, Input, Tabs, Tooltip itd.) → Task 2 (dociągnięcie) + 4, 8, 11 (użycie) ✓
- Wspólna warstwa danych `lib/data.ts` → Task 3 ✓
- Filtr fazy w Mecze i Siatce → Task 7 (komponent) + 9, 11 (użycie) ✓
- Karta meczu z polami typu + "typy znajomych" → Task 8 ✓
- Podium + lista pozycji z ex aequo → Task 12 ✓
- Restyl auth + ustawień → Task 5, 6 ✓
- Restyl prediction-cell / empty-state / flag → Task 4 ✓
- Usunięcie `leaderboard-table`, `mobile-match-list`, `theme-provider` → Task 1 (theme-provider) + 14 ✓
- Logika gry nietknięta (scoring, RLS, server actions, walidacja) — żadne zadanie nie modyfikuje `lib/scoring.ts`, `lib/validation.ts`, `lib/supabase/*`, `app/(app)/actions.ts`, `app/(auth)/actions.ts`, migracji ✓
- Kryteria ukończenia (build / typecheck / lint / test + przegląd wizualny) → Task 14 ✓
