-- Avatar bucket policies (po utworzeniu bucketu "avatars" jako public)
-- Plik wgrać po insert into storage.buckets values ('avatars', 'avatars', true);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Read: każdy może pobrać avatar (bucket public, ale i tak dodajemy policy)
create policy "avatars read public" on storage.objects
  for select to public using (bucket_id = 'avatars');

-- Write/update/delete: tylko właściciel pliku ({user_id}/...)
create policy "avatars write own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
