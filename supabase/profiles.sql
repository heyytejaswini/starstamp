create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

alter table profiles enable row level security;

create policy "profiles are public" on profiles
  for select using (true);

create policy "insert own profile" on profiles
  for insert with check (id = (select auth.uid()));

create policy "update own profile" on profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

/* git add . && git commit -m "Add profiles table for usernames" */