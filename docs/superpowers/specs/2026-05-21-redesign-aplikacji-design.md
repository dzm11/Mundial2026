# Redesign aplikacji Meczyki — projekt

**Data:** 2026-05-21
**Status:** zatwierdzony do planu wdrożenia

## Cel

Pełny redesign stylu i układu aplikacji typerskiej na Mundial 2026. Nowy
kierunek wizualny "Stadion / Murawa": głęboka zieleń murawy jako tło, limonkowy
akcent, grube wersaliki, cyfry monospace. Wyłącznie komponenty shadcn/ui.
Responsywność mobile / tablet / desktop z UX dopasowanym do każdego zakresu.

## Zakres

**Zmieniamy:** całą warstwę prezentacji — układ widoków, nawigację, style,
strukturę tras.

**NIE zmieniamy** (zostaje nietknięte):

- Supabase: schemat, migracje, RLS, klienty (`lib/supabase/*`)
- Scoring 3/1/0 — `lib/scoring.ts` + `lib/scoring.test.ts`
- Lock typów o kick-offie (egzekwowany przez RLS)
- Server actions: `upsertPrediction`, `confirmAllPredictions`,
  `loginAction`, `registerAction`, `logoutAction`, `uploadAvatarAction`,
  `changePasswordAction`
- Walidacja (`lib/validation.ts`), typy (`lib/types.ts`), middleware
- Mechanizm pobierania danych: render `force-dynamic`, fetch po stronie serwera
- Cron / GitHub Actions / API sync

## Decyzje wizualne (z burzy mózgów)

- Kierunek: **Stadion** — sportowy, energiczny
- Tło: **Murawa** — ciemny motyw na całej powierzchni
- **Tylko ciemny motyw** — przełącznik jasny/ciemny usunięty
- Architektura: **trzy strefy** — Mecze · Ranking · Siatka
- **Font display dodany** — Archivo (nagłówki, wordmark)

## Architektura tras i nawigacji

| Trasa | Widok | Uwaga |
|---|---|---|
| `/` | Mecze | feed kart meczów — wpisywanie typów |
| `/ranking` | Ranking | podium + lista pozycji |
| `/siatka` | Siatka | macierz mecze × gracze |
| `/settings` | Profil | avatar, zmiana hasła |
| `/login`, `/register` | Auth | logowanie / rejestracja |

**Nawigacja — mobile (<768px):**

- Górny pasek: wordmark + avatar
- Dolny pasek zakładek: Mecze · Ranking · Siatka · Profil
- Aktywna zakładka podświetlona (`usePathname`)

**Nawigacja — tablet i desktop (≥768px):**

- Górny app bar: wordmark, linki (Mecze · Ranking · Siatka),
  `DropdownMenu` pod avatarem (Ustawienia, Wyloguj)
- Brak dolnego paska

## Widok: Mecze (`/`)

Główne zadanie — wpisywanie i edycja własnych typów.

- **Pasek "Twoja kolej"** u góry: liczba typów do uzupełnienia + najbliższy
  mecz wyróżniony.
- **Filtr fazy** (`Tabs` shadcn): Nadchodzące · Grupy · 1/16 · 1/8 · ĆF · PF ·
  Finał. Domyślnie "Nadchodzące".
- Mecze pogrupowane po dniu kalendarzowym (istniejąca logika `dayKey`/`dayLabel`).
- **Karta meczu** (`components/match-card.tsx`):
  - godzina kick-offu + etykieta fazy
  - drużyna 1 (flaga + nazwa) — wynik — drużyna 2 (flaga + nazwa)
  - status: LIVE (animowany) / FT
  - pola typu inline (`PredictionCell`): edytowalne do kick-offu, potem
    zablokowane; auto-zapis z debounce (zachowanie z obecnego `prediction-cell`)
  - po kick-offie: zdobyte punkty + przycisk "typy znajomych" otwierający
    `Sheet` (mobile) / `Dialog` (desktop) z typami wszystkich graczy
- Akcja **"Zatwierdź typy"** — wywołuje `confirmAllPredictions` (bez zmian).
- Układ kart: mobile 1 kolumna, tablet/desktop 2 kolumny.

## Widok: Ranking (`/ranking`)

- **Podium** top 3: avatary, punkty, wyróżnienie wizualne miejsc 1–3.
- **Lista pozycji**: miejsce (dzielone ex aequo — istniejąca logika sortowania:
  punkty desc, dokładne trafienia desc, login asc), avatar, login, punkty,
  liczba dokładnych trafień (3 pkt). Bieżący gracz podświetlony.
- Desktop: `Table` shadcn. Mobile: lista kart.

## Widok: Siatka (`/siatka`)

- Pełna macierz: wiersze = mecze (grupowane po dniu), kolumny = gracze.
- Komponent `Table` shadcn (zastępuje surowy `<table>` z obecnego
  `leaderboard-table.tsx`).
- Przyklejony nagłówek (avatary graczy + punkty) i przyklejona lewa kolumna
  (informacja o meczu). Poziomy scroll przy wielu graczach (`scroll-area`).
- Filtr fazy — te same `Tabs` co w widoku Mecze.
- Komórki typów kolorowane: zielony = dokładny wynik (3 pkt),
  bursztyn = trafiony zwycięzca/remis (1 pkt), wygaszony = pudło (0 pkt).
- Cudze typy ukryte do momentu kick-offu (zachowanie z `PredictionCell`).
- Legenda punktacji pod tabelą.

## Widok: Profil (`/settings`)

