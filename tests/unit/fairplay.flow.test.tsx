// Fair-play UX flow tests (TO_DO 44c/45): a >50 % overhang placement is offered at
// fixation (Sergey, 2026-11-19: submit alone NEVER fires the request), the opponent
// judges ONLY the overhang ratio vs their preset threshold, approval is single-use and
// tied to the exact cells, and the tallies count one entry per OUTGOING request.
// @vitest-environment jsdom
import { afterEach, afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
  vi.spyOn(Math, 'random').mockReturnValue(0.1)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const T = (key: string) => translate('BY', key)

/** Searches every orientation × position for a placement whose overhang ratio falls in
 * (min, max] and whose only violation is the >50 % fair-play trigger. */
function fairPlayNotation(figId: number, filled: Set<string>, rows: number, min: number, max: number): string | null {
  const fig = FIGURES.find((f) => f.id === figId)!
  for (let ori = 0; ori < 4; ori++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 15; c++) {
        const cells = rules.computePlacementFromAnchor(fig, ori, { r, c })
        if (!rules.inBounds(cells, rows) || rules.collides(cells, filled)) continue
        const ratio = rules.overhangRatio(cells, filled, rows)
        if (ratio <= min || ratio > max) continue
        const res = rules.checkPlacement(cells, filled, rows)
        if (res.needsFairPlay) {
          return rules.formatNotation(fig.id, fig.dots.map((i) => ({ r: cells[i][0], c: cells[i][1] })), rows)
        }
      }
    }
  }
  return null
}

async function signedInPractice(user: ReturnType<typeof userEvent.setup>, opts?: { pickDifficulty?: 'easy' | 'medium' | 'hard' }) {
  render(<App />)
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 300))
    if (screen.queryByTitle(T('Sign out')) !== null) break
  }
  expect(screen.queryByTitle(T('Sign out'))).not.toBeNull()
  await user.click((await screen.findAllByText(T('Practice'))).find((el) => el.tagName === 'BUTTON')!)
  await screen.findByText(T('ENGINE MATCH — UNRATED — built-in opponent on the local rules engine; server matches arrive with the multiplayer milestone.'))
  if (opts?.pickDifficulty) {
    const difficulty = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'hard'))!
    await user.selectOptions(difficulty, opts.pickDifficulty)
  }
  await user.click(screen.getByText(T('Flip the coin')))
  const incomingLabel = await screen.findByText(/^F\d\d — /, { selector: 'p' }, { timeout: 8000 })
  return parseInt(incomingLabel.textContent!.slice(1, 3), 10)
}

describe('Fair-play flow (practice): the opponent judges only the overhang ratio', () => {
  it('a 50–75 % overhang: offer at fixation → order → opponent agrees → resubmit places, OUT tally 1✓', async () => {
    const user = userEvent.setup()
    const figId = await signedInPractice(user)
    const notation = fairPlayNotation(figId, new Set(), 11, 0.5, 0.75)
    expect(notation).not.toBeNull()

    const input = screen.getByPlaceholderText(T('figure id + point(s)'))
    await user.type(input, notation!)
    await user.click(screen.getByText('SUBMIT'))
    // Fixation: the offer is visible BEFORE any request fires.
    // The offer sits in the placement panel: the pct verdict next to the order button.
    const panel = screen.getByText(T('Order fair play')).closest('div')
    expect(panel?.textContent ?? '').toMatch(/[0-9]+% звесу/)
    expect(screen.getByText(T('Order fair play'))).toBeInTheDocument()
    // Submit alone only echoes the verdict (the reason text is dynamic: NN% unsupported).
    expect(await screen.findByDisplayValue(/unsupported/)).toBeInTheDocument()
    expect(screen.getByDisplayValue(/unsupported/).getAttribute('value')).toContain(T('order fair play to ask the opponent.'))

    // Order → the opponent judges ONLY the overhang: ≤ 0.75 → agree.
    await user.click(screen.getByText(T('Order fair play')))
    expect(await screen.findByDisplayValue(/згодзіўся праз fair play/)).toBeInTheDocument()
    expect(screen.getByText(/OUT 1✓/)).toBeInTheDocument()

    // Resubmit: single-use approval tied to the same cells → the load lands.
    await user.click(screen.getByText('SUBMIT'))
    expect(await screen.findByDisplayValue(T('Placed. Choose a figure to request for the opponent.'), {}, { timeout: 10_000 })).toBeInTheDocument()
    await screen.findByText(/усталявана/, {}, { timeout: 10_000 })
  }, 90_000)

  it('hard opponent (threshold 0.55): the same 0.6 overhang declines, nothing places, OUT tally 1✗', async () => {
    const user = userEvent.setup()
    // Switch the opponent to hard BEFORE the coin: the difficulty select is frozen
    // only once a game is in progress (mid-game freeze canon). The same 0.6 overhang
    // is then above the 0.55 threshold → declined.
    const figId = await signedInPractice(user, { pickDifficulty: 'hard' })
    const notation = fairPlayNotation(figId, new Set(), 11, 0.5, 0.75)
    expect(notation).not.toBeNull()

    const input = screen.getByPlaceholderText(T('figure id + point(s)'))
    await user.type(input, notation!)
    await user.click(screen.getByText('SUBMIT'))
    expect(await screen.findByText(T('Order fair play'))).toBeInTheDocument()
    await user.click(screen.getByText(T('Order fair play')))
    expect(await screen.findByDisplayValue(/адхіліў fair play/)).toBeInTheDocument()
    expect(screen.getByText(/OUT 0✓\/1✗/)).toBeInTheDocument()
    // The declined placement must NOT have landed.
    expect(screen.queryByText(/усталявана/)).toBeNull()
  }, 90_000)
})
