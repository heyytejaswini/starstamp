-- 1. A place to remember which envelope each letter was sealed in
alter table public.letters
  add column if not exists envelope jsonb not null default '{}'::jsonb;

-- 2. Let the author change ONLY that one column of their own letters.
--    (Everything else, like the unlock date, stays locked, so nobody can open a letter early.)
revoke update on public.letters from anon, authenticated;
grant update (envelope) on public.letters to authenticated;

drop policy if exists "Authors can set their envelope" on public.letters;
create policy "Authors can set their envelope"
  on public.letters
  for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
