drop policy if exists "letters delete" on letters;

create policy "letters delete unlocked" on letters for delete
  using (
    author_id = (select auth.uid())
    and (status = 'opened'
         or (unlock_type = 'date' and unlock_at <= now()))
  );