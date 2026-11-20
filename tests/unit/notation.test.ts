// Notation canon tests (TO_DO items 31/44/45). Encodes Sergey's dot-order canon:
//   dot1 = the LEFT dot of the original figure (2026-11-18/19); the notation
//   "[id][point1][point2]" binds point1 → dot1, point2 → dot2; computePlacementFromDots
//   is STRICTLY forward-only (no mirrored substitution); the physical rotations are
//   reachable through the rotation-orbit expansion (12b).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Cells } from '../../src/engine/rules'
import * as rules from '../../src/engine/rules'
import { FIGURES, ROWS, allSolutions, byId, keyOf, parsePts } from './helpers'

describe('notation round-trip: place → format → parse → same cells', () => {
  it('every figure in every orientation round-trips through canonical notation', () => {
    let checked = 0
    for (const fig of FIGURES) {
      rules.getOrientations(fig.cells).forEach((ori, k) => {
        const anchor = [3, 4]
        const cells = ori.map(([r, c]) => [r + anchor[0], c + anchor[1]] as [number, number])
        if (!rules.inBounds(cells, ROWS)) return
        checked++
        const notation = rules.formatNotation(
          fig.id,
          fig.dots.map((i) => ({ r: cells[i][0], c: cells[i][1] })),
          ROWS,
        )
        const parsed = rules.parseNotation(notation, ROWS)
        if ('error' in parsed) throw new Error(`F${fig.id} ori${k}: parse error for ${notation}`)
        const back = fig.dots.length >= 2 && parsed.points.length >= 2
          ? rules.computePlacementFromDots(fig, parsed.points)
          : rules.computePlacementFromAnchor(fig, 0, parsed.points[0])
        expect(back, `F${fig.id} ori${k} resolve (${notation})`).not.toBeNull()
        expect(keyOf(back!), `F${fig.id} ori${k} cells (${notation})`).toBe(keyOf(cells))
      })
    }
    // 27 figures × orientations, minus any too tall at the fixed anchor — sanity floor.
    expect(checked).toBeGreaterThanOrEqual(77)
  })
})

describe('dot-order canon (strict, forward-only)', () => {
  it('a swapped-point ask never yields a MIRROR image — only pure rotations or null', () => {
    for (const fig of FIGURES) {
      if (fig.dots.length < 2) continue
      rules.getOrientations(fig.cells).forEach((ori, k) => {
        const anchor = [3, 4]
        const cells = ori.map(([r, c]) => [r + anchor[0], c + anchor[1]] as [number, number])
        if (!rules.inBounds(cells, ROWS)) return
        const p1 = { r: cells[fig.dots[0]][0], c: cells[fig.dots[0]][1] }
        const p2 = { r: cells[fig.dots[1]][0], c: cells[fig.dots[1]][1] }
        const swapped = rules.computePlacementFromDots(fig, [p2, p1])
        if (!swapped) return // chiral dot binding: the mirrored ask is invalid — correct
        // If it resolves, the NORMALIZED shape must equal some pure rotation's shape
        // (reflections are never among getOrientations, so a mirror image fails this).
        const norm = (cs: Cells) => {
          const minR = Math.min(...cs.map((x) => x[0])), minC = Math.min(...cs.map((x) => x[1]))
          return keyOf(cs.map(([r, c]) => [r - minR, c - minC] as [number, number]))
        }
        const shapes = rules.getOrientations(fig.cells).map((rot) => norm(rot))
        expect(shapes, `F${fig.id} ori${k}: swapped resolve must be a pure rotation`).toContain(norm(swapped))
      })
    }
  })

  it('the ambiguous chiral figures have 180°-symmetric dot pairs (notation canon)', () => {
    // The audit set from the golden notation script: ambiguous AND shape not
    // self-symmetric under 180° — exactly where dot order disambiguates the reading.
    // F10/F12 have self-symmetric shapes (harmless ambiguity) and are excluded.
    for (const id of [6, 8, 9, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27]) {
      const fig = byId(id)
      const oris = rules.getOrientations(fig.cells)
      const offsets = oris.map((ori) => {
        const a = ori[fig.dots[0]], b = ori[fig.dots[1]]
        return [b[0] - a[0], b[1] - a[1]] as [number, number]
      })
      const ambiguous = offsets.some((o, k) =>
        offsets.some((o2, j) => j !== k && o[0] === -o2[0] && o[1] === -o2[1]))
      expect(ambiguous, `F${id} has a 180°-symmetric dot pair`).toBe(true)
    }
  })

  it('historical placement 13A8C9 (dot1-at-bottom arrangement) resolves (12b fix)', () => {
    const { figId, pts } = parsePts('13A8C9')
    expect(allSolutions(figId, pts).length).toBeGreaterThanOrEqual(1)
    const forward = rules.computePlacementFromDots(byId(13), pts)
    expect(forward).not.toBeNull()
    // Cells per the 12b verification: A8, B8, B9, C9.
    expect(keyOf(forward!)).toBe(keyOf([[10, 8], [9, 8], [9, 9], [8, 9]]))
  })
})

describe('App.tsx FIGURES dot order matches the left-first canon', () => {
  it('every two-dot figure in App FIGURES lists dot1 as the LEFT dot', () => {
    const appSrc = readFileSync('src/App.tsx', 'utf8')
    const start = appSrc.indexOf('const FIGURES: Figure[] = [')
    expect(start).toBeGreaterThan(0)
    const block = appSrc.slice(start, appSrc.indexOf('\n]', start))
    for (const f of FIGURES) {
      const m = block.match(new RegExp(`\\{\\s+id:\\s*${f.id},[\\s\\S]*?dots:\\s*\\[([^\\]]*)\\]`))
      expect(m, `F${f.id} present in App FIGURES`).not.toBeNull()
      const appDots = m![1].split(',').map((s) => parseInt(s.trim(), 10))
      const canon = f.dots.length === 2
        ? [...f.dots].sort((a, b) => f.cells[a][1] - f.cells[b][1])
        : f.dots
      expect(appDots, `F${f.id} App dots`).toEqual(canon)
    }
  })
})
