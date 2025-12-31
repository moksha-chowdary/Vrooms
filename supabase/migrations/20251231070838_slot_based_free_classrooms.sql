BEGIN;

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

create table if not exists public.free_classrooms (
  id uuid primary key default gen_random_uuid(),
  slot text not null,
  block text not null,
  room text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Prevent duplicate entries for the same slot+room
create unique index if not exists free_classrooms_slot_block_room_key
  on public.free_classrooms (slot, block, room);

create index if not exists free_classrooms_slot_idx
  on public.free_classrooms (slot);

-- Public write (v1 has no auth). We'll still use RLS for explicit policies.
alter table public.free_classrooms enable row level security;

drop policy if exists "public can read" on public.free_classrooms;
drop policy if exists "public can insert" on public.free_classrooms;
drop policy if exists "public can delete" on public.free_classrooms;
drop policy if exists "public can update" on public.free_classrooms;

create policy "public can read"
  on public.free_classrooms
  for select
  to anon, authenticated
  using (true);

create policy "public can insert"
  on public.free_classrooms
  for insert
  to anon, authenticated
  with check (true);

create policy "public can delete"
  on public.free_classrooms
  for delete
  to anon, authenticated
  using (true);

create policy "public can update"
  on public.free_classrooms
  for update
  to anon, authenticated
  using (true)
  with check (true);

COMMIT;