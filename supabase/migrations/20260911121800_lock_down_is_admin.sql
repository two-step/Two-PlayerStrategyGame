-- Security advisor flagged public.is_admin(uid uuid) as callable by anon/authenticated
-- via PostgREST RPC (/rest/v1/rpc/is_admin) with an arbitrary uid argument -- that lets
-- anyone probe whether some OTHER user id is an Administrator, which is more than the
-- RLS policies actually need (they only ever check the current caller). Replace it with
-- a zero-argument is_admin() that reads auth.uid() internally, so a caller can only ever
-- learn their own admin status.

drop policy "Admins manage config" on public.app_config;
drop policy "Admins manage music tracks" on public.music_tracks;
drop policy "Admins manage news items" on public.news_items;

drop function public.is_admin(uuid);

create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'Administrator'
  );
$$;

comment on function public.is_admin() is
  'True if the calling user (auth.uid()) is an Administrator. No-argument on purpose -- callers can only check their own status, never probe another user id. Security definer so it can read public.users without recursive RLS.';

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create policy "Admins manage config"
  on public.app_config for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage music tracks"
  on public.music_tracks for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage news items"
  on public.news_items for all
  using (public.is_admin())
  with check (public.is_admin());
