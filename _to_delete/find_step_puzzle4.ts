import {
  FigureDef, Cells, cellKey, checkPlacement, enumeratePlacements, computeDeadCells,
} from '../src/engine/rules'

const ROWS = 11
const ROW_LABELS = 'ABCDEFGHIJK'
const F15: FigureDef = { id: 15, name: 'Pentomino-U', label: 'F15', size: 5, cells: [[0,0],[0,1],[0,2],[1,0],[1,2]], dots: [0, 4] }

function printState(f: Set<string>) {
  for (let r = 0; r < ROWS; r++) {
    const letter = ROW_LABELS[ROWS - 1 - r]
    let line = `${letter}: `
    for (let c = 0; c < 15; c++) line += f.has(cellKey(r, c)) ? '#' : '.'
    console.log(line)
  }
}

const filled = new Set<string>()
for (let r = ROWS - 4; r <= ROWS - 1; r++) filled.add(cellKey(r, 1))
const before = computeDeadCells(filled, ROWS)
const opts = enumeratePlacements(F15, filled, ROWS)
console.log('Total F15 options in wall-only state:', opts.length)
for (const cells of opts) {
  const next = new Set(filled)
  cells.forEach(([r, c]) => next.add(cellKey(r, c)))
  const newDead = computeDeadCells(next, ROWS).size - before.size
  console.log(JSON.stringify(cells), 'newDead=', newDead)
}
