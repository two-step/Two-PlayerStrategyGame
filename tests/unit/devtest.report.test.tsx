// DevTest page — game-report PDF export (TO_DO 45): a full exchange played on the
// DevTest workbench (variant 'dev', medium opponent), then «Export (PDF)» drives the
// real jsPDF report code against the same recording mock used by the Print&Play tests.
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

const auth = { session: { user: { id: 'u1', email: 'x@y.z' } } }
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
  window.localStorage.clear()
  window.localStorage.setItem('ps_geo_prompt', 'done')
  window.history.replaceState({}, '', '/')
  pdfLog.length = 0
  vi.spyOn(Math, 'random').mockReturnValue(0.1)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const T = (key: string) => translate('BY', key)

describe('DevTest — game report PDF', () => {
  it('after a played exchange, Export (PDF) saves the report with move rows', async () => {
    const user = userEvent.setup()
    render(<App />)
    // The ● TEST banner button opens the DevTest workbench.
    await user.click(screen.getByTitle('Dev/test environment (TO_DO item 6)'))
    await screen.findByText(T('Flip the coin'), {}, { timeout: 10_000 })
    await user.click(screen.getByText(T('Flip the coin')))

    // First incoming figure → place by typed notation (strict dot order canon).
    const incoming = await screen.findByText(/^F\d\d — /, { selector: 'p' }, { timeout: 30_000 })
    const figId = parseInt(incoming.textContent!.slice(1, 3), 10)
    const fig = FIGURES.find((f) => f.id === figId)!
    const legal = rules.enumeratePlacements(fig, new Set(), 11)
    expect(legal.length).toBeGreaterThan(0)
    const cells = legal[0]
    const notation = rules.formatNotation(fig.id, fig.dots.map((i) => ({ r: cells[i][0], c: cells[i][1] })), 11)
    await user.type(screen.getByPlaceholderText(T('figure id + point(s)')), notation)
    await user.click(screen.getByText('SUBMIT'))
    await screen.findByText(/усталявана/, {}, { timeout: 15_000 })

    // The move is on record → the report export is enabled and saves a PDF.
    await user.click(screen.getByText(T('Export (PDF)')))
    const saves = pdfLog.filter((c) => c[0] === 'save')
    expect(saves).toHaveLength(1)
    expect(String(saves[0][1])).toMatch(/^PuzzleStow_Game_Report_\d{4}-\d{2}-\d{2}\.pdf$/)
    // The autoTable body got the move row (the engine text lands in the doc).
    expect(pdfLog.filter((c) => c[0] === 'text').length).toBeGreaterThan(3)
  }, 120_000)
})
