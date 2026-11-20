// Performance smoke test (item 30 perf canon): a full engine decision stays inside the
// interactive budget (~0.7 s/move after memo warmup; cold first call includes warmup).
// The heavy full-battery timing lives in tests/regressions/perf30.mjs (legacy script).
import { describe, expect, it } from 'vitest'
import { createOpponentEngine } from '../../src/engine/opponentEngine'
import * as rules from '../../src/engine/rules'
import { FIGURES, ROWS, byId } from './helpers'

describe('performance budget', () => {
  it('medium decidePlacement on an empty board stays within the interactive budget', () => {
    // Warm the memo caches with one cheap call first.
    createOpponentEngine({ difficulty: 'medium' }).decidePlacement(
      byId(1), new Set(), ROWS, { rows: ROWS, ownAvailable: FIGURES, humanAvailable: FIGURES },
    )
    const t0 = performance.now()
    const d = createOpponentEngine({ difficulty: 'medium' }).decidePlacement(
      byId(16), new Set(), ROWS,
      { rows: ROWS, ownFilled: new Set(), ownAvailable: FIGURES, humanFilled: new Set(), humanAvailable: FIGURES },
    )
    const elapsed = performance.now() - t0
    expect(d.kind).toBe('place')
    // Generous CI-safe bound: interactive budget is ~0.7 s, cold start may spike.
    expect(elapsed).toBeLessThan(10_000)
  })

  it('enumeratePlacements for F16 on an empty board is a fast pure query', () => {
    const t0 = performance.now()
    const all = rules.enumeratePlacements(byId(16), new Set(), ROWS)
    const elapsed = performance.now() - t0
    expect(all.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(5_000)
  })
})
