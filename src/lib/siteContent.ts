// siteContent — TO_DO item 29 (номер сверен по TO_DO.docx): «Подключить музыку.
// Оживить Админ страницу…».
//
// Purpose: public read access to the two admin-entered content tables that the
// site now consumes for real (MVP: stubs prohibited):
// - music_tracks  → per-page background-music overrides for useSiteMusic;
// - news_items    → messages for the news ticker under the nav.
//
// Preconditions:
// - RLS must allow public SELECT (migration 20261119120000). Before it is
//   applied, reads fail for non-admins — the hooks degrade to empty results and
//   the app falls back to the bundled defaults; nothing throws.
//
// Postconditions:
// - Every failure surfaces as loaded=true with empty data + an error string;
//   the UI decides how to present it.
//
// Invariants:
// - Pure read-only consumers; this module never writes.
// - No default exports, no classes, no enum (AGENTS.md §5).

import { useEffect, useState } from "react"
import { supabase } from "./supabaseClient"

/** One page-specific music override: `page` plays `url` instead of the default. */
export interface MusicOverride {
  page: string
  url: string
  title: string
}

/** One ticker message from news_items. */
export interface NewsMessage {
  id: string
  message: string
}

/**
 * Fetch the per-page music overrides the admin has made current.
 * Precondition: public SELECT on music_tracks (see module header).
 * Postcondition: at most one override per page (last current row wins).
 * Invariant: rows without page or url are ignored — they cannot be played.
 */
export function useMusicOverrides(): {
  overrides: MusicOverride[]
  error: string | null
} {
  const [overrides, setOverrides] = useState<MusicOverride[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from("music_tracks")
      .select("title, url, page, is_current")
      .eq("is_current", true)
      .order("updated_at", { ascending: true })
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e !== null) {
          setError(e.message)
          return
        }
        const rows = (data as Array<{ title: string; url: string | null; page: string | null }>) ?? []
        const byPage = new Map<string, MusicOverride>()
        for (const r of rows) {
          if (r.page === null || r.url === null || r.url === "") continue
          byPage.set(r.page, { page: r.page, url: r.url, title: r.title })
        }
        setOverrides([...byPage.values()])
      })
    return () => { cancelled = true }
  }, [])

  return { overrides, error }
}

/**
 * Fetch active news-line messages for the public ticker.
 * Precondition: public SELECT on news_items filtered by is_active (migration).
 * Postcondition: messages ordered by sort_order, capped to keep the ticker light.
 * Invariant: empty result is a normal state, not an error.
 */
export function useActiveNews(limit = 12): {
  items: NewsMessage[]
  error: string | null
} {
  const [items, setItems] = useState<NewsMessage[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from("news_items")
      .select("id, message")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(limit)
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e !== null) {
          setError(e.message)
          return
        }
        setItems((data as NewsMessage[]) ?? [])
      })
    return () => { cancelled = true }
  }, [limit])

  return { items, error }
}

/** Feature flags for the play page, read from the admin-editable app_config table
 * (TO_DO 31). Only keys prefixed `game.` are public (migration 20261120100000);
 * anything else stays admin-only and invisible here.
 * Preconditions: RLS allows public SELECT on `key like 'game.%'`.
 * Postconditions: failures/absent rows degrade to the documented defaults —
 * timers off, UnderLodar, easy engine. Never throws.
 * Invariants: read-only consumer; the admin CONFIG VARIABLES section owns writes. */
export interface GameFlags {
  timersEnabled: boolean
  tierId: number
  difficulty: "easy" | "medium" | "hard"
}

/** Defaults when the config rows are missing or unreadable (Sergey, 2026-11-20:
 * timers are OFF for the MVP play page — time is unlimited at the first tiers). */
const GAME_FLAGS_DEFAULT: GameFlags = { timersEnabled: false, tierId: 1, difficulty: "easy" }

/** Read the `game.*` flags once per mount. Pure public read; see GameFlags. */
export function useGameFlags(): GameFlags {
  const [flags, setFlags] = useState<GameFlags>(GAME_FLAGS_DEFAULT)
  useEffect(() => {
    let cancelled = false
    supabase
      .from("app_config")
      .select("key, value")
      .like("key", "game.%")
      .then(({ data }) => {
        if (cancelled || data === null) return
        const byKey = new Map((data as { key: string; value: string | null }[]).map(r => [r.key, r.value ?? ""]))
        const tier = Number(byKey.get("game.tier_id") ?? "")
        const diff = byKey.get("game.difficulty")
        setFlags({
          timersEnabled: byKey.get("game.timers_enabled") === "1",
          tierId: Number.isFinite(tier) && tier >= 1 && tier <= 7 ? tier : GAME_FLAGS_DEFAULT.tierId,
          difficulty: diff === "medium" || diff === "hard" ? diff : GAME_FLAGS_DEFAULT.difficulty,
        })
      })
    return () => { cancelled = true }
  }, [])
  return flags
}
