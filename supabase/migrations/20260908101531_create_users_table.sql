-- users: PuzzleStow account profile, extends Supabase Auth (auth.users).
-- Shared with PairSec per PairSec_Спецификация_Final_2026.docx §8.0 -- one
-- Supabase Auth id serves both puzzlestow.com and pairsec.com.
-- Spec: PuzzleStow_MVP_Site_Spec_Addendum_Registration.docx,
-- PuzzleStow_MVP_DB_Diagram.docx §2.

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  telegram_id bigint unique,
  game_qualification text not null default 'UnderLodar',
  agreed_to_terms_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.users is
  'PuzzleStow account profile, 1:1 with auth.users. Registration addendum (PuzzleStow_MVP_Site_Spec_Addendum_Registration.docx) §5.';
comment on column public.users.game_qualification is
  'Denormalized game tier, defaults to UnderLodar on signup per addendum §5.1. Full Elo formula not yet specified (pending PuzzleStow_Спецификация.docx).';
comment on column public.users.telegram_id is
  'Set when the account is linked via the Telegram Login Widget (addendum §2). Null for email-only accounts.';
comment on column public.users.agreed_to_terms_at is
  'Timestamp of the mandatory terms/offer checkbox at registration (addendum §3). Required -- signup fails without it.';

alter table public.users enable row level security;

create policy "Users can view their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

-- Auto-create the profile row right after Supabase Auth creates the account,
-- per addendum §5 step 1. The client passes `name` / `agreed_to_terms_at` as
-- signUp() metadata (options.data); Telegram-linked signups set telegram_id
-- separately once that flow is wired up. Direct client inserts into
-- public.users are intentionally not allowed -- only this trigger may create
-- a row, so no insert policy is defined above.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, name, agreed_to_terms_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    (new.raw_user_meta_data ->> 'agreed_to_terms_at')::timestamptz
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
