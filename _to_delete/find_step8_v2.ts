import {
  FigureDef, Cells, cellKey, checkPlacement, enumeratePlacements, computeDeadCells,
} from './src/engine/rules'

const ROWS = 11
const ROW_LABELS = 'ABCDEFGHIJK'
const MONO: FigureDef = { id: 1, name: 'Mono', label: 'F01', size: 1, cells: [[0,0]], dots: [0] }
const F05: FigureDef = { id: 5, name: 'Pentomino-I', label: 'F05', size: 5, cells: [[0,0],[0,1],[0,2],[0,3],[0,4]], dots: [0, 4] }

function printState(f: Set<string>) {
  for (let r = 0; r < ROWS; r++) {
    const letter = ROW_LABELS[ROWS - 1 - r]
    let line = `${letter}: `
    for (let c = 0; c < 15; c++) line += f.has(cellKey(r, c)) ? '#' : '.'
    console.log(line)
  }
}

const WALL_COL = 7
const WALL_TOP_ROW = ROWS - 4      // filled row (top of wall)
const ABOVE_WALL_ROW = ROWS - 5    // empty row directly above the wall

const filled0 = new Set<string>()
for (let r = ROWS - 4; r <= ROWS - 1; r++) filled0.add(cellKey(r, WALL_COL))
console.log('=== Initial: F04 wall at col 7, height 4, open floor both sides ==='); printState(filled0)

console.log('\nMono at col6 floor legal (phase A, left)?', JSON.stringify(checkPlacement([[ROWS - 1, 6]], filled0, ROWS)))

const afterLeft = new Set(filled0); afterLeft.add(cellKey(ROWS - 1, 6))
console.log('\n=== After Mono @ col6 floor ==='); printState(afterLeft)

console.log('\nMono @ (aboveWallRow, col7) legal now (safe right-side choice)?', JSON.stringify(checkPlacement([[ABOVE_WALL_ROW, WALL_COL]], afterLeft, ROWS)))

const f05Attempt: Cells = [[ABOVE_WALL_ROW, 7], [ABOVE_WALL_ROW, 8], [ABOVE_WALL_ROW, 9], [ABOVE_WALL_ROW, 10], [ABOVE_WALL_ROW, 11]]
console.log('\nF05 @ row', ABOVE_WALL_ROW, 'cols 7-11 (ambitious right-side choice), no fair-play:', JSON.stringify(checkPlacement(f05Attempt, afterLeft, ROWS)))
console.log('F05 same, WITH fair-play approved:', JSON.stringify(checkPlacement(f05Attempt, afterLeft, ROWS, true)))

// Dead-cell sanity: does placing F05 there wall off anything?
const beforeDead = computeDeadCells(afterLeft, ROWS).size
const afterF05 = new Set(afterLeft); f05Attempt.forEach(([r,c]) => afterF05.add(cellKey(r,c)))
const afterDead = computeDeadCells(afterF05, ROWS).size
console.log('New dead cells from F05 placement:', afterDead - beforeDead)

// Mono-only path dead-cell check too
const afterMonoRight = new Set(afterLeft); afterMonoRight.add(cellKey(ABOVE_WALL_ROW, WALL_COL))
const deadAfterMonoRight = computeDeadCells(afterMonoRight, ROWS).size
console.log('New dead cells from Mono-on-wall-top placement:', deadAfterMonoRight - beforeDead)

console.log('\n=== Sanity: is col8 floor still unreachable even after phase A (left only)? ===');
console.log('Mono @ col8 floor:', JSON.stringify(checkPlacement([[ROWS - 1, 8]], afterLeft, ROWS)))

console.log('\n=== Board after F05 placed ==='); printState(afterF05)
