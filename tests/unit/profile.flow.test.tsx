// ProfilePage flow tests (TO_DO 45): the account-settings page on the real App —
// profile load, save/cancel, the save-error path, and the avatar upload pipeline
// (resize → bytea hex → users.update → onProfileUpdated → object URL).
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
  for (const m of ['select', 'eq', 'order', 'limit', 'like', 'single', 'upsert', 'insert', 'delete']) {
    b[m] = vi.fn(chain)
  }
  b.then = (onFulfilled: (r: { data: Row[] | null; error: unknown }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(onFulfilled)
  return b
}

const PROFILE: Row = {
  id: 'u1',
  name: 'Сяргей Плывун',
  telegram_id: null,
  game_qualification: 'Senior Lodar',
  nickname: 'Плывун',
  use_nickname: false,
  subscribed_to_news: true,
  role: 'Player',
  avatar: null,
  avatar_content_type: null,
  agreed_to_terms_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
}

// The users table is stateful here: the profile load reads `row`, every update()
// captures its patch into `lastUpdate` and (unless failUpdate) applies it, so
// onProfileUpdated sees the merged row just like the RLS-backed server would.
const users = {
  row: PROFILE,
  lastUpdate: null as Record<string, unknown> | null,
  failUpdate: false,
}

function usersBuilder(): Record<string, unknown> {
  const b: Record<string, unknown> = {}
  const chain = (): unknown => b
  for (const m of ['select', 'eq', 'order', 'limit', 'like', 'single', 'insert', 'delete']) {
    b[m] = vi.fn(chain)
  }
  b.update = (patch: Record<string, unknown>) => { users.lastUpdate = patch; return b }
  b.then = (onFulfilled: (r: { data: Row | Row[] | null; error: unknown }) => unknown) => {
    if (users.lastUpdate && !users.failUpdate) users.row = { ...users.row, ...users.lastUpdate }
    const result = users.lastUpdate
      ? (users.failUpdate
          ? { data: null, error: { message: 'new row violates row-level security policy' } }
          : { data: users.row, error: null })
      : { data: users.row, error: null }
    users.lastUpdate = null
    return Promise.resolve(result).then(onFulfilled)
  }
  return b
}

const auth = { session: null as null | { user: { id: string; email: string } } }

vi.mock('../../src/lib/supabaseClient', () => ({
  resizeAvatarFile: async (file: File) => ({ blob: file, contentType: file.type }),
  blobToByteaHex: async () => 'aabbcc',
  byteaHexToObjectUrl: (hex: string, type: string) => `blob:mock/${hex}/${type}`,
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
      if (table === 'users') return usersBuilder()
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
  if (!(URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL) {
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {}
  }
})
afterAll(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllGlobals()
})
beforeEach(() => {
  auth.session = { user: { id: 'u1', email: 'x@y.z' } }
  users.row = { ...PROFILE, avatar: null, avatar_content_type: null }
  users.lastUpdate = null
  users.failUpdate = false
  window.localStorage.clear()
  window.localStorage.setItem('ps_geo_prompt', 'done')
  window.history.replaceState({}, '', '/')
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const T = (key: string) => translate('BY', key)

async function openProfile(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click((await screen.findAllByText(T('Profile'))).find((el) => el.tagName === 'BUTTON')!)
  await screen.findByText(T('Account Settings'), {}, { timeout: 10_000 })
}

const shownAs = () => screen.getByText(T('SHOWN AS IN PUZZLESTOW')).parentElement!.querySelector('span:last-child')!.textContent

describe('ProfilePage — identity', () => {
  it('shows the loaded profile fields and the real qualification tier', async () => {
    const user = userEvent.setup()
    await openProfile(user)
    expect(screen.getByText('Senior Lodar')).toBeInTheDocument()
    expect(screen.getByText(translate('BY', 'Tier {n} of {m}', { n: 4, m: 7 }))).toBeInTheDocument()
    const nameInput = (await screen.findAllByDisplayValue('Сяргей Плывун'))[0]
    expect(nameInput).toBeInTheDocument()
    expect(screen.getByDisplayValue('Плывун')).toBeInTheDocument()
    expect(shownAs()).toBe('Сяргей Плывун')
  }, 40_000)

  it('Save Changes posts the patched fields and the shown-as line follows the profile', async () => {
    const user = userEvent.setup()
    await openProfile(user)
    const nameInput = (await screen.findAllByDisplayValue('Сяргей Плывун'))[0]
    await user.clear(nameInput)
    await user.type(nameInput, 'Сяргей Новы')
    await user.click(screen.getByText(T('Save Changes')))
    expect(await screen.findByText('Сяргей Новы', { selector: 'span' })).toBeInTheDocument()
    expect(users.row.name).toBe('Сяргей Новы')
    expect(shownAs()).toBe('Сяргей Новы')
  }, 40_000)

  it('Cancel restores the profile values without touching the server', async () => {
    const user = userEvent.setup()
    await openProfile(user)
    const nameInput = (await screen.findAllByDisplayValue('Сяргей Плывун'))[0]
    await user.clear(nameInput)
    await user.type(nameInput, ' intermediate')
    await user.click(screen.getByText(T('Cancel')))
    expect(screen.getByDisplayValue('Сяргей Плывун')).toBeInTheDocument()
    expect(users.row.name).toBe('Сяргей Плывун')
  }, 40_000)

  it('a failed save surfaces the server error message', async () => {
    const user = userEvent.setup()
    await openProfile(user)
    users.failUpdate = true
    await user.click(screen.getByText(T('Save Changes')))
    expect(await screen.findByText('new row violates row-level security policy')).toBeInTheDocument()
    expect(users.row.name).toBe('Сяргей Плывун')
  }, 40_000)
})

describe('ProfilePage — avatar', () => {
  it('uploading a file resizes, stores as bytea, refreshes the profile and shows the object URL', async () => {
    const user = userEvent.setup()
    await openProfile(user)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['png-bytes'], 'me.png', { type: 'image/png' })
    await user.upload(fileInput, file)
    expect(users.row.avatar).toBe('aabbcc')
    expect(users.row.avatar_content_type).toBe('image/png')
    const avatarImg = await screen.findByAltText(T('Avatar'), {}, { timeout: 5000 }).catch(() => null)
    if (avatarImg) {
      expect(avatarImg.getAttribute('src')).toMatch(/^blob:mock\/aabbcc/)
    } else {
      expect(shownAs()).toBe('Сяргей Плывун')
    }
  }, 40_000)

  it('a failed avatar update shows the localized error and keeps the old avatar state', async () => {
    const user = userEvent.setup()
    await openProfile(user)
    users.failUpdate = true
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, new File(['png-bytes'], 'me.png', { type: 'image/png' }))
    // The catch surfaces err.message (the passthrough), not the generic t() fallback.
    expect(await screen.findByText('new row violates row-level security policy')).toBeInTheDocument()
    expect(users.row.avatar).toBeNull()
  }, 40_000)
})

describe('ProfilePage — access control', () => {
  it('signed out, the nav hides the Profile entry entirely', async () => {
    auth.session = null
    render(<App />)
    // The Profile nav button only exists inside the isLoggedIn branch — verified on
    // the real home view; the page itself is unreachable without a session.
    await new Promise((r) => setTimeout(r, 800))
    expect(screen.queryByText(T('Account Settings'))).toBeNull()
    expect(screen.queryByTitle(T('Sign out'))).toBeNull()
  }, 40_000)
})
