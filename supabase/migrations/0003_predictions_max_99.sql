-- Podnieś limit typów z 30 do 99 bramek

alter table public.predictions
  drop constraint if exists predictions_pred1_check,
  drop constraint if exists predictions_pred2_check;

alter table public.predictions
  add constraint predictions_pred1_check check (pred1 >= 0 and pred1 <= 99),
  add constraint predictions_pred2_check check (pred2 >= 0 and pred2 <= 99);
