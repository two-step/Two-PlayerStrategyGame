-- Sergey (2026-09-11, chat): add an opt-in "send me news and updates" checkbox to the
-- Sign Up form and Profile > Account Settings, sharing one column between the two
-- (checking/unchecking either updates the same subscription state). Same mechanism
-- as nickname/use_nickname: seeded from signUp() metadata via handle_new_user(),
-- editable afterwards via the normal public.users update path.

alter table public.users
  add column subscribed_to_news boolean not null default false;

comment on column public.users.subscribed_to_news is
  'Opt-in for PuzzleStow news/updates emails. Set at signup (AuthPage "Send me news and updates" checkbox) or later from ProfilePage > Account Settings; both controls read/write this same column.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, name, nickname, use_nickname, subscribed_to_news, agreed_to_terms_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    nullif(new.raw_user_meta_data ->> 'nickname', ''),
    coalesce((new.raw_user_meta_data ->> 'use_nickname')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'subscribed_to_news')::boolean, false),
    (new.raw_user_meta_data ->> 'agreed_to_terms_at')::timestamptz
  );
  return new;
end;
$$;
