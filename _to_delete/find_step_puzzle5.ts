import {
  FigureDef, Cells, cellKey, checkPlacement, enumeratePlacements, computeDeadCells,
} from '../src/engine/rules'

const ROWS = 11
const ROW_LABELS = 'ABCDEFGHIJK'
const F15: FigureDef = { id: 15, name: 'Pentomino-U', label: 'F15', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[1,2]], dots: [0, 4] }
const F01: FigureDef = { id: 1, name: 'Mono', label: 'F01', size: 1, cells: [[0,0]], dots: [0] }

function printState(f: Set<string>) {
  for (let r = 0; r < ROWS; r++) {
    const letter = ROW_LABELS[ROWS - 1 - r]
    let line = `${letter}: `
    for (let c = 0; c < 15; c++) line += f.has(cellKey(r, c)) ? '#' : '.'
    console.log(line)
  }
}

// Realistic mid-game snapshot: wall (F4 vertical) at column 1, height 4; the floor
// beyond it (columns 2..14) already has a thin layer of stowed cargo, height 1.
const filled = new Set<string>()
for (let r = ROWS - 4; r <= ROWS - 1; r++) filled.add(cellKey(r, 1))
for (let c = 2; c <= 14; c++) filled.add(cellKey(ROWS - 1, c))
console.log('Initial state:'); printState(filled)

const before0 = computeDeadCells(filled, ROWS)
console.log('F15 placeable right away? options=', enumeratePlacements(F15, filled, ROWS).length)

// Raise column 0 (the entrance) by 1 with a Mono.
const mono: Cells = [[ROWS - 1, 0]]
const rMono = checkPlacement(mono, filled, ROWS)
console.log('Placing helper Mono at column 0 -- ok=', rMono.ok, rMono.reason ?? '')
if (rMono.ok) mono.forEach(([r, c]) => filled.add(cellKey(r, c)))

const opts = enumeratePlacements(F15, filled, ROWS)
console.log('F15 options after raising column 0:', opts.length)
const before = computeDeadCells(filled, ROWS)
let clean: Cells | null = null
for (const cells of opts) {
  const next = new Set(filled)
  cells.forEach(([r, c]) => next.add(cellKey(r, c)))
  const newDead = computeDeadCells(next, ROWS).size - before.size
  if (newDead === 0 && !clean) clean = cells
  console.log(JSON.stringify(cells), 'newDead=', newDead)
}
if (clean) {
  console.log('\nA CLEAN (0 new dead cells) F15 placement exists:', JSON.stringify(clean))
  const finalB = new Set(filled)
  clean.forEach(([r, c]) => finalB.add(cellKey(r, c)))
  printState(finalB)
}
