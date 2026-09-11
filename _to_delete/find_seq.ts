import {
  FigureDef, Cells, cellKey, formatNotation,
  enumeratePlacements, checkPlacement, computeDeadCells,
} from '../src/engine/rules'

const FIGURES: FigureDef[] = [
  { id:  8, name: 'Tetromino-L', label: 'F08', size: 4, cells: [[0,0],[1,0],[2,0],[2,1]], dots: [0, 3] },
  { id: 17, name: 'Pentomino-V', label: 'F17', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[2,0]], dots: [4, 2] },
  { id:  9, name: 'Tetromino-J', label: 'F09', size: 4, cells: [[0,1],[1,1],[2,0],[2,1]], dots: [2, 0] },
  { id: 11, name: 'Pentomino-W', label: 'F11', size: 5, cells: [[0,0],[0,1],[1,1],[2,1],[2,2]], dots: [0, 4] },
  { id: 27, name: 'Hexomino-Q', label: 'F27', size: 6, cells: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,2]], dots: [4, 3] },
  { id: 13, name: 'Tetromino-Z', label: 'F13', size: 4, cells: [[0,0],[0,1],[1,1],[1,2]], dots: [0, 3] },
  { id: 23, name: 'Hexomino-H', label: 'F23', size: 6, cells: [[0,1],[1,0],[1,1],[1,2],[2,0],[2,2]], dots: [0, 5] },
]

const ROWS = 11
const ROW_LABELS = 'ABCDEFGHIJK'
let filled = new Set<string>()
let totalDead = 0

function notationFor(fig: FigureDef, cells: Cells): string {
  // Map figure's dot indices to the placed cells by matching relative offsets.
  const origMinR = Math.min(...fig.cells.map(([r]) => r))
  const origMinC = Math.min(...fig.cells.map(([, c]) => c))
  const placedMinR = Math.min(...cells.map(([r]) => r))
  const placedMinC = Math.min(...cells.map(([, c]) => c))
  // This only works if orientation is unrotated (rotIdx 0); for a rotated match we
  // instead just find, for each dot's original cell, which placed cell it maps to
  // by index position in the SAME orientation array used by enumeratePlacements.
  return cells.map(([r, c]) => `${ROW_LABELS[ROWS - 1 - r]}${c}`).join(',')
}

for (const fig of FIGURES) {
  const candidates = enumeratePlacements(fig, filled, ROWS)
  const before = computeDeadCells(filled, ROWS)
  let best: Cells | null = null
  let bestScore = Infinity
  for (const cells of candidates) {
    const next = new Set(filled)
    cells.forEach(([r, c]) => next.add(cellKey(r, c)))
    const afterDead = computeDeadCells(next, ROWS)
    const newDead = afterDead.size - before.size
    if (newDead < 0) continue
    const maxR = Math.max(...cells.map(([r]) => r)) // larger r = closer to floor
    const minC = Math.min(...cells.map(([, c]) => c))
    const score = newDead * 10000 - maxR * 10 + minC * 0.01
    if (score < bestScore) { bestScore = score; best = cells }
  }
  if (!best) { console.log('NO LEGAL PLACEMENT FOUND for', fig.label); continue }
  const next = new Set(filled)
  best.forEach(([r, c]) => next.add(cellKey(r, c)))
  const afterDead = computeDeadCells(next, ROWS)
  const newDead = afterDead.size - before.size
  totalDead += newDead
  console.log(fig.label, fig.name, 'cells=', JSON.stringify(best), 'notation~=', notationFor(fig, best), 'newDeadCells=', newDead)
  filled = next
}
console.log('TOTAL NEW DEAD CELLS ACROSS ALL 7:', totalDead)

// Also print final board for a visual sanity check.
function printState() {
  const dead = computeDeadCells(filled, ROWS)
  for (let r = 0; r < ROWS; r++) {
    const letter = ROW_LABELS[ROWS - 1 - r]
    let line = `${letter}: `
    for (let c = 0; c < 15; c++) {
      const k = cellKey(r, c)
      line += filled.has(k) ? '#' : (dead.has(k) ? 'x' : '.')
    }
    console.log(line)
  }
}
printState()
