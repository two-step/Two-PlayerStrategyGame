// Shared helpers for the PuzzleStow engine test suite (TO_DO item 45).
// Orientation canon: row A at the BOTTOM (r = ROWS-1), row K on top, entrance A0
// (bottom-left), columns 0–14 left-to-right.
//
// DOT-BINDING MODES — the golden sources use two, both verified against Sergey's
// screenshots:
//   'left-first' — the notation canon (dot1 = the LEFT dot of the original figure,
//     Sergey 2026-11-18/19). App.tsx FIGURES, replay18 and the notation regressions
//     live here.
//   'otgruzka'   — the raw reference_dots list order. The delivery/exit44d/endgame
//     golden scripts reconstruct their historical boards in this binding (their
//     boards were verified byte-for-byte against the game screenshots), so those
//     tests must reconstruct with it too.
import figuresJson from '../fixtures/otgruzka_figures.json'
import type { Cells, FigureDef } from '../../src/engine/rules'
import * as rules from '../../src/engine/rules'

export const ROWS = 11
export const ROW_LABELS = rules.ROW_LABELS
export type DotMode = 'left-first' | 'otgruzka'

interface OtruzkaFigure { id: number; cells: number[][]; cells_count: number; reference_dots: number[][] }

interface FigureKit {
  figures: FigureDef[]
  byId(id: number): FigureDef
  allSolutions(figId: number, pts: { r: number; c: number }[]): Cells[]
  firstLegal(figId: number, notation: string, filled: Set<string>): Cells
  buildBoard(moves: [number, string][]): Set<string>
}

function makeKit(mode: DotMode): FigureKit {
  const figures: FigureDef[] = (figuresJson.figures as unknown as OtruzkaFigure[]).map((f) => {
    const cells = f.cells.map(([r, c]) => [r, c] as [number, number])
    const dotIdx = f.reference_dots.map(([r, c]) => cells.findIndex((p) => p[0] === r && p[1] === c))
    const dots = mode === 'left-first' && dotIdx.length === 2
      ? [...dotIdx].sort((a, b) => cells[a][1] - cells[b][1])
      : dotIdx
    return { id: f.id, name: `Figure-${f.id}`, label: `F${String(f.id).padStart(2, '0')}`, cells, size: f.cells_count, dots }
  })
  const byId = (id: number): FigureDef => {
    const fig = figures.find((f) => f.id === id)
    if (!fig) throw new Error(`Unknown figure id ${id}`)
    return fig
  }
  // Reconstruction priority (as the golden scripts encode it): the forward pairing is
  // tried against ALL orientations before the reversed one.
  const allSolutions = (figId: number, pts: { r: number; c: number }[]): Cells[] => {
    const fig = byId(figId)
    const [d0, d1] = fig.dots
    const out: Cells[] = []
    if (fig.dots.length < 2) {
      for (let i = 0; i < 4; i++) out.push(rules.computePlacementFromAnchor(fig, i, pts[0]))
      return out
    }
    rules.getOrientations(fig.cells).forEach((ori) => {
      const a = ori[d0], b = ori[d1]
      if (pts[1].r - pts[0].r === b[0] - a[0] && pts[1].c - pts[0].c === b[1] - a[1]) {
        out.push(ori.map(([r, c]) => [r + pts[0].r - a[0], c + pts[0].c - a[1]] as [number, number]))
      }
    })
    rules.getOrientations(fig.cells).forEach((ori) => {
      const a = ori[d0], b = ori[d1]
      if (pts[0].r - pts[1].r === b[0] - a[0] && pts[0].c - pts[1].c === b[1] - a[1]) {
        out.push(ori.map(([r, c]) => [r + pts[1].r - a[0], c + pts[1].c - a[1]] as [number, number]))
      }
    })
    return out
  }
  const firstLegal = (figId: number, notation: string, filled: Set<string>): Cells => {
    const { pts } = parsePts(notation)
    const sol = allSolutions(figId, pts).find((s) => rules.checkPlacement(s, filled, ROWS).ok)
    if (!sol) throw new Error(`${figId} ${notation} has no legal solution on this board`)
    return sol
  }
  // Blind reconstruction, exactly as the golden scripts do (first solution, no filter).
  const buildBoard = (moves: [number, string][]): Set<string> => {
    const out = new Set<string>()
    for (const [id, n] of moves) {
      const { pts } = parsePts(n)
      const sol = allSolutions(id, pts)[0]
      if (!sol) throw new Error(`Reconstruction gap: ${id} ${n} resolves to nothing`)
      sol.forEach(([r, c]) => out.add(rules.cellKey(r, c)))
    }
    return out
  }
  return { figures, byId, allSolutions, firstLegal, buildBoard }
}

/** Parse a logged placement string "NNX[..]Y" into its figure id and dot anchor points. */
export function parsePts(notation: string): { figId: number; pts: { r: number; c: number }[] } {
  const m = notation.match(/^(\d{2})((?:[A-K]\d{1,2}){1,2})$/)
  if (!m) throw new Error(`Bad notation: ${notation}`)
  const pts = [...m[2].matchAll(/([A-K])(\d{1,2})/g)].map((x) => ({
    r: ROWS - 1 - ROW_LABELS.indexOf(x[1]),
    c: parseInt(x[2], 10),
  }))
  return { figId: parseInt(m[1], 10), pts }
}

/** Cell name in the game notation, e.g. "A0" (bottom-left entrance) or "K14". */
export function cellName(r: number, c: number): string {
  return `${ROW_LABELS[ROWS - 1 - r]}${c}`
}

/** A filled-set copy with the given placement cells added. */
export function apply(filled: Set<string>, cells: Cells): Set<string> {
  const next = new Set(filled)
  cells.forEach(([r, c]) => next.add(rules.cellKey(r, c)))
  return next
}

/** Canonical comparable key of a cell set (sorted JSON) — order-insensitive comparison. */
export function keyOf(cells: Cells): string {
  return JSON.stringify([...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]))
}

/** The left-first canon kit (App FIGURES / notation canon / replay18). */
export const canonKit = makeKit('left-first')
/** The raw-otgruzka kit (the delivery/exit44d/endgame golden boards). */
export const rawKit = makeKit('otgruzka')
/** Default kit for engine-behaviour tests that never parse logged notation. */
export const FIGURES = canonKit.figures
export const byId = canonKit.byId
export const allSolutions = canonKit.allSolutions
export const buildBoard = canonKit.buildBoard
export const firstLegal = canonKit.firstLegal
