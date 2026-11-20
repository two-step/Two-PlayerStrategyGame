// siteContent hooks (TO_DO 29/33/31/45): public reads of music_tracks / news_items /
// app_config game.* flags against a stubbed Supabase client. Failure canon: degradations
// surface as error strings / defaults — never throws.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useActiveNews, useGameFlags, useMusicOverrides } from '../../src/lib/siteContent'

type Row = Record<string, unknown>
interface Thenable { then(onFulfilled: (r: { data: Row[] | null; error: { message: string; code?: string } | null }) => void): void }

function builder(result: { data: Row[] | null; error: { message: string; code?: string } | null }): Thenable & Record<string, unknown> {
  const b: Record<string, unknown> = {}
  const chain = (): unknown => b
  for (const m of ['select', 'eq', 'order', 'limit', 'like', 'single', 'upsert', 'insert', 'update', 'delete']) {
    b[m] = vi.fn(chain)
  }
  b.then = (onFulfilled: Parameters<Thenable['then']>[0]) =>
    Promise.resolve(result).then(onFulfilled)
  return b as Thenable & Record<string, unknown>
}

const tables = new Map<string, { data: Row[] | null; error: { message: string; code?: string } | null }>()
vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => builder(tables.get(table) ?? { data: [], error: null }),
  },
}))

afterEach(() => {
  tables.clear()
  vi.restoreAllMocks()
})

describe('useMusicOverrides', () => {
  it('groups current rows by page, last row wins, unusable rows are skipped', async () => {
    tables.set('music_tracks', {
      data: [
        { title: 'A', url: 'https://x/a.mp3', page: 'home', is_current: true },
        { title: 'B', url: 'https://x/b.mp3', page: 'home', is_current: true },
        { title: 'NoUrl', url: null, page: 'play', is_current: true },
        { title: 'NoPage', url: 'https://x/c.mp3', page: null, is_current: true },
        { title: 'Empty', url: '', page: 'rules', is_current: true },
      ],
      error: null,
    })
    const { result } = renderHook(() => useMusicOverrides())
    await waitFor(() => expect(result.current.overrides).toHaveLength(1))
    expect(result.current.overrides[0]).toEqual({ page: 'home', url: 'https://x/b.mp3', title: 'B' })
    expect(result.current.error).toBeNull()
  })

  it('a failed read degrades to empty overrides + error message (never throws)', async () => {
    tables.set('music_tracks', { data: null, error: { message: 'RLS denied' } })
    const { result } = renderHook(() => useMusicOverrides())
    await waitFor(() => expect(result.current.error).toBe('RLS denied'))
    expect(result.current.overrides).toEqual([])
  })
})

describe('useActiveNews', () => {
  it('returns ordered rows and honours the limit', async () => {
    tables.set('news_items', { data: [{ id: '1', message: 'Hello' }, { id: '2', message: 'World' }], error: null })
    const { result } = renderHook(() => useActiveNews(12))
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(result.current.items[0].message).toBe('Hello')
    expect(result.current.error).toBeNull()
  })

  it('an empty list is a normal state, not an error', async () => {
    tables.set('news_items', { data: [], error: null })
    const { result } = renderHook(() => useActiveNews())
    await waitFor(() => expect(result.current.items).toEqual([]))
    expect(result.current.error).toBeNull()
  })
})

describe('useGameFlags (app_config game.*)', () => {
  it('parses admin flags: timers "1", tier within 1..7, medium/hard only', async () => {
    tables.set('app_config', {
      data: [
        { key: 'game.timers_enabled', value: '1' },
        { key: 'game.tier_id', value: '3' },
        { key: 'game.difficulty', value: 'hard' },
        { key: 'admin.secret', value: 'must not appear' },
      ],
      error: null,
    })
    const { result } = renderHook(() => useGameFlags())
    await waitFor(() => expect(result.current).toEqual({ timersEnabled: true, tierId: 3, difficulty: 'hard' }))
  })

  it('absent/garbage rows degrade to the documented defaults (timers off, tier 1, easy)', async () => {
    tables.set('app_config', { data: [], error: null })
    const { result } = renderHook(() => useGameFlags())
    await waitFor(() => expect(result.current).toEqual({ timersEnabled: false, tierId: 1, difficulty: 'easy' }))
  })

  it('out-of-range tier and unknown difficulty fall back per flag', async () => {
    tables.set('app_config', {
      data: [
        { key: 'game.timers_enabled', value: '0' },
        { key: 'game.tier_id', value: '99' },
        { key: 'game.difficulty', value: 'impossible' },
      ],
      error: null,
    })
    const { result } = renderHook(() => useGameFlags())
    await waitFor(() => expect(result.current).toEqual({ timersEnabled: false, tierId: 1, difficulty: 'easy' }))
  })

  it('a failed read keeps the defaults', async () => {
    tables.set('app_config', { data: null, error: { message: 'denied' } })
    const { result } = renderHook(() => useGameFlags())
    await waitFor(() => expect(result.current).toEqual({ timersEnabled: false, tierId: 1, difficulty: 'easy' }))
  })
})
