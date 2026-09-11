import {
  FigureDef, Cells, cellKey, colHeights,
  parseNotation, computePlacementFromDots, checkPlacement,
} from './rules'

const FIGURES: FigureDef[] = [
  { id:  1, name: 'Mono', label: 'F01', size: 1, cells: [[0,0]], dots: [0] },
  { id: 16, name: 'Pentomino-X', label: 'F16', size: 5, cells: [[0,1],[1,0],[1,1],[1,2],[2,1]], dots: [2] },
  { id: 20, name: 'Pentomino-N', label: 'F20', size: 5, cells: [[0,1],[0,2],[1,0],[1,1],[2,0]], dots: [4, 1] },
  { id: 11, name: 'Pentomino-W', label: 'F11', size: 5, cells: [[0,0],[0,1],[1,1],[2,1],[2,2]], dots: [0, 4] },
  { id: 25, name: 'Heptomino-H', label: 'F25', size: 7, cells: [[0,0],[0,2],[1,0],[1,1],[1,2],[2,0],[2,2]], dots: [0, 6] },
  { id:  5, name: 'Pentomino-I', label: 'F05', size: 5, cells: [[0,0],[0,1],[0,2],[0,3],[0,4]], dots: [0, 4] },
  { id: 27, name: 'Hexomino-Q', label: 'F27', size: 6, cells: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,2]], dots: [4, 3] },
]

const ROWS = 11
const byId = new Map(FIGURES.map(f => [f.id, f]))

const moves: [number, string][] = [
  [16, '16B12'],
  [20, '20A11C9'],
  [11, '11C7A9'],
  [25, '25C5A3'],
  [5,  '05E1A1'],
  [27, '27F2I1'],
]

let filled = new Set<string>()

for (const [figId, notation] of moves) {
  const fig = byId.get(figId)!
  const parsed = parseNotation(notation, ROWS)
  if ('error' in parsed) { console.log('PARSE ERROR', notation, parsed.error); continue }
  let cells: Cells | null
  if (parsed.points.length === 1) {
    const dotIdx = fig.dots[0] ?? 0
    const target = parsed.points[0]
    const ori = fig.cells
    const [dr, dc] = ori[dotIdx]
    const offR = target.r - dr, offC = target.c - dc
    cells = ori.map(([r, c]) => [r + offR, c + offC])
  } else {
    cells = computePlacementFromDots(fig, parsed.points)
  }
  if (!cells) { console.log('COULD NOT COMPUTE PLACEMENT for', notation); continue }
  const result = checkPlacement(cells, filled, ROWS)
  console.log(`F${figId} ${notation} -> ok=${result.ok}${result.ok ? '' : '  reason: ' + result.reason}`)
  if (!result.ok) { console.log('  (correctly rejected — the fix worked if this is F27 27F2I1)'); continue }
  cells.forEach(([r, c]) => filled.add(cellKey(r, c)))
}
console.log('\nfinal colHeights:', colHeights(filled, ROWS).join(','))
