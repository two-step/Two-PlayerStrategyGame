// Delivery-model tests: the silhouette-transit canon (sub-item 9) and the walk/bend
// canon («будем учить ходить», 21) — Sergey's ruled cases, kept as golden regressions.
// Orientation canon: row A at the BOTTOM, entrance A0, columns 0–14 left-to-right.
import { describe, expect, it } from 'vitest'
import * as rules from '../../src/engine/rules'
import { ROWS, parsePts, rawKit } from './helpers'

const { byId, allSolutions, buildBoard, firstLegal } = rawKit

describe('delivery: silhouette transit (rigid sliding from A0)', () => {
  it('F17@17C14A12 «проход в две ячейки» is REJECTED on the report-(3) board', () => {
    const board = buildBoard([[25, '25C10A8']])
    const f16 = byId(16)
    for (let i = 0; i < 4; i++) {
      const cells = rules.computePlacementFromAnchor(f16, i, { r: 9, c: 11 })
      if (rules.checkPlacement(cells, board, ROWS).ok) {
        cells.forEach(([r, c]) => board.add(rules.cellKey(r, c)))
        break
      }
    }
    const { pts } = parsePts('17C14A12')
    const anyLegal = allSolutions(17, pts).some((s) => rules.checkPlacement(s, board, ROWS).ok)
    expect(anyLegal).toBe(false)
  })

  it('blessed T 24C11A12 under the lintel stays LEGAL', () => {
    const f20cells = firstLegal(20, '20A14C12', new Set())
    const board = new Set(f20cells.map(([r, c]) => rules.cellKey(r, c)))
    const t = firstLegal(24, '24C11A12', board)
    expect(t).toBeDefined()
  })

  it('the easy-game replayable moves all stay LEGAL', () => {
    const easyTurns: [string, number, string][] = [
      ['opp', 16, '16B11'], ['you', 14, '14B13A14'], ['opp', 11, '11C5A7'], ['you', 3, '03D14B14'],
      ['opp', 20, '20A4C2'], ['you', 6, '06B12A11'], ['opp', 24, '24D8E10'], ['you', 8, '08A8B10'],
      ['you', 18, '18A5C7'], ['you', 12, '12A3B5'],
    ]
    const boards: Record<string, Set<string>> = { opp: new Set(), you: new Set() }
    for (const [who, figId, n] of easyTurns) {
      const { pts } = parsePts(n)
      const sol = allSolutions(figId, pts).find((s) => rules.checkPlacement(s, boards[who], ROWS).ok)
      expect(sol, `${who} ${n} must stay legal`).toBeDefined()
      sol!.forEach(([r, c]) => boards[who].add(rules.cellKey(r, c)))
    }
  })

  it('report (3): the other four moves stay LEGAL', () => {
    const opp = new Set<string>()
    for (const [figId, n] of [[25, '25C10A8'], [16, '16B11']] as const) {
        const sol = firstLegal(figId, n, opp)
      sol.forEach(([r, c]) => opp.add(rules.cellKey(r, c)))
    }
    const you = new Set<string>()
    for (const [figId, n] of [[23, '23B11A9'], [3, '03A11A13']] as const) {
      const sol = firstLegal(figId, n, you)
      sol.forEach(([r, c]) => you.add(rules.cellKey(r, c)))
    }
    expect(opp.size).toBeGreaterThan(0)
    expect(you.size).toBeGreaterThan(0)
  })

  it('F11@11C5A7 — the W-staircase slides through a 2-wide stepped pocket (report 15:26)', () => {
    const board = buildBoard([
      [24, '24C13A14'], [26, '26A11B8'], [12, '12A3B5'], [6, '06C11B12'], [25, '25E10C12'],
    ])
    const placed = firstLegal(11, '11C5A7', board)
    expect(placed).toBeDefined()
  })

  it('F04@04D13A13 and the report-(15) wall case hold the descent-only bend canon', () => {
    const r9 = buildBoard([
      [10, '10A10C12'], [21, '21B10A8'], [20, '20C8A6'], [14, '14A5B4'], [27, '27D7C4'],
      [25, '25F6D8'], [11, '11C2A4'], [5, '05E14A14'], [13, '13E11C10'], [19, '19F5D3'],
      [17, '17A2C0'], [16, '16H6'], [26, '26D9G10'], [18, '18F14H12'], [23, '23H13J12'],
      [12, '12F1D2'],
    ])
    expect(rules.checkPlacement(firstLegal(4, '04D13A13', r9), r9, ROWS).ok).toBe(true)
  })

  it('F09@09C2E3 behind the 4-tall col-1 wall is REJECTED (walls cannot be penetrated)', () => {
    const r15 = buildBoard([
      [11, '11C10A12'], [19, '19C5A7'], [27, '27B3A0'], [17, '17A10C8'], [24, '24B7D6'],
      [10, '10C0E2'], [25, '25F12D10'], [5, '05E4A4'], [16, '16G4'],
    ])
    // The canon check is the FORWARD binding (dot1 = first point); mirrored bindings of
    // the ambiguous pair are not the placement Sergey logged (strict dot-order canon).
    const { pts } = parsePts('09C2E3')
    const forward = allSolutions(9, pts)[0]
    expect(rules.checkPlacement(forward, r15, ROWS).ok).toBe(false)
  })

  it('06B10A11 — the system-of-threes descent into the 5-deep well is LEGAL (report 16)', () => {
    const r16 = buildBoard([
      [13, '13B12A14'], [7, '07D12C13'], [15, '15A8B6'], [10, '10A4C6'], [5, '05A9E9'], [14, '14C8B7'],
    ])
    expect(rules.checkPlacement(firstLegal(6, '06B10A11', r16), r16, ROWS).ok).toBe(true)
  })

  it('44a notch bridge: F25@25H1F3 hovers over the E2 notch of a 4-cell step — REJECTED', () => {
    const r11 = buildBoard([
      [21, '21B11A9'], [12, '12A7B9'], [10, '10B6D8'], [16, '16B2'], [20, '20D10B12'],
      [27, '27F5C6'], [18, '18C3E1'],
    ])
    const { pts } = parsePts('25H1F3')
    const rejected = allSolutions(25, pts).every((s) => !rules.checkPlacement(s, r11, ROWS).ok)
    expect(rejected).toBe(true)
  })

  it('walk canon: 25G11E13 seats on unclimbable 4–5-cell pillars — REJECTED (re-ruling pending)', () => {
    const r6 = buildBoard([
      [12, '12C13A14'], [7, '07B8A9'], [15, '15A7B5'], [22, '22B6D7'], [14, '14B12A13'],
      [1, '01A10'], [18, '18E12C14'],
    ])
    const { pts } = parsePts('25G11E13')
    const rejected = allSolutions(25, pts).every((s) => !rules.checkPlacement(s, r6, ROWS).ok)
    expect(rejected).toBe(true)
  })
})
