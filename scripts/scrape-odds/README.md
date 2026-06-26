# Zbieranie kursów correct-score (OddsPortal → Supabase)

> **Dla asystenta / CI:** to jest kanoniczna strategia. Przeczytaj ten plik
> ZAWSZE, zanim zaczniesz zbierać kursy meczów. Strategia została zweryfikowana
> na żywo (czerwiec 2026): pełny backfill dał ~830 wierszy / 27 meczów.

## TL;DR — jak odpalić

```bash
# Wymaga: zainstalowany Google Chrome + .env.local z kluczami Supabase (poniżej)
npm run scrape:odds
```

Skrypt jest **idempotentny** (upsert po `match_id,scoreline`) — można go odpalać
wielokrotnie; dociąga brakujące/nowe kursy bez duplikatów.

Tryb debug (widoczne okno + dump pierwszego meczu):

```bash
HEADFUL=1 SCRAPE_DEBUG=1 MATCH_LIMIT=1 npm run scrape:odds
```

Zmienne sterujące:
- `HEADFUL=1` — pokaż okno przeglądarki (domyślnie headless).
- `SCRAPE_DEBUG=1` — wypisz dla 1. meczu wyciągnięte nazwy drużyn + kursy.
- `MATCH_LIMIT=N` — ogranicz do pierwszych N linków (szybki smoke test).

## Wymagania

- **Google Chrome** zainstalowany lokalnie (Playwright `channel: "chrome"`).
  Powód: OddsPortal blokuje zwykłe headless Chromium **HTTP 503** (detekcja
  botów). Realny Chrome przechodzi. Fallback do bundled chromium jest w kodzie,
  ale bywa blokowany.
- `.env.local` z:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (zapis omija RLS — tabela `match_odds` nie ma
    polityki write).
- Playwright (`devDependency`, już w repo). Jeśli brak Chrome:
  `npx playwright install chromium` (gorzej — patrz wyżej).

## Jak to działa (kluczowe obejścia)

1. **Strona wyników (geo PL):**
   `https://www.oddsportal.com/pl/football/world/mistrzostwa-swiata-2026/results/`
   - OddsPortal przekierowuje klienta z PL na ścieżkę `/pl/`; **angielski slug
     404-uje**. Dlatego startujemy od polskiego URL-a (`mistrzostwa-swiata-2026`).
2. **Linki meczów:** prowadzą do `/football/h2h/<a>/<b>/`. Zbieramy je
   **przewijając** stronę do końca (lazy-load), aż liczba linków przestanie rosnąć.
3. **Rynek correct-score:** strona meczu trzyma w `location.hash` id rynku w
   formacie `#<ID>:1X2;2`. Samo ustawienie `location.hash` **nie przełącza** rynku
   (SPA ma własny router). Trzeba:
   1. wczytać `/football/h2h/<a>/<b>/`,
   2. odczytać `<ID>` z domyślnego hasha,
   3. **świeżo nawigować** do `<url>#<ID>:cs;2`.
4. **Mapowanie meczu — po DACIE+GODZINIE (NIE po nazwach):** nazwy drużyn są
   zawodne — `document.title` bywa raz po angielsku, raz po polsku, a nazwy się
   różnią (`"Bosnia & Herzegovina"` vs `"Bosnia and Herzegovina"`). Dlatego:
   - strefa przeglądarki = **UTC**, więc czas meczu ze strony == `kickoff_at`
     z bazy (w bazie kickoff_at jest unikalny dla meczu),
   - datę bierzemy z **nagłówka meczu** (pomijając panel boczny), parsujemy
     `parseUtcMinute` (PL+EN skróty miesięcy) → `"YYYY-MM-DDTHH:MM"`,
   - dopasowujemy mecz z bazy po tej minucie,
   - **orientację scoreline i poprawność dopasowania** potwierdzamy WYNIKIEM
     końcowym (`orientByResult`): wynik OddsPortal `gospodarz:gość` musi się
     zgadzać z `team1:team2` w którejś orientacji (inaczej to nie ten mecz).
   Logika jest czysta i otestowana: `scripts/scrape-odds/parsing.ts`
   (`parseUtcMinute`, `orientByResult`) + `parsing.test.ts`.
