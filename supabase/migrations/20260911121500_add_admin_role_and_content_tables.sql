-- Sergey (2026-09-11, chat): Admin page for entering flexible/auxiliary site content --
-- config variables, current music track(s), and news-line items -- gated to an
-- "Administrator" role. Nothing here wires the music player or a public news ticker
-- yet (both still deferred per PuzzleStow_Site_Fix_Request_v3.md BACKLOG); this only
-- gives the admin a place to enter/store that content and locks it down at the DB
-- level, not just in the UI.

-- 1. Role on public.users. Plain user by default; only ever set to Administrator
--    manually (no self-serve promotion path).
alter table public.users
  add column role text not null default 'user'
  constraint users_role_check check (role in ('user', 'Administrator'));

comment on column public.users.role is
  'Access role. ''user'' (default) or ''Administrator'' -- Administrator unlocks the Admin page (config variables, music tracks, news-line items). Set manually; no self-serve promotion.';

-- Seed the owner's own account as Administrator -- otherwise nobody could reach the
-- Admin page this migration is unlocking.
update public.users set role = 'Administrator'
where id = '2059ff26-5615-494d-b0b2-48765fc93cdb';

-- 2. is_admin() -- security definer helper so RLS policies on the tables below can
--    check the caller's role without each policy re-querying public.users under its
--    own (recursive) RLS.
create function public.is_admin(uid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where id = uid and role = 'Administrator'
  );
$$;

comment on function public.is_admin(uuid) is
  'True if uid belongs to an Administrator. Security definer so RLS policies on app_config/music_tracks/news_items can check this without recursive RLS on public.users.';

revoke execute on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to anon, authenticated;

-- 3. Config variables -- flexible key/value store for whatever the admin needs to
--    park without a schema change (feature flags, copy snippets, external IDs, etc).
create table public.app_config (
  key text primary key,
  value text,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

comment on table public.app_config is
  'Flexible admin-entered key/value config, e.g. feature flags or copy snippets. Admin-only read/write -- not fetched by ordinary pages yet.';

alter table public.app_config enable row level security;

create policy "Admins manage config"
  on public.app_config for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 4. Music tracks -- which track is assigned to which page/section, and which is
--    "current". Real audio files and playback wiring are still pending (BACKLOG);
--    this is the admin data entry side only.
create table public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  page text,
  is_current boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.music_tracks is
  'Admin-entered music tracks and which page/section each is assigned to, per the Part C nav music-toggle backlog item. Admin-only read/write -- not yet consumed by a real player.';
comment on column public.music_tracks.page is
  'Page/section this track is assigned to (matches the app''s Page values, e.g. home/play/lore), or null for unassigned/global.';
comment on column public.music_tracks.is_current is
  'Marks the track currently featured for its page -- admin-set, not enforced unique per page at the DB level.';

alter table public.music_tracks enable row level security;

create policy "Admins manage music tracks"
  on public.music_tracks for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 5. News-line items -- short messages for a future news ticker (not yet built).
create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.news_items is
  'Admin-entered items for a future news-line/ticker (not yet built on any public page). Admin-only read/write for now.';

alter table public.news_items enable row level security;

create policy "Admins manage news items"
  on public.news_items for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
