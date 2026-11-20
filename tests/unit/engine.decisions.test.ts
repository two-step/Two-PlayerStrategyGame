// Opponent-engine decision tests (TO_DO 30a–g golden regressions): enumerated legality,
// floor flexibility, handover denial, forced-pass preference, no rigid template,
// endgame honest-44e fallback, fair-play responses.
import { describe, expect, it } from 'vitest'
import { createOpponentEngine } from '../../src/engine/opponentEngine'
import * as rules from '../../src/engine/rules'
import type { EngineBoardContext } from '../../src/engine/opponentEngine'
import { FIGURES, ROWS, rawKit, byId, cellName, parsePts } from './helpers'

// Notation-parsing golden cases (F17/F09/F05 boards) reconstruct in the raw-otgruzka
// binding the legacy scripts verified against the game screenshots.
const raw = rawKit

const sameCells = (a: [number, number][], b: [number, number][]) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

const legalByEnumerator = (figId: number, filled: Set<string>, cells: [number, number][]) =>
  rules.enumeratePlacements(byId(figId), filled, ROWS)
    .some((move) => sameCells(move, cells))

const ctx = (own: Set<string>, human: Set<string>, ownUsed?: number[], humanUsed?: number[]): EngineBoardContext => ({
  rows: ROWS,
  ownFilled: own,
  ownAvailable: FIGURES.filter((f) => !ownUsed?.includes(f.id)),
  humanFilled: human,
  humanAvailable: FIGURES.filter((f) => !humanUsed?.includes(f.id)),
})

describe('enumerated legality obedience (30a)', () => {
  it('every difficulty emits only positions from the rules enumerator', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const decision = createOpponentEngine({ difficulty })
        .decidePlacement(byId(27), new Set(), ROWS, ctx(new Set(), new Set()))
      expect(decision.kind).toBe('place')
      if (decision.kind !== 'place') continue
      expect(legalByEnumerator(27, new Set(), decision.cells), `${difficulty} legal`).toBe(true)
    }
  })

  it('easy starts at the right-bottom far from entrance A0', () => {
    const move = createOpponentEngine({ difficulty: 'easy' }).decidePlacement(byId(1), new Set(), ROWS)
    expect(move.kind).toBe('place')
    if (move.kind !== 'place') return
    expect(move.cells[0][0]).toBe(ROWS - 1)
    expect(move.cells[0][1]).toBe(14)
  })
})

describe('F16 opening keeps row A flexible (30d, verify30)', () => {
  const floorProviders = (filled: Set<string>, col: number) =>
    FIGURES.filter((f) =>
      rules.enumeratePlacements(f, filled, ROWS)
        .some((cs) => cs.some(([r, c]) => r === ROWS - 1 && c === col))).length

  it('every level: every open floor cell keeps ≥2 distinct providers after the opening', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const d = createOpponentEngine({ difficulty })
        .decidePlacement(byId(16), new Set(), ROWS, ctx(new Set(), new Set()))
      expect(d.kind).toBe('place')
      if (d.kind !== 'place') continue
      const after = new Set(d.cells.map(([r, c]) => rules.cellKey(r, c)))
      const openFloor = [...Array(15).keys()].filter((c) => !after.has(rules.cellKey(ROWS - 1, c)))
      const minProviders = Math.min(...openFloor.map((c) => floorProviders(after, c)))
      expect(minProviders, `${difficulty} opening`).toBeGreaterThanOrEqual(2)
    }
  })

  it('hard returns a legal F16 opening that preserves a loader route to A13 (regress30)', () => {
    const engine = createOpponentEngine({ difficulty: 'hard' })
    const move = engine.decidePlacement(byId(16), new Set(), ROWS, ctx(new Set(), new Set()))
    expect(move.kind).toBe('place')
    if (move.kind !== 'place') return
    expect(legalByEnumerator(16, new Set(), move.cells)).toBe(true)
    const after = new Set(move.cells.map(([r, c]) => rules.cellKey(r, c)))
    const a13Coverable = FIGURES.some((f) =>
      rules.enumeratePlacements(f, after, ROWS).some((cs) => cs.some(([r, c]) => r === ROWS - 1 && c === 13)))
    expect(a13Coverable).toBe(true)
  })
})

