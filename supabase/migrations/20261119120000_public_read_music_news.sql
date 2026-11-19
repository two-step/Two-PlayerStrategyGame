-- TO_DO item 29 (номер сверен по TO_DO.docx): «Подключить музыку. Оживить Админ
-- страницу. Проверить все ссылки на "живучесть"».
--
-- Purpose: the real background player and the public news line must READ the
-- admin-entered content tables, but the original 20260911121500 policies allow
-- only admins to touch music_tracks / news_items. Anon+authenticated visitors
-- get SELECT access here; writes stay admin-only.
--
-- Invariants:
-- - news_items: only rows with is_active = true are publicly visible.
-- - music_tracks: fully public to read (no secrets in it); write path unchanged
--   (the "Admins manage music tracks" FOR ALL policy still guards mutations).
-- - app_config stays admin-only: it may hold values not meant for visitors.

create policy "Anyone reads music tracks"
  on public.music_tracks for select
  using (true);

create policy "Anyone reads active news"
  on public.news_items for select
  using (is_active = true);