- Karty `Card`: dane profilu (avatar + login), wgrywanie avatara, zmiana hasła.
- Formularze bez zmian funkcjonalnych — tylko restyl.

## Widoki: Auth (`/login`, `/register`)

- Wyśrodkowana `Card` na tle Murawa.
- Sportowy hero z wordmarkiem (Archivo).
- Formularze bez zmian funkcjonalnych — tylko restyl.

## System wizualny

**`app/globals.css`** — przepisany:

- Tylko ciemny motyw — paleta Murawa zdefiniowana w `:root`; jasny blok i
  `@custom-variant dark` usunięte / nieaktywne.
- Paleta oklch:
  - `background` — głęboka zieleń murawy
  - `card`, `popover` — jaśniejsza zieleń
  - `primary` — limonka; `primary-foreground` — ciemna zieleń
  - `foreground` — zielonkawa biel
  - `border`, `input` — stonowana zieleń
  - `muted`, `muted-foreground`, `accent`, `destructive` — dostrojone
- `--radius` lekko zmniejszony (zwarty, sportowy look).

**Motyw / next-themes:**

- Przełącznik usunięty. `ThemeProvider` (`components/theme-provider.tsx`)
  usunięty, `next-themes` przestaje być używany; paleta Murawa wpięta na stałe
  w `:root`. `class="dark"` na `<html>` nie jest potrzebne.
- `Sonner` (toaster) ustawiony na ciemny motyw na stałe (`theme="dark"`).

**Fonty (`app/layout.tsx`):**

- **Archivo** — display: wordmark, nagłówki sekcji, etykiety (wersaliki +
  tracking + ciężka grubość)
- **Inter** — tekst podstawowy
- **Geist Mono** — wyniki i typy (`tabular-nums`)

**Komponenty — wyłącznie shadcn/ui:**

- Już zainstalowane: `avatar`, `badge`, `button`, `card`, `dialog`,
  `dropdown-menu`, `input`, `label`, `separator`, `sheet`, `sonner`, `table`
- Do dociągnięcia: `tabs`, `tooltip`, `skeleton`, `scroll-area`
- Surowe `<table>` i `<input>` zastąpione komponentami shadcn.
- Atrybuty `title` zastąpione komponentem `Tooltip`.

## Struktura plików

**Nowe pliki:**

- `app/(app)/ranking/page.tsx`
- `app/(app)/siatka/page.tsx`
- `components/bottom-nav.tsx` — dolny pasek zakładek (mobile)
- `components/match-card.tsx` — karta meczu w feedzie
- `components/phase-filter.tsx` — filtr fazy (`Tabs`)
- `components/ranking-list.tsx` — lista pozycji rankingu
- `components/podium.tsx` — podium top 3
- `components/predictions-matrix.tsx` — macierz mecze × gracze
  (następca `leaderboard-table.tsx`)
- `lib/data.ts` — wspólne funkcje pobierania (`getMatches`, `getLeaderboard`,
  `getPredictions`), żeby trzy trasy nie duplikowały zapytań Supabase
- `components/ui/{tabs,tooltip,skeleton,scroll-area}.tsx` — dociągnięte z shadcn

**Przepisane (restyl, bez zmian logiki):**

- `app/(app)/layout.tsx` — app bar + warunkowy dolny pasek
- `app/(auth)/layout.tsx`
- `app/(app)/page.tsx` — widok Mecze
- `app/(app)/settings/page.tsx`, `app/(app)/settings/forms.tsx`
- `app/(auth)/login/page.tsx`, `app/(auth)/login/form.tsx`
- `app/(auth)/register/page.tsx`, `app/(auth)/register/form.tsx`
- `components/prediction-cell.tsx` — `Input` shadcn, restyl
- `components/empty-state.tsx` — `Card`
- `components/flag.tsx` — drobny restyl
- `app/layout.tsx` — fonty

**Usunięte:**

- `components/leaderboard-table.tsx` — zastąpione przez `predictions-matrix.tsx`
- `components/mobile-match-list.tsx` — funkcję przejmują `match-card.tsx`
  (widok Mecze) i `predictions-matrix.tsx` (widok Siatka)

## Uwaga: niezacommitowana praca

`git status` na starcie sesji pokazuje zmiany w: `app/(app)/layout.tsx`,
`app/(app)/page.tsx`, `app/(app)/settings/page.tsx`, `app/(auth)/actions.ts`,
`app/(auth)/login/form.tsx`, `app/(auth)/register/form.tsx`,
`components/leaderboard-table.tsx`, `components/mobile-match-list.tsx`,
`lib/validation.ts`. Przed przepisaniem każdego pliku trzeba sprawdzić jego
bieżącą zawartość, by nie nadpisać istniejącej pracy. Logikę z tych plików
(`actions.ts`, `validation.ts`) zachowujemy bez zmian.

## Responsywność

- **Mobile (<768px):** dolny pasek zakładek, jedna kolumna kart, `Sheet` do
  szczegółów meczu, większe pola dotyku.
- **Tablet (768–1024px):** górny app bar, dwukolumnowa siatka kart meczów,
  czytelny ranking.
- **Desktop (≥1024px):** górny app bar, dwu/trzykolumnowe siatki, pełna
  macierz w widoku Siatka.

## Kryteria ukończenia

- `npm run build` — przechodzi
- `npm run typecheck` — przechodzi
- `npm run lint` — przechodzi
- `npm run test` — przechodzi (test scoringu bez zmian)
- Przegląd wizualny na dev serverze w trzech zakresach (mobile, tablet,
  desktop) — wszystkie widoki responsywne i działające.
- Cała mechanika gry działa jak przed redesignem.
