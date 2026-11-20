// Music-helpers tests (TO_DO 29/45): pure track selection + persistence, and the
// useSiteMusic hook behaviour against a stubbed Audio element (jsdom has none).
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import {
  MUSIC_STORAGE_KEY, readStoredMusicOn, resolveMusicSrc, storeMusicOn,
  trackForPage, useSiteMusic,
} from '../../src/lib/useSiteMusic'
const SITE_SRC = resolveMusicSrc('home', [])
const PLAY_SRC = resolveMusicSrc('play', [])

class FakeAudio {
  static instances: FakeAudio[] = []
  loop = false
  volume = 1
  src = ''
  paused = true
  played = 0
  pausedCount = 0
  private attrs = new Map<string, string>()
  constructor() { FakeAudio.instances.push(this) }
  async play() { this.paused = false; this.played++; return undefined }
  pause() { this.paused = true; this.pausedCount++ }
  getAttribute(name: string) { return this.attrs.get(name) ?? null }
  setAttribute(name: string, value: string) { this.attrs.set(name, value) }
  removeAttribute(name: string) { this.attrs.delete(name) }
}

beforeEach(() => {
  FakeAudio.instances = []
  window.localStorage.clear()
  vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('track selection (pure)', () => {
  it('play pages use the play theme; everything else the site theme', () => {
    expect(trackForPage('play')).toBe('play')
    expect(trackForPage('practice')).toBe('play')
    expect(trackForPage('home')).toBe('site')
    expect(trackForPage('auth')).toBe('site')
    expect(resolveMusicSrc('play', [])).toBe(PLAY_SRC)
    expect(resolveMusicSrc('home', [])).toBe(SITE_SRC)
  })

  it('admin overrides win over the bundled themes (exact page, then default)', () => {
    expect(resolveMusicSrc('home', [{ page: 'home', url: 'https://example.com/h.mp3', title: 'H' }]))
      .toBe('https://example.com/h.mp3')
    expect(resolveMusicSrc('auth', [{ page: 'default', url: 'https://example.com/d.mp3', title: 'D' }]))
      .toBe('https://example.com/d.mp3')
    // A "default" override must NOT leak into game pages (they have their own theme).
    expect(resolveMusicSrc('play', [{ page: 'default', url: 'https://example.com/d.mp3', title: 'D' }]))
      .toBe(PLAY_SRC)
  })

  it('bundled fallbacks are the two Suno themes', () => {
    expect(SITE_SRC.endsWith('PuzzleStow.mp3')).toBe(true)
    expect(PLAY_SRC.endsWith('PuzzleStow_Play.mp3')).toBe(true)
  })
})

describe('music preference persistence', () => {
  it('defaults to ON (absent key), explicit "0" turns it off, and it round-trips', () => {
    expect(window.localStorage.getItem(MUSIC_STORAGE_KEY)).toBeNull()
    expect(readStoredMusicOn()).toBe(true)
    storeMusicOn(false)
    expect(readStoredMusicOn()).toBe(false)
    expect(window.localStorage.getItem(MUSIC_STORAGE_KEY)).toBe('0')
    storeMusicOn(true)
    expect(readStoredMusicOn()).toBe(true)
    expect(window.localStorage.getItem(MUSIC_STORAGE_KEY)).toBe('1')
  })
})

describe('useSiteMusic hook', () => {
  it('creates one Audio element and does not play while off', () => {
    renderHook(() => useSiteMusic(SITE_SRC, false))
    expect(FakeAudio.instances).toHaveLength(1)
    const el = FakeAudio.instances[0]
    expect(el.loop).toBe(true)
    expect(el.played).toBe(0)
    expect(el.pausedCount).toBeGreaterThanOrEqual(1)
  })

  it('plays when switched on and swaps src when the track changes', async () => {
    const { rerender } = renderHook(({ src, on }) => useSiteMusic(src, on), {
      initialProps: { src: SITE_SRC, on: true },
    })
    const el = FakeAudio.instances[0]
    await act(async () => { await Promise.resolve() })
    expect(el.played).toBe(1)
    expect(el.getAttribute('data-track')).toBe(SITE_SRC)
    rerender({ src: PLAY_SRC, on: true })
    expect(el.getAttribute('data-track')).toBe(PLAY_SRC)
    expect(el.src).toBe(PLAY_SRC)
  })

  it('pauses on unmount and releases the src', () => {
    const { unmount } = renderHook(() => useSiteMusic(SITE_SRC, true))
    const el = FakeAudio.instances[0]
    unmount()
    expect(el.paused).toBe(true)
    expect(el.getAttribute('data-track')).toBeNull()
  })
})
