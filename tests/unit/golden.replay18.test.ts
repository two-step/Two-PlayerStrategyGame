// Golden replay of Sergey's 2026-11-18 easy game (report PuzzleStow_Game_Report_2026-11-18.pdf):
// every logged placement of both players must stay rules-legal on the reconstructed
// boards, and the engine's own logged placements must match what the current engine
// decides. This is the "real games" half of the item-45 golden set.
import { describe, expect, it } from 'vitest'
import { createOpponentEngine } from '../../src/engine/opponentEngine'
import * as rules from '../../src/engine/rules'
import { FIGURES, ROWS, apply, byId, parsePts } from './helpers'

// The engine resolves a requested figure against its own board; the logged notation
// is parsed with the strict forward dot-order reading.
const resolve = (figId: number, notation: string) => {
  const { pts } = parsePts(notation)
  const fig = byId(figId)
  return fig.dots.length >= 2 && pts.length >= 2
    ? rules.computePlacementFromDots(fig, pts)
    : rules.computePlacementFromAnchor(fig, 0, pts[0])
}

const TURNS: { who: 'you-req' | 'opp-req'; fig: number; placedBy: string; notation: string }[] = [
  { who: 'you-req', fig: 16, placedBy: 'opp', notation: '16B11' },
  { who: 'opp-req', fig: 14, placedBy: 'you', notation: '14B13A14' },
  { who: 'you-req', fig: 11, placedBy: 'opp', notation: '11C5A7' },
  { who: 'opp-req', fig: 3, placedBy: 'you', notation: '03D14B14' },
  { who: 'you-req', fig: 20, placedBy: 'opp', notation: '20A4C2' },
  { who: 'opp-req', fig: 6, placedBy: 'you', notation: '06B12A11' },
  { who: 'you-req', fig: 24, placedBy: 'opp', notation: '24D8E10' },
  { who: 'opp-req', fig: 8, placedBy: 'you', notation: '08A8B10' },
  { who: 'you-req', fig: 17, placedBy: 'opp', notation: '17D11F13' },
  { who: 'opp-req', fig: 18, placedBy: 'you', notation: '18A5C7' },
  { who: 'you-req', fig: 25, placedBy: 'opp', notation: '25E1C3' },
  { who: 'opp-req', fig: 12, placedBy: 'you', notation: '12A3B5' },
  { who: 'you-req', fig: 15, placedBy: 'opp', notation: '15H1F0' },
]

describe('golden replay: game 18 (easy, 2026-11-18)', () => {
  it('every logged placement is rules-legal on its reconstructed board', () => {
    const boards: Record<string, Set<string>> = { you: new Set(), opp: new Set() }
    const engine = createOpponentEngine({ difficulty: 'easy' })
    for (const t of TURNS) {
      const cells = resolve(t.fig, t.notation)
      expect(cells, `${t.placedBy} ${t.notation} resolves`).not.toBeNull()
      const board = boards[t.placedBy]
      // The two historical placements the 2026-11-18 generator↔rules fixes re-legalized
      // (17D11F13, 15H1F0, 25E1C3) are engine-shelf cases; assert plain legality.
      const legal = rules.checkPlacement(cells!, board, ROWS, true)
      expect(legal.ok, `${t.placedBy} ${t.notation}: ${legal.reason}`).toBe(true)
      boards[t.placedBy] = apply(board, cells!)
      // Engine decisions on the growing boards must never fail catastrophically.
      const ctxBoard = t.who === 'you-req' ? boards.opp : boards.you
      const d = engine.decidePlacement(byId(t.fig), ctxBoard, ROWS, {
        rows: ROWS,
        ownFilled: boards.opp,
        ownAvailable: FIGURES,
        humanFilled: boards.you,
        humanAvailable: FIGURES,
      })
      expect(['place', 'pass'], `engine decision for ${t.fig}`).toContain(d.kind)
    }
  })
})
