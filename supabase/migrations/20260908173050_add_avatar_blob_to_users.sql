-- Avatar stored as raw binary (bytea) directly in the row, per Sergey's explicit choice --
-- NOT a Supabase Storage URL reference, which is what PairSec_Спецификация_Final_2026.docx
-- §10.1's `photo_url text -- Supabase Storage` field assumed. avatar_content_type is needed
-- client-side to rebuild a usable image (Blob/object URL) from the raw bytes -- bytea alone
-- carries no MIME info.
alter table public.users
  add column avatar bytea,
  add column avatar_content_type text;
