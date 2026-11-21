// Print&Play PDF export tests (TO_DO 45): the three download buttons drive the real
// jsPDF drawing code against a recording mock of the jsPDF class, asserting the save
// filename and that the drawing actually happened (page setup, cells, figures, footer).
// @vitest-environment jsdom
import { afterEach, afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import App from '../../src/App'
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

// Recording jsPDF: every call lands in `log` as [method, ...args]; the geometry helpers
// need internal.pageSize (A4 pt: 595×842) and splitTextToSize.
type Call = [string, ...unknown[]]
const pdfLog: Call[] = []
vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor(_opts?: unknown) { pdfLog.push(['__construct', _opts]) }
    internal = { pageSize: { getWidth: () => 595.28, getHeight: () => 841.89 } }
    splitTextToSize = (text: string): string[] => [text]
    setFont = (...a: unknown[]) => pdfLog.push(['setFont', ...a])
    setFontSize = (...a: unknown[]) => pdfLog.push(['setFontSize', ...a])
    setTextColor = (...a: unknown[]) => pdfLog.push(['setTextColor', ...a])
    setLineWidth = (...a: unknown[]) => pdfLog.push(['setLineWidth', ...a])
    setDrawColor = (...a: unknown[]) => pdfLog.push(['setDrawColor', ...a])
    setFillColor = (...a: unknown[]) => pdfLog.push(['setFillColor', ...a])
    setLineDashPattern = (...a: unknown[]) => pdfLog.push(['setLineDashPattern', ...a])
    text = (...a: unknown[]) => pdfLog.push(['text', ...a])
    rect = (...a: unknown[]) => pdfLog.push(['rect', ...a])
    roundedRect = (...a: unknown[]) => pdfLog.push(['roundedRect', ...a])
    line = (...a: unknown[]) => pdfLog.push(['line', ...a])
    circle = (...a: unknown[]) => pdfLog.push(['circle', ...a])
    addPage = () => pdfLog.push(['addPage'])
    save = (name: string) => pdfLog.push(['save', name])
  },
}))
vi.mock('jspdf-autotable', () => ({ default: () => {} }))

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
  auth.session = null
  window.localStorage.clear()
  window.localStorage.setItem('ps_geo_prompt', 'done')
  window.history.replaceState({}, '', '/')
  pdfLog.length = 0
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const T = (key: string) => translate('BY', key)

async function openPrintPlay(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click((await screen.findAllByText(T('Print & Play'))).find((el) => el.tagName === 'BUTTON')!)
  await screen.findByText(T('Container Templates'), {}, { timeout: 10_000 })
}

describe('Print & Play — PDF exports', () => {
  it('container templates: 15×10 Standard and 15×11 Beginner save with the right filenames and draw the grid', async () => {
    const user = userEvent.setup()
    await openPrintPlay(user)
    const btn10 = screen.getByText((_, el) => el?.textContent === `Спампаваць PDF — ${T('15×10 Standard')}` && el.tagName === 'BUTTON')!
    fireEvent.click(btn10)
    let saves = pdfLog.filter((c) => c[0] === 'save')
    expect(saves).toEqual([['save', 'PuzzleStow_Container_15x10_Standard.pdf']])
    // The grid is drawn with lines: 16 verticals + 11 horizontals for a 10-row sheet,
    // the cyan A0 entry cell (rect + filled circle) and the row/column labels.
    const lines10 = pdfLog.filter((c) => c[0] === 'line').length
    expect(lines10).toBeGreaterThanOrEqual(27)
    expect(pdfLog.filter((c) => c[0] === 'circle').length).toBe(1)
    expect(pdfLog.some((c) => c[0] === 'text' && c[1] === 'A')).toBe(true)
    expect(pdfLog.some((c) => c[0] === 'text' && c[1] === '9')).toBe(true)

    const btn11 = screen.getByText((_, el) => el?.textContent === `Спампаваць PDF — ${T('15×11 Beginner')}` && el.tagName === 'BUTTON')!
    fireEvent.click(btn11)
    saves = pdfLog.filter((c) => c[0] === 'save')
    expect(saves[1]).toEqual(['save', 'PuzzleStow_Container_15x11_Beginner.pdf'])
    const lines11 = pdfLog.filter((c) => c[0] === 'line').length
    expect(lines11).toBeGreaterThan(lines10)
    // Canon: the J/K separator is drawn ONLY for the 15×11 beginner sheet.
    expect(pdfLog.some((c) => c[0] === 'setLineDashPattern' && JSON.stringify(c[1]) === '[3,2]')).toBe(true)
  }, 60_000)

  it('cut-out figures: one save, cards drawn for all 27 figures', async () => {
    const user = userEvent.setup()
    await openPrintPlay(user)
    fireEvent.click(screen.getByText(T('Download Cut-Out Figures (print, cut, play)')).closest('button')!)
    expect(pdfLog.filter((c) => c[0] === 'save')).toEqual([['save', 'PuzzleStow_CutOut_Figures.pdf']])
    // 27 figures × their cell outlines: plenty of rects/roundedRects on the sheets.
    expect(pdfLog.filter((c) => c[0] === 'roundedRect' || c[0] === 'rect').length).toBeGreaterThanOrEqual(27)
  }, 60_000)

  it('complete pack: one save covering templates and the figure sheets', async () => {
    const user = userEvent.setup()
    await openPrintPlay(user)
    fireEvent.click(screen.getByText(T('Download Complete Pack (Rules + Both Templates + Figures)')).closest('button')!)
    expect(pdfLog.filter((c) => c[0] === 'save')).toEqual([['save', 'PuzzleStow_PrintPlay_Complete_Pack.pdf']])
    expect(pdfLog.filter((c) => c[0] === 'addPage').length).toBeGreaterThanOrEqual(1)
  }, 60_000)
})
