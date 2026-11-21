// RulesPage tutorial walk (TO_DO 45): drives the 10-step onboarding tutorial on the
// real Sandbox page (the tutorial lives there, behind the signed-in gate) — step
// transitions, the core-rules demos (real engine calls), placements by click and by
// typed notation, the tall-step repair demo, the fair-play both-ways demo phases, and
// the hand-over to the free sandbox with a real placement.
// Board cells are SVG <g> elements (rows render K top → A bottom, cols 0→14 left to
// right): cell (r, c) is svg.children[r * 15 + c]; a filled cell's rect stroke is
// stow-blue #1F4F82.
// @vitest-environment jsdom
import { afterEach, afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import App from '../../src/App'
import { translate } from '../../src/lib/i18n'
import * as rules from '../../src/engine/rules'
import type { Cells } from '../../src/engine/rules'
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

const auth = { session: null as null | { user: { id: string; email: string } } }
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
  // The Sandbox (tutorial) is behind the signed-in gate.
  auth.session = { user: { id: 'u1', email: 'x@y.z' } }
  window.localStorage.clear()
  window.localStorage.setItem('ps_geo_prompt', 'done')
  window.history.replaceState({}, '', '/')
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const T = (key: string) => translate('BY', key)

/** The interactive board: the only crosshair SVG, else the container SVG (≥150 cells). */
function boardSvg(): SVGSVGElement {
  const crosshair = [...document.querySelectorAll('svg')].find((el) => el.getAttribute('style')?.includes('crosshair'))
  if (crosshair) return crosshair as unknown as SVGSVGElement
  const wide = [...document.querySelectorAll('svg')].find((el) => el.children.length >= 150)
  if (!wide) throw new Error('container SVG not found')
  return wide as unknown as SVGSVGElement
}

function clickCell(user: ReturnType<typeof userEvent.setup>, r: number, c: number) {
  const cell = boardSvg().children[r * 15 + c] as SVGElement
  if (!cell) throw new Error(`no cell g at r=${r} c=${c}`)
  return user.click(cell)
}

/** The current board as a cell-key set, reconstructed from the SVG. */
function boardFilled(): Set<string> {
  const svg = boardSvg()
  const filled = new Set<string>()
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 15; c++) {
      const rect = (svg.children[r * 15 + c] as SVGElement | undefined)?.querySelector('rect')
      if (rect && rect.getAttribute('stroke') === '#1F4F82') filled.add(`${r},${c}`)
    }
  }
  return filled
}

function currentStep(): string | null {
  const m = (document.body.textContent ?? '').match(/КРОК (\d+) З 10/)
  return m ? m[1] : null
}

async function nextStepLabel(user: ReturnType<typeof userEvent.setup>, expected: string) {
  for (const label of [T('Next →'), T('Next rule →'), T('Next step →')]) {
    const btn = screen.queryAllByText(label).find((el) => el.tagName === 'BUTTON')
    if (btn) { await user.click(btn); break }
  }
  await screen.findByText(new RegExp('КРОК ' + expected + ' З 10 —'), {}, { timeout: 5000 })
}

/** Plans placements for a figure sequence on an empty board with backtracking —
 * candidates ordered by the dead cells they create, so the whole list stays placeable. */
function planPlacement(ids: number[]): Cells[] {
  const result: Cells[] = []
  function dfs(i: number, filled: Set<string>): boolean {
    if (i === ids.length) return true
    const fig = FIGURES.find((f) => f.id === ids[i])!
    const scored = rules.enumeratePlacements(fig, filled, 11).map((cells) => {
      const next = new Set(filled)
      cells.forEach(([r, c]) => next.add(rules.cellKey(r, c)))
      return { cells, dead: rules.computeDeadCells(next, 11).size }
    }).sort((a, b) => a.dead - b.dead)
    for (const { cells, dead } of scored) {
      void dead
      result.push(cells)
      const next = new Set(filled)
      cells.forEach(([r, c]) => next.add(rules.cellKey(r, c)))
      if (dfs(i + 1, next)) return true
      result.pop()
    }
    return false
  }
  expect(dfs(0, new Set()), 'no full plan exists for the sequence ' + ids.join(',')).toBe(true)
  return result
}

