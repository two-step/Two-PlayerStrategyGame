-- TO_DO 31 (2026-11-20): the play page reads its feature flags from app_config
-- (Sergey: «для отключения можно использовать config, заполняемый в Admin page»).
-- Only `game.%` keys become public — timers, fixed tier, difficulty. Writes stay
-- admin-only; every non-game key stays invisible to non-admins.
create policy "public read game flags"
  on public.app_config for select
  to anon, authenticated
  using (key like 'game.%');

comment on policy "public read game flags" on public.app_config is
  'TO_DO 31: players read game.* flags (timers/tier/difficulty) without being admins; writes remain admin-only.';
