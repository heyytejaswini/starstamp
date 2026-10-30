-- ===== 1. usernames =====
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

alter table profiles enable row level security;

drop policy if exists "profiles are public" on profiles;
create policy "profiles are public" on profiles
  for select using (true);

drop policy if exists "insert own profile" on profiles;
create policy "insert own profile" on profiles
  for insert with check (id = (select auth.uid()));

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ===== 2. stars: hidden flag, unlock date, author =====
alter table stars add column if not exists hidden boolean not null default false;
alter table stars add column if not exists unlock_at timestamptz;
alter table stars add column if not exists author_id uuid
  references auth.users(id) on delete cascade;

-- fill in the stars that already exist
update stars s
set unlock_at = l.unlock_at, author_id = l.author_id
from letters l
where l.id = s.letter_id;

-- copy them automatically for every new star
create or replace function stars_copy_from_letter() returns trigger
language plpgsql as $$
begin
  select l.unlock_at, l.author_id
    into new.unlock_at, new.author_id
    from letters l
    where l.id = new.letter_id;
  return new;
end $$;

drop trigger if exists stars_copy_from_letter on stars;
create trigger stars_copy_from_letter
  before insert on stars
  for each row execute function stars_copy_from_letter();

-- hidden stars vanish for everyone except their writer
drop policy if exists "stars read" on stars;
create policy "stars read" on stars for select using (
  not hidden or author_id = (select auth.uid())
);

-- ===== 3. who may read a public letter =====
drop policy if exists "letters read" on letters;
create policy "letters read" on letters for select using (
  author_id = (select auth.uid())
  or (
    is_public and unlock_type = 'date' and unlock_at <= now()
    and exists (select 1 from stars s where s.letter_id = letters.id)
  )
);

drop policy if exists "body read" on letter_bodies;
create policy "body read" on letter_bodies for select using (
  exists (
    select 1 from letters l
    where l.id = letter_bodies.letter_id
      and (
        (l.author_id = (select auth.uid())
          and (l.status = 'opened'
               or (l.unlock_type = 'date' and l.unlock_at <= now())))
        or (l.is_public and l.unlock_type = 'date' and l.unlock_at <= now())
      )
  )
);

-- ===== 4. lights: allow taking one back =====
drop policy if exists "lights take back" on lights;
create policy "lights take back" on lights
  for delete using (giver_id = (select auth.uid()));

-- ===== 5. reports: one per person, auto-hide at 7 =====
alter table reports drop constraint if exists reports_one_per_person;
alter table reports add constraint reports_one_per_person
  unique (star_id, reporter_id);

create or replace function hide_reported_star() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reports where star_id = new.star_id) >= 7 then
    update stars set hidden = true where id = new.star_id;
  end if;
  return new;
end $$;

drop trigger if exists reports_auto_hide on reports;
create trigger reports_auto_hide
  after insert on reports
  for each row execute function hide_reported_star();

  /* git add . && git commit -m "Add profiles, hidden stars, public read rules, report limits"  */