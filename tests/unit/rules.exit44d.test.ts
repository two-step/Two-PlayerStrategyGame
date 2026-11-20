// 44d exit-sealing tests vs the entrance-stack height (Sergey's data points):
// stack 2 (F26 case) open, stack 3 (F25@25C0A2, report (4) move 10) open,
// stack 4 (F21 case) sealed. Plus dead-cell canon (44f/g, seeded from the entrance).
import { describe, expect, it } from 'vitest'
import * as rules from '../../src/engine/rules'
import { ROWS, cellName, parsePts, rawKit } from './helpers'

const { allSolutions } = rawKit

const filledCol = (col: number, fromRow: number, toRow: number) => {
  const set = new Set<string>()
  const cells: [number, number][] = []
  for (let r = fromRow; r <= toRow; r++) {
    cells.push([r, col])
    set.add(rules.cellKey(r, col))
  }
  return { set, cells }
}

describe('44d: entrance stack height bounds the return path', () => {
  it('entrance stack of 4 seals the exit (F21 case)', () => {
    const { set, cells } = filledCol(0, 7, 10)
    expect(rules.hasReturnPath(set, ROWS, cells)).toBe(false)
  })

  it('entrance stack of 2 stays open (F26 covering A0)', () => {
    const { set, cells } = filledCol(0, 9, 10)
    expect(rules.hasReturnPath(set, ROWS, cells)).toBe(true)
  })

  it('F25@25C0A2 — stack of 3 is climbable out, the report-(4) loss was false', () => {
    const board = new Set<string>()
    for (const [figId, n] of [[23, '23B11A9'], [3, '03A11A13'], [6, '06A14B13'], [10, '10A3C5']] as const) {
      const { pts } = parsePts(n)
      const sol = allSolutions(figId, pts).find((s) => rules.checkPlacement(s, board, ROWS).ok)
      expect(sol, `${figId} ${n} must be replayable`).toBeDefined()
      sol!.forEach(([r, c]) => board.add(rules.cellKey(r, c)))
    }
    const { pts } = parsePts('25C0A2')
    const f25 = allSolutions(25, pts).find((s) => rules.checkPlacement(s, board, ROWS).ok)
    expect(f25, 'F25@25C0A2 must be placeable').toBeDefined()
    const res = rules.checkPlacement(f25!, board, ROWS)
    expect(res.ok).toBe(true)
    expect(res.sealsExit ?? false).toBe(false)
    const next = new Set(board)
    f25!.forEach(([r, c]) => next.add(rules.cellKey(r, c)))
    expect(rules.hasReturnPath(next, ROWS, f25!)).toBe(true)
    // and no step > 3 anywhere, per Sergey's observation
    const heights = rules.colHeights(next, ROWS)
    const maxStep = Math.max(...heights.slice(0, 14).map((h, i) => Math.abs(h - heights[i + 1])))
    expect(maxStep).toBeLessThanOrEqual(3)
  })
})

describe('dead cells (44f): flood seeded from the entrance, ceiling closes', () => {
  it('everything sealed off from the entrance by a solid wall is dead; the left side stays alive', () => {
    const filled = new Set<string>()
    for (let r = 0; r < ROWS; r++) filled.add(rules.cellKey(r, 5)) // solid wall across col 5
    const dead = rules.computeDeadCells(filled, ROWS)
    expect(dead.size).toBeGreaterThan(0)
    const deadCols = [...dead].map((k) => k.split(',').map(Number))
    expect(deadCols.every(([, c]) => c > 5), `right of the wall only (${deadCols.map(([r, c]) => cellName(r, c)).join(' ')})`).toBe(true)
    // The left side keeps its entrance-connected air alive.
    expect(dead.has(rules.cellKey(ROWS - 1, 2))).toBe(false)
    expect(dead.has(rules.cellKey(0, 2))).toBe(false)
  })

  it('a door in the wall keeps the far region alive («пока есть хоть какой-то проход»)', () => {
    const filled = new Set<string>()
    for (let r = 0; r < ROWS; r++) filled.add(rules.cellKey(r, 5))
    filled.delete(rules.cellKey(ROWS - 1, 5)) // A5 door, entrance-connected
    const dead = rules.computeDeadCells(filled, ROWS)
    expect(dead.size).toBe(0)
  })
})

describe('row/column closure (44g) respects dead cells', () => {
  it('a fully filled row with dead cells is NOT closed; the same row without them is', () => {
    const wall = new Set<string>()
    for (let r = 0; r < ROWS; r++) wall.add(rules.cellKey(r, 5))
    const deadBeforeFill = rules.computeDeadCells(wall, ROWS)
    // Simulate: every cell of row A gets filled (including formerly dead A6..A14).
    const rowAFull = new Set(wall)
    for (let c = 0; c < 15; c++) rowAFull.add(rules.cellKey(ROWS - 1, c))
    expect(rules.closedRows(rowAFull, ROWS, deadBeforeFill).has(ROWS - 1)).toBe(false)
    // Without the dead-cell argument (or with recomputed dead cells) it closes.
    expect(rules.closedRows(rowAFull, ROWS).has(ROWS - 1)).toBe(true)
  })

  it('a fully filled column closes (the 2026-09-07 both-orientations fix)', () => {
    const filled = new Set<string>()
    for (let r = 0; r < ROWS; r++) filled.add(rules.cellKey(r, 3))
    expect(rules.closedCols(filled, ROWS).has(3)).toBe(true)
    expect(rules.closedRows(filled, ROWS).size).toBe(0)
  })
})
