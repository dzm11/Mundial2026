# Strona Stats — projekt (spec)

**Data:** 2026-06-19
**Status:** zatwierdzony do planu implementacji
**Branch bazowy:** `demo-v2` (implementacja na osobnym branchu feature)

## 1. Cel

Dodać nową podstronę **Stats** (`/stats`) z różnymi statystykami graczy. Najważniejsza,
wyróżniona na samej górze, to **bilans pieniężny**: ile dany gracz zarobiłby lub straciłby,
gdyby na **każdy mecz** postawił **100 zł na dokładny wynik (correct score)** swojego typu.

## 2. Kontekst — istniejący stan

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres), shadcn/ui +
  Tailwind, Vitest.
- **Scoring** (`lib/scoring.ts`): 3 pkt = dokładny wynik, 1 pkt = trafiony „zwykły" wynik
  (znak różnicy goli), 0 = pudło. Liczone tylko dla meczów `status = 'FINISHED'` z `result1`/`result2`.
- **Dane:** tabele `profiles`, `teams`, `matches` (z `result1`,`result2`,`status`,`kickoff_at`,
  `team1_id`,`team2_id`,`external_id` z football-data.org), `predictions` (`user_id`,`match_id`,
  `pred1`,`pred2`). Widoki `prediction_points`, `leaderboard` (`total_points`, `exact_hits`).
- **Brak jakichkolwiek danych o kursach.** football-data.org nie dostarcza kursów.
- **Nawigacja:** górny navbar w `app/(app)/layout.tsx`, mobilny `components/bottom-nav.tsx`.
  Istnieje strona `/ranking` (podium + lista) jako wzorzec stylu.

## 3. Kluczowa decyzja — źródło kursów

Po badaniu (the-odds-api, API-Football, Sportmonks, OddsPortal) ustalono:

- Żadne tanie API **nie udostępnia historycznych kursów correct-score** dla piłki
  (API-Football trzyma kursy 7 dni; the-odds-api nie ma correct-score dla soccera).
- **OddsPortal** ma realne, archiwalne kursy correct-score dla MŚ 2026, ale jego feed jest
  **zaszyfrowany (AES-CBC-256 + gzip)** z kluczem w rotującym, obfuskowanym bundlu JS — czyli
  ścieżka „czysty HTTP" jest krucha (psuje się przy każdym deployu OddsPortal).

**Wybrane rozwiązanie:** lokalny **scraper Playwright** (headless browser), który czyta kursy
correct-score **odszyfrowane przez samą stronę** (DOM) i zapisuje do Supabase. Uruchamiany
ręcznie (`npm run scrape:odds`) jako **jednorazowy backfill**, w razie potrzeby ponawiany dla
nowych meczów. Nie jest to serverless cron.

## 4. Model danych

Nowa tabela (migracja Supabase `supabase/migrations/0002_match_odds.sql`):

```sql
create table match_odds (
  match_id    bigint not null references matches(id) on delete cascade,
  scoreline   text   not null,           -- "team1:team2", np. "1:0"; "OTHER" = każdy inny wynik
  odds        numeric(8,2) not null,     -- kurs dziesiętny, uśredniony z OddsPortal
  source      text   not null default 'oddsportal',
  captured_at timestamptz not null default now(),
  primary key (match_id, scoreline)
);
```

- `scoreline` zapisywany **z perspektywy team1:team2** z naszej tabeli `matches` (uwaga na
  kolejność gospodarz/gość względem OddsPortal — patrz mapowanie).
- Specjalny wiersz `scoreline = 'OTHER'` przechowuje kurs „Inny wynik / Any Other Score"
  (fallback dla rzadkich rezultatów spoza siatki correct-score).
- RLS: odczyt publiczny dla zalogowanych (jak pozostałe tabele); zapis tylko service role
  (scraper używa klucza service role).

## 5. Scraper (Playwright)

Lokalizacja: `scripts/scrape-odds/` + skrypt npm `scrape:odds`.

Kroki:
1. Połącz z Supabase (service role z `.env`). Pobierz mecze `FINISHED` z `result1/result2`,
   które nie mają jeszcze kompletu kursów w `match_odds`.
