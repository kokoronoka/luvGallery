-- LuvGallery — Supabase schema v2 (multi-timeline + friend connections)
-- This REPLACES the v1 schema (entries/people/settings/timelines are dropped
-- and recreated). Run the whole file once in SQL Editor → New query → Run.
-- Safe to re-run except for the DROP TABLE block, which only needs to run once.

-- ============ Profiles (mirrors auth.users email so we can look people up) ============
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  display_name text,
  avatar       text,
  created_at   timestamptz default now()
);
alter table profiles add column if not exists avatar text;
alter table profiles enable row level security;
drop policy if exists "Authenticated users can read profiles" on profiles;
create policy "Authenticated users can read profiles" on profiles for select
  using (auth.role() = 'authenticated');
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update
  using (auth.uid() = id);
alter table profiles replica identity full;

-- Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts created before this trigger existed
insert into public.profiles (id, email, display_name)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ============ Fresh start for the relationship-scoped tables ============
drop table if exists entries cascade;
drop table if exists people cascade;
drop table if exists settings cascade;
drop table if exists timelines cascade;

-- ============ Timelines (exactly 2 members) ============
create table timelines (
  id          text primary key,
  user_a      uuid references auth.users(id) on delete cascade not null,
  user_b      uuid references auth.users(id) on delete cascade not null,
  label       text not null default 'friend',   -- partner | family | friend
  template    text not null default 'love',      -- love | family | friends
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  constraint timelines_distinct_members check (user_a <> user_b)
);
create unique index if not exists timelines_unique_pair
  on timelines (least(user_a, user_b), greatest(user_a, user_b));

alter table timelines enable row level security;
create policy "Members can view their timelines" on timelines for select
  using (auth.uid() = user_a or auth.uid() = user_b);
create policy "Members can insert their timelines" on timelines for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);
create policy "Members can update their timelines" on timelines for update
  using (auth.uid() = user_a or auth.uid() = user_b);
create policy "Members can delete their timelines" on timelines for delete
  using (auth.uid() = user_a or auth.uid() = user_b);
alter table timelines replica identity full;

-- ============ Invitations (add a friend by email → accept/reject) ============
create table if not exists invitations (
  id              text primary key,
  sender_id       uuid references auth.users(id) on delete cascade not null,
  recipient_email text not null,
  recipient_id    uuid references auth.users(id) on delete set null,
  label           text not null default 'friend',
  status          text not null default 'pending',
  timeline_id     text references timelines(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  constraint invitations_status_check check (status in ('pending','accepted','rejected','cancelled'))
);
alter table invitations enable row level security;
drop policy if exists "Sender can view sent invitations" on invitations;
create policy "Sender can view sent invitations" on invitations for select
  using (auth.uid() = sender_id);
drop policy if exists "Recipient can view received invitations" on invitations;
create policy "Recipient can view received invitations" on invitations for select
  using (lower(recipient_email) = lower((select email from profiles where id = auth.uid())));
drop policy if exists "Sender can create invitations" on invitations;
create policy "Sender can create invitations" on invitations for insert
  with check (auth.uid() = sender_id);
drop policy if exists "Sender can update sent invitations" on invitations;
create policy "Sender can update sent invitations" on invitations for update
  using (auth.uid() = sender_id);
drop policy if exists "Recipient can update received invitations" on invitations;
create policy "Recipient can update received invitations" on invitations for update
  using (lower(recipient_email) = lower((select email from profiles where id = auth.uid())));
alter table invitations replica identity full;

-- ============ Entries (moments) — scoped to a timeline, visible to both members ============
create table entries (
  id          text primary key,
  timeline_id text references timelines(id) on delete cascade not null,
  created_by  uuid references auth.users(id) not null,
  date_time   timestamptz not null,
  note        text default '',
  people_ids  jsonb default '[]'::jsonb,  -- which member(s) this moment is about (user ids)
  images      jsonb default '[]'::jsonb,  -- [{ id, path }] — path points into Storage
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table entries enable row level security;
create policy "Timeline members can view entries" on entries for select
  using (exists (select 1 from timelines t where t.id = entries.timeline_id and (auth.uid() = t.user_a or auth.uid() = t.user_b)));
create policy "Timeline members can insert entries" on entries for insert
  with check (exists (select 1 from timelines t where t.id = entries.timeline_id and (auth.uid() = t.user_a or auth.uid() = t.user_b)));
create policy "Timeline members can update entries" on entries for update
  using (exists (select 1 from timelines t where t.id = entries.timeline_id and (auth.uid() = t.user_a or auth.uid() = t.user_b)));
create policy "Timeline members can delete entries" on entries for delete
  using (exists (select 1 from timelines t where t.id = entries.timeline_id and (auth.uid() = t.user_a or auth.uid() = t.user_b)));
alter table entries replica identity full;

-- ============ Realtime ============
do $$ begin
  alter publication supabase_realtime add table profiles;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table timelines;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table invitations;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table entries;
exception when duplicate_object then null; end $$;

-- ============ Storage: photos scoped by TIMELINE, not by uploader ============
-- Bucket "luvgallery-photos" must already exist (Storage → New bucket, private).
-- Path layout is now: {timeline_id}/{entry_id}/{image_id}.ext — both members
-- of the timeline can read/write it, not just whoever uploaded it.

drop policy if exists "Users can manage own photos" on storage.objects;
drop policy if exists "Timeline members can manage photos" on storage.objects;
create policy "Timeline members can manage photos"
on storage.objects for all
using (
  bucket_id = 'luvgallery-photos'
  and exists (
    select 1 from timelines t
    where t.id = (storage.foldername(name))[1]
      and (auth.uid() = t.user_a or auth.uid() = t.user_b)
  )
)
with check (
  bucket_id = 'luvgallery-photos'
  and exists (
    select 1 from timelines t
    where t.id = (storage.foldername(name))[1]
      and (auth.uid() = t.user_a or auth.uid() = t.user_b)
  )
);
