import {
  FigureDef, Cells, cellKey, checkPlacement, enumeratePlacements, computeDeadCells,
} from '../src/engine/rules'

const ROWS = 11
const ROW_LABELS = 'ABCDEFGHIJK'
const F15: FigureDef = { id: 15, name: 'Pentomino-U', label: 'F15', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[1,2]], dots: [0, 4] }
const HELPERS: FigureDef[] = [
  { id: 1, name: 'Mono', label: 'F01', size: 1, cells: [[0,0]], dots: [0] },
  { id: 2, name: 'Domino', label: 'F02', size: 2, cells: [[0,0],[0,1]], dots: [0, 1] },
  { id: 3, name: 'Tromino-I', label: 'F03', size: 3, cells: [[0,0],[0,1],[0,2]], dots: [0, 2] },
]

function printState(f: Set<string>) {
  for (let r = 0; r < ROWS; r++) {
    const letter = ROW_LABELS[ROWS - 1 - r]
    let line = `${letter}: `
    for (let c = 0; c < 15; c++) line += f.has(cellKey(r, c)) ? '#' : '.'
    console.log(line)
  }
}

// Wall (F4 vertical) in column 1, height 4. Column 0 (entrance) open.
const filled = new Set<string>()
for (let r = ROWS - 4; r <= ROWS - 1; r++) filled.add(cellKey(r, 1))
console.log('Initial (wall only):'); printState(filled)
console.log('F15 placeable already?', enumeratePlacements(F15, filled, ROWS).length, 'options')

const moves: string[] = []
let guard = 0
while (enumeratePlacements(F15, filled, ROWS).length === 0 && guard < 12) {
  guard++
  // Try every helper figure at every legal, zero-new-dead-cell spot; prefer the one
  // that ends up LOWEST in height difference terms -- i.e. prefer building up short
  // columns near the wall (column 0 or column 2) over random spots. Score = column
  // distance from column 1 (the wall), ascending, then row (lower/closer to floor
  // preferred).
  let bestCells: Cells | null = null
  let bestFig: FigureDef | null = null
  let bestScore = Infinity
  const before = computeDeadCells(filled, ROWS)
  for (const fig of HELPERS) {
    for (const cells of enumeratePlacements(fig, filled, ROWS)) {
      const next = new Set(filled)
      cells.forEach(([r, c]) => next.add(cellKey(r, c)))
      const afterDead = computeDeadCells(next, ROWS)
      const newDead = afterDead.size - before.size
      if (newDead > 0) continue
      const minColDist = Math.min(...cells.map(([, c]) => Math.abs(c - 1)))
      const maxR = Math.max(...cells.map(([r]) => r))
      const score = minColDist * 100 - maxR
      if (score < bestScore) { bestScore = score; bestCells = cells; bestFig = fig }
    }
  }
  if (!bestCells || !bestFig) { console.log('STUCK -- no helper move improves anything'); break }
  bestCells.forEach(([r, c]) => filled.add(cellKey(r, c)))
  moves.push(`${bestFig.label} @ ${JSON.stringify(bestCells)}`)
  console.log(`Move ${guard}: placed ${bestFig.label} at`, JSON.stringify(bestCells), '-> F15 options now:', enumeratePlacements(F15, filled, ROWS).length)
}

console.log('\nMoves used to open the path:', moves)
console.log('\nFinal board before F15:'); printState(filled)
const f15options = enumeratePlacements(F15, filled, ROWS)
if (f15options.length) {
  console.log('\nExample F15 placement:', JSON.stringify(f15options[0]))
  const withF15 = new Set(filled)
  f15options[0].forEach(([r, c]) => withF15.add(cellKey(r, c)))
  console.log('New dead cells from this F15 placement:', computeDeadCells(withF15, ROWS).size - computeDeadCells(filled, ROWS).size)
  printState(withF15)
}
