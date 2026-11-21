// AdminPage tests (TO_DO 45): the site-content console for role === 'Administrator' —
// the CONFIG VARIABLES section against a stateful app_config mock: list, save a value,
// delete a row, add a new key, and the duplicate-key validation. The gate itself
// (non-admin sees the restriction note) is covered by the access test.
// @vitest-environment jsdom
import { afterEach, afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import App from '../../src/App'
import { translate } from '../../src/lib/i18n'

type Row = Record<string, unknown>

function emptyBuilder(): Record<string, unknown> {
  const b: Record<string, unknown> = {}
  const chain = (): unknown => b
  for (const m of ['select', 'eq', 'order', 'limit', 'like', 'single', 'update', 'delete', 'insert']) {
    b[m] = vi.fn(chain)
  }
  b.then = (onFulfilled: (r: { data: Row[] | null; error: unknown }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(onFulfilled)
  return b
}

const CONFIG_ROWS: Row[] = [
  { key: 'game.timers_enabled', value: '1', description: 'Toggle the match timers on the workbench' },
  { key: 'game.qualifier_tier', value: '3', description: 'Tier required to qualify (1..7)' },
]

const config = {
  rows: CONFIG_ROWS as Row[],
  lastUpdate: null as { key: string; patch: Record<string, unknown> } | null,
  lastDelete: null as string | null,
  lastInsert: null as Record<string, unknown> | null,
}

function configBuilder(): Record<string, unknown> {
  const b: Record<string, unknown> = {}
  const chain = (): unknown => b
  for (const m of ['select', 'eq', 'order', 'limit', 'like', 'single']) {
    b[m] = vi.fn(chain)
  }
  b.update = (patch: Record<string, unknown>) => ({
    eq: (_k: string, key: string) => {
      config.lastUpdate = { key, patch }
      return Promise.resolve({ error: null })
    },
  })
  b.delete = () => ({
    eq: (_k: string, key: string) => {
      config.lastDelete = key
      config.rows = config.rows.filter((r) => r.key !== key)
      return Promise.resolve({ error: null })
    },
  })
  b.insert = (row: Record<string, unknown>) => {
    config.lastInsert = row
    config.rows = [...config.rows, { ...row }]
    return {
      select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }),
    }
  }
  b.then = (onFulfilled: (r: { data: Row[] | null; error: unknown }) => unknown) =>
    Promise.resolve({ data: config.rows, error: null }).then(onFulfilled)
  return b
}

const PROFILE: Row = {
  id: 'u1',
  name: 'Admin Admin',
  telegram_id: null,
  game_qualification: 'MasterLod',
  nickname: null,
  use_nickname: false,
  subscribed_to_news: false,
  role: 'Administrator',
  avatar: null,
  avatar_content_type: null,
  agreed_to_terms_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
}

const auth = { session: null as null | { user: { id: string; email: string } } }
const profile = { row: PROFILE }

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: auth.session } }),
      onAuthStateChange: (cb?: (e: string, s: unknown) => void) => {
        if (cb) queueMicrotask(() => cb('INITIAL_SESSION', auth.session))
        return { data: { subscription: { unsubscribe() {} } } }
      },
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {
      if (table === 'users') {
        // The App fetches the profile with .eq('id', id).single() — resolve the row.
        const b: Record<string, unknown> = {}
        const chain = (): unknown => b
        for (const m of ['select', 'order', 'limit', 'like', 'upsert', 'insert', 'update', 'delete']) b[m] = vi.fn(chain)
        b.eq = () => ({ single: () => Promise.resolve({ data: profile.row, error: null }) })
        b.then = (onFulfilled: (r: { data: Row[] | null; error: unknown }) => unknown) =>
          Promise.resolve({ data: [profile.row], error: null }).then(onFulfilled)
        return b
      }
      if (table === 'app_config') return configBuilder()
      return emptyBuilder()
    },
  },
}))

class FakeAudio {
  loop = false
  volume = 1
  src = ''
  paused = true
  private attrs = new Map<string, string>()
  async play() { this.paused = false; return undefined }
  pause() { this.paused = true }
  getAttribute(n: string) { return this.attrs.get(n) ?? null }
  setAttribute(n: string, v: string) { this.attrs.set(n, v) }
  removeAttribute(n: string) { this.attrs.delete(n) }
}