5. **Parsowanie kursów:** każdy wiersz to scoreline + kurs dziesiętny
   (`"1:0  …  7.00"`). Rzadkie wyniki: `"Inny wynik"/"OTHER"`.
6. **Zapis:** upsert do `public.match_odds` (`match_id, scoreline, odds, source`),
   scoreline w perspektywie `team1:team2` (jeśli gospodarz OddsPortal = nasze
   `team2`, scoreline jest odwracany przez `flipScoreline`).

Plik: `scripts/scrape-odds/index.ts` (I/O) + `scripts/scrape-odds/parsing.ts`
(czyste helpery, testowane: `parsing.test.ts`).

## Pułapki / na co uważać

- **Bundled chromium = 503.** Zawsze realny Chrome (`channel: "chrome"`).
- **Geo-redirect.** Używaj polskiego URL-a wyników.
- **Flaky network.** SPA bywa kapryśna — w kodzie są retry (`gotoWithRetry`,
  `safeEval`). Pojedynczy mecz potrafi się nie doczytać; ponowny przebieg go dobierze.
- **Buforowanie stdout.** Przy uruchomieniu nie-TTY (CI/background) logi nie
  pojawiają się na bieżąco. **Postęp sprawdzaj zapytaniem do bazy**, nie po stdout.
- **Rozbieżność fikstur.** Mecz mapuje się tylko, gdy istnieje **i** w bazie
  (`status = 'FINISHED'`), **i** na OddsPortal, o **tej samej godzinie**, z **tym
  samym wynikiem**. Mecze pucharowe z demo-drabinki, które różnią się od realnych
  par OddsPortal, mają inny wynik/godzinę → pomijane (log „brak dopasowania").
  To oczekiwane i bezpieczne (nie przypiszemy kursów do złego meczu).
- **Throttling OddsPortal.** Po intensywnym scrapowaniu z jednego IP strona
  potrafi przestać renderować kursy (puste strony, `kursy=0` dla wszystkich).
  To przejściowe — odczekaj / odpal z innego łącza. Diagnostyka jednego meczu:
  `MATCH_URL="<url h2h>" SCRAPE_DEBUG=1 npm run scrape:odds`.

## Weryfikacja po przebiegu

```bash
# Liczba wierszy + pokrytych meczów (skrypt pomocniczy ad-hoc — patrz niżej)
```

Sensowne sprawdzenia:
- `select count(*) from match_odds;` oraz `count(distinct match_id)`.
- **Pokrycie bilansu:** ile zakończonych meczów ma kurs dla *faktycznego* wyniku
  (`"{result1}:{result2}"` lub `OTHER`) — tylko te liczą się do bilansu na `/stats`.
- Spot-check orientacji: weź znany mecz (np. Turkey 0-1 Paraguay) i sprawdź, czy
  kurs `0:1` odpowiada realnemu rezultatowi.

Przykładowy skrypt weryfikujący można złożyć ad-hoc na bazie `lib/stats.ts`
(`computeAllStats`, `oddsCoverage`) — nie commitujemy go na stałe.

## Wskazówki pod CI (gdy zrobimy automat)

- Runner z **Google Chrome** (np. GitHub Actions: `browser-actions/setup-chrome`
  lub obraz z Chrome) — `channel: "chrome"`.
- `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` jako **sekrety**.
- Idempotentność → bezpieczne ponawianie; można odpalać po cronie w trakcie turnieju.
- Skrypt sam kończy się kodem ≠ 0 przy twardym błędzie (brak kluczy, brak strony).
  Pojedyncze pominięte mecze nie przerywają przebiegu (raport „zapisano / pominięto").
- Rozważ retry całego joba (network flakiness) + krótki `MATCH_LIMIT` smoke test
  jako gate przed pełnym przebiegiem.
