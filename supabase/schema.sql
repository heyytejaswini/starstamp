--Query 1--
create table letters (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  unlock_type text not null check (unlock_type in ('date','rain')),
  unlock_at timestamptz,
  city text,
  is_public boolean not null default false,
  status text not null default 'sealed' check (status in ('sealed','opened')),
  reply_to uuid references letters(id) on delete set null,
  created_at timestamptz not null default now(),
  opened_at timestamptz
);

create table letter_bodies (
  letter_id uuid primary key references letters(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000)
);

create table stars (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null unique references letters(id) on delete cascade,
  x real not null check (x between 0 and 1),
  y real not null check (y between 0 and 1),
  hue int not null check (hue between 0 and 360),
  created_at timestamptz not null default now()
);

create table lights (
  star_id uuid not null references stars(id) on delete cascade,
  giver_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (star_id, giver_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  star_id uuid not null references stars(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

--Query 2--
alter table letters enable row level security;
alter table letter_bodies enable row level security;
alter table stars enable row level security;
alter table lights enable row level security;
alter table reports enable row level security;

-- letters: you see your own, plus public letters that have opened
create policy "letters read" on letters for select
  using (author_id = (select auth.uid()) or (is_public and status = 'opened'));
create policy "letters create" on letters for insert
  with check (author_id = (select auth.uid()) and status = 'sealed');
create policy "letters delete" on letters for delete
  using (author_id = (select auth.uid()));

-- text: only readable once the letter may open (or it is public and opened)
create policy "body read" on letter_bodies for select using (
  exists (
    select 1 from letters l
    where l.id = letter_bodies.letter_id
      and ((l.is_public and l.status = 'opened')
        or (l.author_id = (select auth.uid())
            and (l.status = 'opened'
                 or (l.unlock_type = 'date' and l.unlock_at <= now()))))
  )
);
create policy "body create" on letter_bodies for insert with check (
  exists (select 1 from letters l
          where l.id = letter_id and l.author_id = (select auth.uid()))
);

-- stars: everyone sees them, you create one only for your own public letter
create policy "stars read" on stars for select using (true);
create policy "stars create" on stars for insert with check (
  exists (select 1 from letters l
          where l.id = letter_id and l.author_id = (select auth.uid()) and l.is_public)
);

-- lights and reports
create policy "lights read" on lights for select using (true);
create policy "lights give" on lights for insert with check (giver_id = (select auth.uid()));
create policy "reports create" on reports for insert with check (reporter_id = (select auth.uid()));

-- live shooting stars
alter publication supabase_realtime add table stars;