// App smoke tests (TO_DO 45, site coverage leg): every page renders under a stubbed
// Supabase client (logged-out session), navigation switches pages, and the rated-games
// gate shows for anonymous visitors. Deep game interactions stay on the engine tests.
// @vitest-environment jsdom
import { afterEach, afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../src/App'
import '@testing-library/jest-dom/vitest'
import { translate } from '../../src/lib/i18n'

type Row = Record<string, unknown>

function builder(result: { data: Row[] | null; error: { message: string; code?: string } | null }): Record<string, unknown> {
  const b: Record<string, unknown> = {}
  const chain = (): unknown => b
  for (const m of ['select', 'eq', 'order', 'limit', 'like', 'single', 'upsert', 'insert', 'update', 'delete']) {
    b[m] = vi.fn(chain)
  }
  b.then = (onFulfilled: (r: { data: Row[] | null; error: unknown }) => unknown) =>
    Promise.resolve(result).then(onFulfilled)
  return b
}

const authState = { session: null as null | { user: { id: string; email: string } } }
vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: authState.session } }),
      onAuthStateChange: (_e: string, cb?: (e: string, s: unknown) => void) => {
        if (cb) queueMicrotask(() => cb('INITIAL_SESSION', authState.session))
        return { data: { subscription: { unsubscribe() {} } } }
      },
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {

      if (table === 'users') return builder({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
      return builder({ data: [], error: null })
    },
  },
}))

// jsdom has no Audio element (useSiteMusic constructs one at mount).
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
  // No real network in tests: geo detection rejects (caught → null → no gate modal).
  originalFetch = globalThis.fetch
  globalThis.fetch = (async () => { throw new TypeError('offline') }) as typeof fetch
  vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio)
  window.localStorage.setItem('ps_geo_prompt', 'done') // suppress the language-gate modal
})
afterAll(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllGlobals()
})
beforeEach(() => {
  authState.session = null
  window.localStorage.clear()
  window.localStorage.setItem('ps_geo_prompt', 'done')
})
afterEach(() => cleanup())

// BY is the default viewing language; labels are asserted through the same dictionary
// the UI renders, so the test documents the live strings rather than guesses.
const T = (key: string) => translate('BY', key)
const last = (els: HTMLElement[]) => els[els.length - 1]

describe('App: signed-in renders the game workbenches', () => {
  it('a session unlocks the rated play page (timers off per the MVP flag default)', async () => {
    authState.session = { user: { id: 'u1', email: 'x@y.z' } }
    const user = userEvent.setup()
    render(<App />)
    // The session effect resolves asynchronously — poll until the sign-out control
    // appears (waitFor's act-wrapped callback raced the auth effect in practice).
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 300))
      if (screen.queryByTitle(T('Sign out')) !== null) break
    }
    expect(screen.queryByTitle(T('Sign out'))).not.toBeNull()
    await user.click((await screen.findAllByText(T('Play'))).find(el => el.tagName === 'BUTTON')!)
    expect(await screen.findByDisplayValue(T('You have no scheduled games.'))).toBeInTheDocument()
  })

  it('a session unlocks the practice page (engine match workbench)', async () => {
    authState.session = { user: { id: 'u1', email: 'x@y.z' } }
    const user = userEvent.setup()
    render(<App />)
    // The session effect resolves asynchronously — poll until the sign-out control
    // appears (waitFor's act-wrapped callback raced the auth effect in practice).
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 300))
      if (screen.queryByTitle(T('Sign out')) !== null) break
    }
    expect(screen.queryByTitle(T('Sign out'))).not.toBeNull()
    await user.click((await screen.findAllByText(T('Practice'))).find(el => el.tagName === 'BUTTON')!)
    expect(await screen.findByDisplayValue(T('Flip the coin to decide who requests first.'))).toBeInTheDocument()
  })
})

describe('App: logged-out smoke over every page', () => {
  it('home renders the nav and the hero', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText(T('Figures')).length).toBeGreaterThan(0))
    expect(screen.getAllByText('PUZZLESTOW').length).toBeGreaterThan(0)
    expect(screen.getByText(T('Strategy. Geometry. Honest play.'))).toBeInTheDocument()
  })

  it('nav reaches Figures, Rules, Lore and Print&Play', async () => {
    const user = userEvent.setup()
    render(<App />)
    for (const [label, marker] of [
      [T('Figures'), T('All 27 Figures')],
      [T('Rules'), T('No piece may float. Every cell must rest on base row A or be supported by a previously placed cell below it.')],
      [T('Lore'), T('— THE LEGEND OF THE LODARS —')],
      [T('Print & Play'), T('Download Cut-Out Figures (print, cut, play)')],
    ] as const) {
      await user.click(last(await screen.findAllByText(label)))
      expect(await screen.findAllByText(marker, { exact: false }).then(els => els.length)).toBeGreaterThan(0)
    }
  })

  it('rated play, practice and sandbox show the sign-in gate for anonymous visitors', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click((await screen.findAllByText(T('Play'))).find(el => el.tagName === 'BUTTON')!)
    expect(await screen.findByText(T('Sign in to play rated matches'))).toBeInTheDocument()
    // Practice/Sandbox links live on the home page cards and in the mobile menu only,
    // so navigate home between them (the logo button resets to home).
    await user.click(screen.getAllByText('PUZZLESTOW')[0].closest('button')!)
    await user.click((await screen.findAllByText(T('Practice'))).find(el => el.tagName === 'BUTTON')!)
    expect(await screen.findByText(T('Sign in to play Practice'))).toBeInTheDocument()
    await user.click(screen.getAllByText('PUZZLESTOW')[0].closest('button')!)
    await user.click((await screen.findAllByText(T('Sandbox'))).find(el => el.tagName === 'BUTTON')!)
    expect(await screen.findByText(T('Sign in to use the Sandbox'))).toBeInTheDocument()
  })

  it('sign-in page renders the auth form', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(last(await screen.findAllByText(T('Sign In / Sign Up'))))
    await screen.findByText(T('Sign In'), { selector: 'h2' })
  })

  it('the DevTest entry opens the test environment', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByTitle('Dev/test environment (TO_DO item 6)'))
    await screen.findByText(T('DEV / TEST ENVIRONMENT — local engine only, not the production server (TO_DO.docx items 6-8)'))
  })

  it('the language switcher flips the viewing language live', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText(T('Figures'))
    await user.click(screen.getByRole('button', { name: 'EN' }))
    await waitFor(() => expect(screen.getAllByText(translate('EN', 'Figures')).length).toBeGreaterThan(0))
    expect(window.localStorage.getItem('ps_lang')).toBe('EN')
  })
})
