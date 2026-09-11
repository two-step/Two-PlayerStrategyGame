import {
  FigureDef, Cells, cellKey, colHeights,
  parseNotation, computePlacementFromDots, checkPlacement, computeDeadCells, closedRows, closedCols,
} from './rules'

const FIGURES: FigureDef[] = [
  { id:  1, name: 'Mono', label: 'F01', size: 1, cells: [[0,0]], dots: [0] },
  { id:  2, name: 'Domino', label: 'F02', size: 2, cells: [[0,0],[0,1]], dots: [0, 1] },
  { id:  3, name: 'Tromino-I', label: 'F03', size: 3, cells: [[0,0],[0,1],[0,2]], dots: [0, 2] },
  { id:  4, name: 'Tetromino-I', label: 'F04', size: 4, cells: [[0,0],[0,1],[0,2],[0,3]], dots: [0, 3] },
  { id:  5, name: 'Pentomino-I', label: 'F05', size: 5, cells: [[0,0],[0,1],[0,2],[0,3],[0,4]], dots: [0, 4] },
  { id:  6, name: 'Tromino-L', label: 'F06', size: 3, cells: [[0,0],[1,0],[1,1]], dots: [0, 2] },
  { id:  7, name: 'Tetromino-O', label: 'F07', size: 4, cells: [[0,0],[0,1],[1,0],[1,1]], dots: [0, 3] },
  { id:  8, name: 'Tetromino-L', label: 'F08', size: 4, cells: [[0,0],[1,0],[2,0],[2,1]], dots: [0, 3] },
  { id:  9, name: 'Tetromino-J', label: 'F09', size: 4, cells: [[0,1],[1,1],[2,0],[2,1]], dots: [2, 0] },
  { id: 10, name: 'Pentomino-F', label: 'F10', size: 5, cells: [[0,1],[0,2],[1,1],[2,0],[2,1]], dots: [3, 1] },
  { id: 11, name: 'Pentomino-W', label: 'F11', size: 5, cells: [[0,0],[0,1],[1,1],[2,1],[2,2]], dots: [0, 4] },
  { id: 12, name: 'Tetromino-S', label: 'F12', size: 4, cells: [[0,1],[0,2],[1,0],[1,1]], dots: [2, 1] },
  { id: 13, name: 'Tetromino-Z', label: 'F13', size: 4, cells: [[0,0],[0,1],[1,1],[1,2]], dots: [0, 3] },
  { id: 14, name: 'Tetromino-T', label: 'F14', size: 4, cells: [[0,1],[1,0],[1,1],[1,2]], dots: [0, 3] },
  { id: 15, name: 'Pentomino-U', label: 'F15', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[1,2]], dots: [0, 4] },
  { id: 16, name: 'Pentomino-X', label: 'F16', size: 5, cells: [[0,1],[1,0],[1,1],[1,2],[2,1]], dots: [2] },
  { id: 17, name: 'Pentomino-V', label: 'F17', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[2,0]], dots: [4, 2] },
  { id: 27, name: 'Hexomino-Q', label: 'F27', size: 6, cells: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,2]], dots: [4, 3] },
]

const ROWS = 10
const byId = new Map(FIGURES.map(f => [f.id, f]))

const moves: [number, string][] = [
  [7,  '07B13A14'],
  [3,  '03E14C14'],
  [15, '15A12B10'],
  [27, '27B9C12'],
  [16, '16B4'],
  [12, '12E12C13'],
  [14, '14E13F12'],
  [17, '17F11D9'],
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
  if (!result.ok) { continue }
  cells.forEach(([r, c]) => filled.add(cellKey(r, c)))
}
console.log('\nfinal colHeights:', colHeights(filled, ROWS).join(','))
console.log('dead cells:', computeDeadCells(filled, ROWS).size, 'closedRows:', [...closedRows(filled, ROWS)], 'closedCols:', [...closedCols(filled, ROWS)])
