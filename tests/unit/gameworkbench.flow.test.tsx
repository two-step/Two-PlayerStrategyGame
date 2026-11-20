// GameWorkbench interaction tests (TO_DO 30/31/45): the practice flow end-to-end —
// coin flip, the engine's first request, a placement typed as notation (strict dot
// order), a handover through the figure bank, and the engine's legal reply.
// Orientation canon: row A at the BOTTOM, entrance A0, columns 0–14 left-to-right.
// @vitest-environment jsdom
import { afterEach, afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import App from '../../src/App'
import { translate } from '../../src/lib/i18n'
import * as rules from '../../src/engine/rules'
import { FIGURES } from './helpers'

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
  originalFetch = globalThis.fetch
  globalThis.fetch = (async () => { throw new TypeError('offline') }) as typeof fetch
  vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio)
})
afterAll(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllGlobals()
})
beforeEach(() => {
  authState.session = { user: { id: 'u1', email: 'x@y.z' } }
  window.localStorage.clear()
  window.localStorage.setItem('ps_geo_prompt', 'done')
  // Deterministic coin: youFirst = random < 0.5 → 0.1 = the engine requests MY first figure.
  vi.spyOn(Math, 'random').mockReturnValue(0.1)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const T = (key: string) => translate('BY', key)

/** A legal notation for a figure on an empty board, computed by the rules enumerator. */
function legalNotation(figId: number): string {
  const fig = FIGURES.find((f) => f.id === figId)!
  const cells = rules.enumeratePlacements(fig, new Set(), 11)[0]
  return rules.formatNotation(fig.id, fig.dots.map((i) => ({ r: cells[i][0], c: cells[i][1] })), 11)
}

describe('GameWorkbench (practice, signed-in): a full exchange', () => {
  it('coin → engine requests my first figure → I place by notation → I hand a figure over → the engine places legally', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Signed-in: the sign-out control appears.
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 300))
      if (screen.queryByTitle(T('Sign out')) !== null) break
    }
    expect(screen.queryByTitle(T('Sign out'))).not.toBeNull()
    // Practice workbench.
    await user.click((await screen.findAllByText(T('Practice'))).find((el) => el.tagName === 'BUTTON')!)
    await screen.findByText(T('ENGINE MATCH — UNRATED — built-in opponent on the local rules engine; server matches arrive with the multiplayer milestone.'))

    // Coin: deterministic youFirst=true (Math.random mocked to 0.1). The flip is a 5s timer.
    await user.click(screen.getByText(T('Flip the coin')))
    const incomingLabel = await screen.findByText(/^F\d\d — /.source ? /^F\d\d — / : /^F\d\d — /, { selector: 'p' }, { timeout: 8000 })
    const label = incomingLabel.textContent!.slice(0, 3) // "F13"
    const figId = parseInt(label.slice(1), 10)
    expect(figId).toBeGreaterThanOrEqual(1)
    expect(figId).toBeLessThanOrEqual(27)

    // Place by typed notation: strict dot-order canon, computed legal on the empty board.
    const notation = legalNotation(figId)
    const input = screen.getByPlaceholderText(T('figure id + point(s)'))
    await user.type(input, notation)
    await user.click(screen.getByText('SUBMIT'))
    await waitFor(() => expect(screen.getByDisplayValue(T('Placed. Choose a figure to request for the opponent.'))).toBeInTheDocument(), { timeout: 10_000 })

    // Hand a figure over through the figure bank: F01 (Mono) is always placeable on
    // an empty opponent board. The engine's reply is an enumerated-legal placement.
    // The bank cards carry the figure name in their title attribute.
    const bankButtons = await screen.findAllByTitle(/^F01 Mono/, {}, { timeout: 10_000 })
    // The enabled (actionable) card is the one to click; the disabled duplicate is the
    // opponent's view-only bank mirror.
    const actionable = bankButtons.find((el) => (el as HTMLButtonElement).disabled === false) ?? bankButtons[0]
    await user.click(actionable)
    // The engine places (synchronous decision, ~1-2 s) and immediately requests my
    // next figure — the log must show both the handover and the opponent's legal load.
    await screen.findByText(translate('BY', 'You request {fig} for the opponent.', { fig: 'F01' }), {}, { timeout: 10_000 })
    await screen.findByText(/усталявана F01 на 01A14/, {}, { timeout: 20_000 })
  }, 60_000)
})