2. Wejdź na stronę wyników MŚ 2026 OddsPortal, zbierz linki do stron poszczególnych meczów.
3. **Mapowanie meczów** OddsPortal ↔ nasze `matches` po **dacie kickoffu + nazwach drużyn**.
   Najbardziej wrażliwy element. Implementacja:
   - normalizacja nazw (lowercase, usunięcie znaków diakrytycznych, aliasy),
   - dopasowanie po dacie (±1 dzień) i parze drużyn,
   - **ręczny słownik wyjątków** dla nazw, które się nie zgadzają (np. „Korea Płd." vs
     „South Korea"). Niedopasowane mecze logowane i pomijane (nie zgadujemy).
4. Na stronie meczu otwórz zakładkę **„Dokładny wynik"** (Correct Score), odczytaj z DOM
   mapę `scoreline → kurs` (kurs **uśredniony**) oraz kurs „Inny wynik".
5. Wykryj orientację gospodarz/gość i w razie potrzeby **odwróć scoreline**, żeby był zgodny
   z perspektywą `team1:team2` naszej bazy.
6. Upsert do `match_odds`. Skrypt **idempotentny** — bezpieczny do wielokrotnego uruchamiania.

Obsługa błędów: każdy mecz w try/catch; błąd jednego meczu nie przerywa całości; na końcu
raport „zapisano X, pominięto Y (lista), bez kursów Z".

## 6. Logika statystyk (`lib/stats.ts`, TDD)

Czyste funkcje (bez I/O), testowane Vitestem (`lib/stats.test.ts`). Wejście: lista meczów
(z wynikiem), predykcje, mapa kursów (`match_id → { "1:0": 7.5, ..., "OTHER": 60 }`).

### 6.1 Bilans 100 zł / mecz (headline)

Reguła zakładu: gracz na każdy mecz stawia 100 zł na **swój** typ dokładnego wyniku. Wygrywa
tylko, gdy typ = faktyczny wynik. Wtedy stawia dokładnie na wynik, który padł, więc liczy się
**kurs padłego rezultatu** danego meczu.

Per mecz `FINISHED` z dostępnym kursem:
- trafiony dokładny wynik (`pred1==result1 && pred2==result2`):
  **`+100 × (kurs_padłego_wyniku − 1)`** (netto — odejmujemy własną stawkę 100 zł)
- w przeciwnym razie: **`−100`**

Kurs padłego wyniku = `match_odds[match_id]["{result1}:{result2}"]`, a jeśli brak takiego
wiersza → kurs `'OTHER'`.

**Bilans gracza = suma po wszystkich meczach `FINISHED` z dostępnym kursem.**
Mecze bez żadnego kursu (brak indywidualnego i brak `OTHER`) są **wykluczane** z bilansu i
zliczane do adnotacji „Bilans liczony z N meczów (brak kursów dla X)".

Wynik: ranking graczy malejąco (największy wygrany na górze), kwoty z kolorem +/−.

### 6.2 Pozostałe statystyki

- **Najwięcej dokładnych wyników** (`exact_hits`, już w `leaderboard`).
- **Najwięcej trafionych „zwykłych" wyników** (1 pkt) — zliczone z `prediction_points` lub
  policzone w `lib/stats.ts`.
- **Skuteczność** = (dokładne + zwykłe) / liczba ocenionych meczów, w %.
- **Największa pojedyncza wygrana** = najwyższy trafiony kurs (i przy którym meczu).

(Zestaw można rozszerzyć/uciąć w trakcie implementacji — bez zmiany architektury.)

## 7. Strona i nawigacja

- Nowa trasa `app/(app)/stats/page.tsx` (Server Component): pobiera matches/predictions/
  match_odds/players, liczy statystyki przez `lib/stats.ts`, renderuje.
- **Sekcja hero**: „Bilans 100 zł na dokładny wynik" — ranking kwotowy, największy wygrany na
  górze; adnotacja o meczach bez kursów, jeśli występują.
- **Sekcje poniżej**: karty z pozostałymi statystykami (pkt 6.2).
- Komponenty w `components/` w stylu strony `/ranking` (shadcn). Reużycie istniejących
  prymitywów UI.
- Dodać `/stats` do górnego navbara (`app/(app)/layout.tsx`) i do `components/bottom-nav.tsx`.

## 8. Kolejność wdrożenia

1. Migracja DB — tabela `match_odds` (+ RLS).
2. `lib/stats.ts` z testami (TDD) — bilans i pozostałe statystyki na danych fikstur.
3. Strona `/stats` + komponenty + nawigacja (na danych z bazy; działa nawet bez kursów —
   pokazuje statystyki nie-pieniężne i adnotację).
4. Scraper Playwright + mapowanie drużyn.
5. Uruchomienie scrapera → zapis kursów → weryfikacja bilansu na realnych danych.

## 9. Poza zakresem (YAGNI)

- Automatyczny/serverless harvesting kursów (cron na Vercel) — scraper jest lokalny i ręczny.
- Łamanie szyfrowania feedu OddsPortal bez przeglądarki.
- Panel admina do ręcznej edycji kursów (tabela jest edytowalna bezpośrednio w Supabase, gdyby
  zaszła potrzeba korekty).
- Kursy na rynki inne niż correct-score.
```
