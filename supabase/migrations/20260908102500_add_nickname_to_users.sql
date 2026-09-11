-- Both open questions from PuzzleStow_MVP_Site_Spec_Addendum_Registration.docx §7
-- resolved by Sergey (2026-09-08, chat): no 18+ gate needed on PuzzleStow's own
-- registration -- PairSec already screens for 18+ on the shared account, so no
-- column added here for that. Nickname: yes -- matches the already-built
-- "Nickname" field + "Use nickname" checkbox in both AuthPage (Create Account
-- form) and ProfilePage (Account Settings > Identity) in App.tsx.

alter table public.users
  add column nickname text,
  add column use_nickname boolean not null default false;

comment on column public.users.nickname is
  'Optional PuzzleStow-only display nickname (AuthPage/ProfilePage "Nickname" field). Null until the user sets one.';
comment on column public.users.use_nickname is
  'Whether nickname replaces display name on PuzzleStow leaderboards/match history/badges (AuthPage/ProfilePage "Use nickname" checkbox, default off). Never affects PairSec identity display -- PairSec relies on transparent identity for in-person services.';

-- Registration flow now also seeds nickname / use_nickname from signUp()
-- metadata, same mechanism as name / agreed_to_terms_at.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, name, nickname, use_nickname, agreed_to_terms_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    nullif(new.raw_user_meta_data ->> 'nickname', ''),
    coalesce((new.raw_user_meta_data ->> 'use_nickname')::boolean, false),
    (new.raw_user_meta_data ->> 'agreed_to_terms_at')::timestamptz
  );
  return new;
end;
$$;
