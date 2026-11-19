// useSiteMusic — TO_DO item 29 (номер сверен по TO_DO.docx): «Подключить музыку…».
//
// Purpose: real background music for the site (MVP: stubs prohibited). The
// bundled tracks from src/music are the defaults (site theme PuzzleStow.mp3,
// play theme PuzzleStow_Play.mp3 for game pages); the Admin page can override
// any page with a track from the music_tracks table (siteContent.ts reads it).
// Toggled from the Nav music button; the choice persists in localStorage and
// survives reloads. Music is ON by default ( Sergey, 2026-11-19).
//
// Preconditions:
// - `src` must resolve before this hook runs (see resolveMusicSrc).
// - Browser autoplay policy: play() may be rejected until the first user
//   gesture — the hook retries on the next pointerdown (see the retry effect).
//
// Postconditions:
// - When musicOn is false the audio element is paused.
// - When musicOn is true exactly one track (the resolved src) is looping.
// - Failures (rejected play(), missing codec) never propagate to React.
//
// Invariants:
// - One HTMLAudioElement per hook instance, created lazily, reused across
//   src switches (no element churn).
// - No default exports, no classes, no enum (AGENTS.md §5).

import { useEffect, useRef } from "react"
import siteTrack from "../music/PuzzleStow.mp3"
import playTrack from "../music/PuzzleStow_Play.mp3"
import type { MusicOverride } from "./siteContent"

/** Which bundled background track fits a page when no DB override exists. */
export type SiteMusicTrack = "site" | "play"

/** localStorage key for the visitor's music preference (persisted by App.tsx). */
export const MUSIC_STORAGE_KEY = "ps_music_on"

/** Game pages get the play theme; everything else gets the site theme. */
const GAME_PAGES: ReadonlySet<string> = new Set(["play", "practice", "sandbox", "devtest"])

/** Loop volume of the background music, kept low so it stays background. */
const MUSIC_VOLUME = 0.35

/** Swallowed promise rejection callback for autoplay-policy rejections. */
function ignorePlayRejection(): void {
  // Intentionally empty: the rejection is expected and must not surface.
}

/**
 * Map a page identifier to its bundled fallback track.
 * Precondition: `page` is a Page value from App.tsx (compared by name).
 * Postcondition: pure; returns "play" only for game pages.
 */
export function trackForPage(page: string): SiteMusicTrack {
  return GAME_PAGES.has(page) ? "play" : "site"
}

/**
 * Resolve the audio source for a page: an exact music_tracks override wins,
 * then the admin's "default" override for content pages, then the bundled
 * theme for the page type.
 * Precondition: `overrides` comes from useMusicOverrides (at most one per page).
 * Postcondition: pure; always returns a playable URL string.
 */
export function resolveMusicSrc(page: string, overrides: MusicOverride[]): string {
  const exact = overrides.find(o => o.page === page)
  if (exact !== undefined) return exact.url
  if (trackForPage(page) === "site") {
    const fallback = overrides.find(o => o.page === "default")
    if (fallback !== undefined) return fallback.url
  }
  return trackForPage(page) === "play" ? playTrack : siteTrack
}

/**
 * Read the persisted music preference. Music is ON by default (2026-11-19):
 * an absent key means true; only an explicit stored "0" means false.
 * Postcondition: a corrupted/unreadable storage never turns music off.
 */
export function readStoredMusicOn(): boolean {
  try {
    return window.localStorage.getItem(MUSIC_STORAGE_KEY) !== "0"
  } catch {
    return true
  }
}

/**
 * Persist the music preference.
 * Postcondition: storage failures (privacy mode) are swallowed.
 */
export function storeMusicOn(on: boolean): void {
  try {
    window.localStorage.setItem(MUSIC_STORAGE_KEY, on ? "1" : "0")
  } catch {
    // Storage unavailable — the preference is session-only.
  }
}

/**
 * React hook: keeps a single looping audio element in sync with the requested
 * source and on/off state. Renders nothing; all failures are silent.
 * Precondition: called from a React component body (standard hook rules).
 * Postconditions: see module-level Postconditions; pauses on hidden tabs and
 * resumes on return.
 * Invariant: src switches preserve "playing" — if music is on, the new src
 * starts immediately.
 */
export function useSiteMusic(src: string, musicOn: boolean): void {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  if (audioRef.current === null) {
    const el = new Audio()
    el.loop = true
    el.volume = MUSIC_VOLUME
    audioRef.current = el
  }
  const musicOnRef = useRef(musicOn)
  musicOnRef.current = musicOn

  // Main sync effect: pause when off; (re)select src and play when on.
  useEffect(() => {
    const el = audioRef.current
    if (el === null) return
    if (!musicOn) {
      el.pause()
      return
    }
    if (el.getAttribute("data-track") !== src) {
      el.setAttribute("data-track", src)
      el.src = src
    }
    void el.play().catch(ignorePlayRejection)
  }, [musicOn, src])

  // Gesture retry effect: autoplay policy may reject the first play() after a
  // reload with a persisted "on" preference; retry on the next user gesture.
  useEffect(() => {
    const el = audioRef.current
    if (el === null || !musicOn || !el.paused) return
    const retry = (): void => {
      void el.play().catch(ignorePlayRejection)
    }
    window.addEventListener("pointerdown", retry, { once: true })
    return () => window.removeEventListener("pointerdown", retry)
  }, [musicOn, src])

  // Visibility effect: background tabs must not play music.
  useEffect(() => {
    const onVisibility = (): void => {
      const el = audioRef.current
      if (el === null || !musicOnRef.current) return
      if (document.hidden) el.pause()
      else void el.play().catch(ignorePlayRejection)
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  // Unmount effect: full stop and release (App never unmounts it, but a host
  // environment might).
  useEffect(() => {
    const el = audioRef.current
    return () => {
      if (el === null) return
      el.pause()
      el.removeAttribute("src")
      el.removeAttribute("data-track")
    }
  }, [])
}