describe('handover reasoning (30a/verify30)', () => {
  it('hard never hands F01 into a 1-cell-short row A while safer figures exist', () => {
    const humanFilled = new Set<string>()
    for (let c = 0; c < 14; c++) humanFilled.add(rules.cellKey(ROWS - 1, c))
    const pool = [1, 2, 5, 7]
    const eng = createOpponentEngine({ difficulty: 'hard' })
    const picks = new Set<number>()
    for (let i = 0; i < 60; i++) {
      const d = eng.chooseFigureToRequest(
        FIGURES.filter((f) => pool.includes(f.id)), null,
        ctx(new Set(), humanFilled, undefined, pool),
      )
      if (d.kind === 'request') picks.add(d.figureId)
    }
    expect(picks.has(1)).toBe(false)
    expect(picks.size).toBeGreaterThanOrEqual(1)
  })

  it('medium always prefers a figure the human cannot legally place (forced pass)', () => {
    const sealed = new Set<string>()
    for (let c = 0; c < 15; c++) for (let r = 1; r < ROWS; r++) sealed.add(rules.cellKey(r, c))
    for (const c of [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]) sealed.add(rules.cellKey(ROWS - 1, c))
    let forced = 0
    for (let i = 0; i < 40; i++) {
      const d = createOpponentEngine({ difficulty: 'medium' })
        .chooseFigureToRequest(FIGURES, null, ctx(new Set(), sealed))
      if (d.kind !== 'request') continue
      const canPlace = rules.enumeratePlacements(byId(d.figureId), sealed, ROWS).length > 0
      if (!canPlace) forced++
    }
    expect(forced).toBe(40)
  })

  it('hard requests are not ascending-id sequential (no rigid template)', () => {
    const eng = createOpponentEngine({ difficulty: 'hard' })
    const seq: number[] = []
    for (let i = 0; i < 12; i++) {
      const d = eng.chooseFigureToRequest(FIGURES, null, ctx(new Set(), new Set()))
      if (d.kind === 'request') seq.push(d.figureId)
    }
    expect(seq.every((id, i) => i === 0 || id > seq[i - 1])).toBe(false)
  })
})

describe('delivery ruling: the engine never picks F17@17C14A12 anymore', () => {
  it('the engine places or passes legally for F17 on the report-(3) board', () => {
    const board = raw.buildBoard([[25, '25C10A8']])
    const f16 = byId(16)
    for (let i = 0; i < 4; i++) {
      const cells = rules.computePlacementFromAnchor(f16, i, { r: 9, c: 11 })
      if (rules.checkPlacement(cells, board, ROWS).ok) {
        cells.forEach(([r, c]) => board.add(rules.cellKey(r, c)))
        break
      }
    }
    const used = [25, 16]
    const engine = createOpponentEngine({ difficulty: 'medium' })
    const d = engine.decidePlacement(byId(17), board, ROWS, ctx(board, new Set(), used))
    if (d.kind === 'place') {
      expect(rules.checkPlacement(d.cells, board, ROWS).ok).toBe(true)
      // and it must NOT be the ruled-out 17C14A12 binding
      const { pts } = parsePts('17C14A12')
      const forbidden = raw.allSolutions(17, pts).map((s) => JSON.stringify([...s].sort()))
      expect(forbidden).not.toContain(JSON.stringify([...d.cells].sort()))
    } else {
      expect(['pass', 'request']).toContain(d.kind)
    }
  })
})

describe('endgame honest-44e (report (4) final board)', () => {
  it('canPlaceAnywhere(F05) is true and the engine PLACES the sealing 05E0A0', () => {
    const opp = raw.buildBoard([
      [21, '21B11A9'], [10, '10A5C7'], [7, '07C4B5'], [23, '23B13A11'], [26, '26A4B1'],
      [4, '04E2B2'], [16, '16E5'], [25, '25F12D10'], [11, '11I4G6'], [27, '27G4F1'],
    ])
    expect(rules.canPlaceAnywhere(byId(5), opp, ROWS)).toBe(true)
    const engine = createOpponentEngine({ difficulty: 'medium' })
    // The script context: the engine's pool is exhausted (ownAvailable []).
    const d = engine.decidePlacement(byId(5), opp, ROWS, {
      rows: ROWS, ownFilled: opp, ownAvailable: [], humanFilled: new Set(), humanAvailable: [],
    })
    expect(d.kind).toBe('place')
    if (d.kind !== 'place') return
    const after = new Set(opp)
    d.cells.forEach(([r, c]) => after.add(rules.cellKey(r, c)))
    // The desperate fallback load seals the exit → the 44d loss is declared after it lands.
    expect(rules.hasReturnPath(after, ROWS, d.cells)).toBe(false)
    expect(rules.checkPlacement(d.cells, opp, ROWS).ok).toBe(true)
  })
})

describe('fair play (44c): the opponent judges only the overhang ratio', () => {
  it('respondToFairPlay accepts a mild overhang and challenges one past its threshold', () => {
    const engine = createOpponentEngine({ difficulty: 'medium' })
    const mild = engine.respondToFairPlay(0.2)
    const heavy = engine.respondToFairPlay(0.8)
    expect(mild.kind).toBe('fair_play_response')
    if (mild.kind === 'fair_play_response') expect(mild.approve).toBe(true)
    expect(heavy.kind).toBe('fair_play_response')
    if (heavy.kind === 'fair_play_response') expect(heavy.approve).toBe(false)
    // Threshold sanity: hard challenges anything above 0.55.
    const hardEngine = createOpponentEngine({ difficulty: 'hard' })
    const borderline = hardEngine.respondToFairPlay(0.56)
    if (borderline.kind === 'fair_play_response') expect(borderline.approve).toBe(false)
    expect(cellName(ROWS - 1, 0)).toBe('A0') // orientation canon smoke check
  })
})
