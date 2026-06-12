# Auto-zaliczanie typów bez ręcznego zatwierdzania

**Data:** 2026-06-12
**Status:** zatwierdzony przez Piotra

## Problem

Punkty naliczają się tylko dla typów z ustawionym `confirmed_at` (przycisk
"Zatwierdź typy"). Użytkownicy zapominają go kliknąć — typ zapisany
autosave'em wygląda w siatce jak trafienie (zielona komórka, tooltip
"3 pkt"), ale do rankingu liczy się 0. Realny przypadek: Zboro Cwaniak,
Mexico 2:0 South Africa, typ 2:0, `confirmed_at = null`, 0 pkt zamiast 3.

## Decyzja

Potwierdzanie typów znika całkowicie. Typ zapisany w momencie startu meczu
jest z definicji ostateczny — RLS (`predictions insert/update own
pre-kickoff`) i tak blokuje zmiany po kick-offie, więc osobny krok
"zatwierdź" nie niesie żadnej informacji.

Przycisk "Zatwierdź typy" usuwamy z obu widoków (decyzja produktowa:
wariant "usunąć całkowicie", nie "zostawić jako UX").

## Zmiany

1. **Migracja `0007_drop_confirmation_requirement.sql`** — `create or
   replace view prediction_points` bez warunków na `confirmed_at`
   (punkty i `exact_hit` zależą tylko od `status = 'FINISHED'`
   i niepustych wyników). Kolumna `predictions.confirmed_at` zostaje
   w tabeli — nic jej nie czyta, zero ryzyka migracji danych.
   Leaderboard (zwykły widok) przelicza się w locie — bez backfilla,
   zaległe punkty (Zboro) pojawią się natychmiast.
2. **`lib/scoring.ts`** — usunięcie `confirmedAt` z typu `Prediction`
   i warunku `if (!pred.confirmedAt) return 0`; aktualizacja
   `scoring.test.ts` (TDD).
3. **UI / akcje** — usunięcie: akcji `confirmAllPredictions`
   (`app/(app)/actions.ts`), przycisków "Zatwierdź typy"
   (`matches-board.tsx`, `predictions-matrix.tsx`), propa `confirmed`
   i jego stylowania (`prediction-cell.tsx`), przekazywania
   `confirmed_at` (`match-card.tsx`), pola `confirmed_at` z selecta
   (`lib/data.ts`) i typu `PredictionRow` (`lib/types.ts`).
4. **Wdrożenie** — SQL ręcznie w Supabase SQL editor (projekt nie jest
   zlinkowany z CLI), kod przez normalny deploy.

## Zachowanie po zmianie

Kolorowanie komórek siatki (zielony/pomarańczowy/szary) zawsze odpowiada
realnie naliczonym punktom. Nie istnieje stan "wpisane, ale nieliczone".
