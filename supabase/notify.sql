alter table public.letters
  add column if not exists notified_at timestamptz;

/* Query 2 */

update public.letters
set notified_at = now()
where unlock_type = 'date' and unlock_at <= now() and notified_at is null;