function planNotation(plans: Cells[], idx: number, figId: number): string {
  const cells = plans[idx]
  const fig = FIGURES.find((f) => f.id === figId)!
  return rules.formatNotation(fig.id, fig.dots.map((i) => ({ r: cells[i][0], c: cells[i][1] })), 11)
}

// initStep() resets the board entering steps 5, 6 and 7 — the placements are three
// INDEPENDENT sequences, each planned on its own empty board (SHIPMENT_FIGS canon).
const PLAN_STEP5 = planPlacement([15])
const PLAN_STEP6 = planPlacement([15])
const PLAN_SHIPMENT = planPlacement([8, 17, 9, 11, 27, 13, 23])

describe('Sandbox — tutorial walk (10 steps)', () => {
  it('walks the whole tutorial: place, notation, rule demos, tall-step repair, fair-play demo, free sandbox', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click((await screen.findAllByText(T('Sandbox'))).find((el) => el.tagName === 'BUTTON')!)
    await screen.findByText(new RegExp('КРОК 1 З 10 —'), {}, { timeout: 10_000 })
    expect(currentStep()).toBe('1')

    // Step 2: the handed Mono is placed by clicking the bottom row (canon: entrance A0).
    await user.click(screen.getByText(T('Start →')))
    await screen.findByText(new RegExp('КРОК 2 З 10 —'), {}, { timeout: 5000 })
    await clickCell(user, 10, 8)
    await user.click(screen.getByText(T('Place')))
    await screen.findByText(new RegExp('КРОК 3 З 10 —'), {}, { timeout: 5000 })

    // Step 3 (notation recap): advance.
    await nextStepLabel(user, '4')

    // Step 4: the four CORE-RULES demos (real engine calls inside).
    for (let i = 0; i < 3; i++) await user.click(screen.getByText(T('Next rule →')))
    await user.click(screen.getByText(T('Next step →')))
    await screen.findByText(new RegExp('КРОК 5 З 10 —'), {}, { timeout: 5000 })

    // Step 5: F15 needs TWO clicks in dot order — first click = dot1, second = dot2.
    const plan5 = PLAN_STEP5[0]
    const fig5 = FIGURES.find((f) => f.id === 15)!
    await clickCell(user, plan5[fig5.dots[0]][0], plan5[fig5.dots[0]][1])
    await clickCell(user, plan5[fig5.dots[1]][0], plan5[fig5.dots[1]][1])
    await user.click(screen.getByText(T('Place')))
    // The placement lands, the advisory shows — advance to the notation step.
    await user.click(screen.getByText(T('Next →')))
    await screen.findByText(new RegExp('КРОК 6 З 10 —'), {}, { timeout: 5000 })

    // Step 6: place F15 again by TYPED notation (same engine path, fresh board).
    const notationInput = await screen.findByPlaceholderText('15A5B7', {}, { timeout: 5000 })
    await user.type(notationInput, planNotation(PLAN_STEP6, 0, 15))
    await user.click(screen.getAllByText(T('Place')).at(-1)!)
    // Step 6's Next is a hardcoded Latin literal (canon quirk).
    await user.click(screen.getAllByText('Next →').at(-1)!)
    await screen.findByText(new RegExp('КРОК 7 З 10 —'), {}, { timeout: 5000 })

    // Step 7: the shipment — all SHIPMENT_FIGS fed one at a time, each by notation.
    for (let i = 0; i < PLAN_SHIPMENT.length; i++) {
      const sid = [8, 17, 9, 11, 27, 13, 23][i]
      const input = screen.getByPlaceholderText(translate('BY', 'or type notation, e.g. {ex}', { ex: '08C0B0A0A1' }))
      await user.clear(input)
      await user.type(input, planNotation(PLAN_SHIPMENT, i, sid))
      await user.click(screen.getByText(T('Place (from notation)')))
      await new Promise((r) => setTimeout(r, 300))
    }
    await user.click(screen.getAllByText(T('Next →')).at(-1)!)
    await screen.findByText(new RegExp('КРОК 8 З 10 —'), {}, { timeout: 5000 })

    // Step 8 (tall step): F01 on top of the 4-high wall is ILLEGAL until an intermediate
    // step is built (the engine says so verbatim). Find a repair placement from the
    // bank that makes the above-wall cell reachable, place it, then place F01 on top.
    const aboveWall: Cells = [[6, 7]]
    let repair: { fid: number; cells: Cells } | null = null
    for (const fid of [1, 2, 3]) {
      for (const cells of rules.enumeratePlacements(FIGURES.find((f) => f.id === fid)!, boardFilled(), 11)) {
        if (cells.some(([r, c]) => r === 6 && c === 7)) continue
        const next = new Set(boardFilled())
        cells.forEach(([r, c]) => next.add(rules.cellKey(r, c)))
        if (rules.checkPlacement(aboveWall, next, 11).ok) { repair = { fid, cells }; break }
      }
      if (repair) break
    }
    expect(repair, 'no repair placement makes the above-wall cell reachable').not.toBeNull()
    await user.click(screen.getByText('F' + String(repair!.fid).padStart(2, '0'), { selector: 'button' }))
    for (const i of FIGURES.find((f) => f.id === repair!.fid)!.dots) {
      await clickCell(user, repair!.cells[i][0], repair!.cells[i][1])
    }
    await user.click(screen.getByText(T('Place')))
    await new Promise((r) => setTimeout(r, 400))
    // Now F01 rests on top of the wall → stepClimbDone → Next. The bridged section's
    // bank renders «F01 — Mono» (label — name), the unbridged one just «F01».
    await user.click(screen.getByText(/^F01( — |$)/, { selector: 'button' }))
    await clickCell(user, 6, 7)
    await user.click(screen.getByText(T('Place')))
    await user.click(await screen.findByText(T('Next →'), {}, { timeout: 5000 }))
    await screen.findByText(new RegExp('КРОК 9 З 10 —'), {}, { timeout: 5000 })

    // Step 9: fair play both ways — confirm first, then the decline phase.
    await user.click(screen.getByText(T('✓ Opponent confirms')))
    expect(screen.getByText(T('Placed — both players confirmed it.'))).toBeInTheDocument()
    // Canon: «See the decline instead →» returns to the pending phase — the actual
    // decline comes from the opponent's ✗ button there.
    await user.click(screen.getByText(T('See the decline instead →')))
    await user.click(screen.getByText(T('✗ Opponent declines')))
    expect(await screen.findByText(T('Declined — nothing was placed.'), {}, { timeout: 5000 })).toBeInTheDocument()
    await user.click(screen.getByText(T('Next →')))
    await screen.findByText(new RegExp('КРОК 10 З 10 —'), {}, { timeout: 5000 })

    // Step 10 → completion (its own «Finish tutorial →» button) → free sandbox.
    await user.click(await screen.findByText(T('Finish tutorial →'), {}, { timeout: 5000 }))
    await user.click(await screen.findByText(T('Continue to free sandbox →'), {}, { timeout: 5000 }))

    // Free mode: a real placement — the bank cards carry title «F01 <name>».
    const bankCard = [...document.querySelectorAll('button[title^="F01 "]')][0] as HTMLButtonElement
    expect(bankCard).not.toBeNull()
    await user.click(bankCard)
    const selected = await screen.findByText(/ВЫБРАНА — F[0-9][0-9]/, {}, { timeout: 5000 })
    const figId = parseInt(selected.textContent!.match(/\d\d/)![0], 10)
    const fig = FIGURES.find((f) => f.id === figId)!
    const legal = rules.enumeratePlacements(fig, boardFilled(), 11)
    expect(legal.length).toBeGreaterThan(0)
    const cells = legal[0]
    for (const i of fig.dots) {
      await clickCell(user, cells[i][0], cells[i][1])
    }
    await user.click(screen.getByText(T('Place')))
    expect(selected.textContent).toContain(fig.label)
  }, 150_000)
})