let originalFetch: typeof fetch
beforeAll(() => {
  originalFetch = globalThis.fetch
  globalThis.fetch = (async () => { throw new TypeError('offline') }) as typeof fetch
  vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio)
})
afterAll(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllGlobals()
})
beforeEach(() => {
  auth.session = { user: { id: 'u1', email: 'admin@y.z' } }
  profile.row = { ...PROFILE }
  config.rows = CONFIG_ROWS.map((r) => ({ ...r }))
  config.lastUpdate = null
  config.lastDelete = null
  config.lastInsert = null
  window.localStorage.clear()
  window.localStorage.setItem('ps_geo_prompt', 'done')
  window.history.replaceState({}, '', '/')
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const T = (key: string) => translate('BY', key)

async function openAdmin(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  // Canon quirk: the desktop nav Admin button is a hardcoded 'Admin' literal (not t()).
  await user.click((await screen.findAllByText('Admin', {}, { timeout: 10_000 })).find((el) => el.tagName === 'BUTTON')!)
  await screen.findByText(T('Site Content'), {}, { timeout: 10_000 })
}

describe('Admin — CONFIG VARIABLES (stateful app_config)', () => {
  it('lists the config rows with their keys', async () => {
    const user = userEvent.setup()
    await openAdmin(user)
    expect(screen.getByText('game.timers_enabled')).toBeInTheDocument()
    expect(screen.getByText('game.qualifier_tier')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Toggle the match timers on the workbench')).toBeInTheDocument()
  }, 40_000)

  it('saving a row posts the patch to the right key', async () => {
    const user = userEvent.setup()
    await openAdmin(user)
    const valueInput = screen.getByDisplayValue('1')
    await user.clear(valueInput)
    await user.type(valueInput, '0')
    await user.click(screen.getAllByText(T('Save'))[0])
    expect(config.lastUpdate?.key).toBe('game.timers_enabled')
    expect(config.lastUpdate?.patch.value).toBe('0')
    expect(config.lastUpdate?.patch.updated_at).toBeTypeOf('string')
  }, 40_000)

  it('Delete removes the row from the list and posts the delete', async () => {
    const user = userEvent.setup()
    await openAdmin(user)
    const deleteButtons = screen.getAllByText(T('Delete'))
    await user.click(deleteButtons[0])
    expect(config.lastDelete).toBe('game.timers_enabled')
    expect(screen.queryByDisplayValue('game.timers_enabled')).toBeNull()
  }, 40_000)

  it('Add appends a new key; a duplicate key is rejected before insert', async () => {
    const user = userEvent.setup()
    await openAdmin(user)
    const keyInput = screen.getByPlaceholderText(T('key'))
    await user.type(keyInput, 'game.qualifier_tier')
    await user.type(screen.getByPlaceholderText(T('value')), 'x')
    await user.click(screen.getAllByText(T('Add'))[0]!)
    expect(screen.getByText(T('Key already exists'))).toBeInTheDocument()
    expect(config.lastInsert).toBeNull()

    await user.clear(keyInput)
    await user.type(keyInput, 'game.new_flag')
    await user.type(screen.getByPlaceholderText(T('description')), 'test flag')
    await user.click(screen.getAllByText(T('Add'))[0]!)
    expect(config.lastInsert).toEqual({ key: 'game.new_flag', value: 'x', description: 'test flag' })
    expect(screen.getByText('game.new_flag')).toBeInTheDocument()
  }, 40_000)
})

describe('Admin — access gate', () => {
  it('a signed-in non-admin has no Admin nav entry', async () => {
    profile.row = { ...PROFILE, role: 'Player' }
    render(<App />)
    await new Promise((r) => setTimeout(r, 1000))
    expect(screen.queryByText(T('Admin'))).toBeNull()
  }, 40_000)

  it('signed out, there is no Admin entry either', async () => {
    auth.session = null
    profile.row = { ...PROFILE }
    render(<App />)
    await new Promise((r) => setTimeout(r, 1000))
    expect(screen.queryByText(T('Admin'))).toBeNull()
  }, 40_000)
})
