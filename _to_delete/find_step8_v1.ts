import {
  FigureDef, Cells, cellKey, checkPlacement, enumeratePlacements, computeDeadCells,
} from './src/engine/rules'

const ROWS = 11
const ROW_LABELS = 'ABCDEFGHIJK'
const F04: FigureDef = { id: 4, name: 'Tetromino-I', label: 'F04', size: 4, cells: [[0,0],[0,1],[0,2],[0,3]], dots: [0, 3] }
const F05: FigureDef = { id: 5, name: 'Pentomino-I', label: 'F05', size: 5, cells: [[0,0],[0,1],[0,2],[0,3],[0,4]], dots: [0, 4] }
const MONO: FigureDef = { id: 1, name: 'Mono', label: 'F01', size: 1, cells: [[0,0]], dots: [0] }

function printState(f: Set<string>) {
  for (let r = 0; r < ROWS; r++) {
    const letter = ROW_LABELS[ROWS - 1 - r]
    let line = `${letter}: `
    for (let c = 0; c < 15; c++) line += f.has(cellKey(r, c)) ? '#' : '.'
    console.log(line)
  }
}

// F04 stood vertically (height 4) in the MIDDLE of the container, column 7.
// Entrance (col 0) and everything else stays empty -- a step 4x1 on BOTH sides of the wall.
const WALL_COL = 7
const filled = new Set<string>()
for (let r = ROWS - 4; r <= ROWS - 1; r++) filled.add(cellKey(r, WALL_COL))
console.log('Initial (F04 wall at col 7, height 4, open floor both sides):')
printState(filled)

console.log('\n--- LEFT SIDE (climb) ---')
console.log('Is col 6 (left neighbor) directly reachable/placeable for a Mono right now?')
const monoLeftOptions = enumeratePlacements(MONO, filled, ROWS)
console.log('Mono legal placements count:', monoLeftOptions.length)
console.log('Mono at col 6 floor legal?', checkPlacement([[ROWS - 1, 6]], filled, ROWS))

// After Mono at col6 floor (height1 there), can anything now cross into col 7's TOP (row ROWS-4..) or beyond wall (col 8+) from col 6 side?
const afterMonoLeft = new Set(filled); afterMonoLeft.add(cellKey(ROWS - 1, 6))
console.log('\nAfter Mono placed at col6 floor:')
printState(afterMonoLeft)
console.log('F15-like check not needed -- what figure passes the wall now? Try Mono at col 8 (right side, still empty, should already be reachable via entrance since col8 floor is open and unrelated to wall)')
console.log('checkPlacement Mono @ col8 floor (should be trivially ok, no wall between entrance and col8 at floor level):', checkPlacement([[ROWS - 1, 8]], filled, ROWS).ok)

console.log('\n--- RIGHT SIDE (descend / fragile cargo hang) ---')
// F05 horizontally, one end resting on top of the wall (row ROWS-4, col7), extending
// rightward over columns 8..11 (4 more cells) at the SAME height as the wall's top.
// That's 1 supported cell (on the wall) + 4 unsupported (over open air) = 80% overhang.
const topRow = ROWS - 4
const f05_attempt1: Cells = [[topRow, 7], [topRow, 8], [topRow, 9], [topRow, 10], [topRow, 11]]
console.log('F05 resting 1-on-wall + 4-over-air (80% overhang):', JSON.stringify(checkPlacement(f05_attempt1, filled, ROWS)))
console.log('F05 same, with fair-play approved:', JSON.stringify(checkPlacement(f05_attempt1, filled, ROWS, true)))

// What if F05 rests 2 cells on/near the wall (needs 2 columns of support) -- but wall is
// only 1 column wide, so no natural 2-cell resting spot unless helper figures are added
// first. Try mono first at col6 (left) -- doesn't help right side.
// Try mono at col 8 floor (right neighbor of wall), raising THAT column to height1, then
// F05 resting on wall-top (col7) + col8-top(height1, so col8's cell at topRow is NOT
// resting directly on floor -- need it to touch height1 top, i.e. F05 cell over col8 must
// be at row = ROWS-2 to sit exactly on top of the mono). That breaks the "same absolute
// row" requirement of a straight horizontal figure resting on UNEVEN ground -- let's check
// what checkPlacement actually says for F05 spanning col7(topRow, on wall) .. col11, with
// a mono pre-placed at col8 floor (height1). The figure is still a straight line at ONE
// row (topRow), so support only comes from directly-below cells AT topRow-1. A mono at
// col8 floor (row ROWS-1) does NOT touch row topRow-1 = ROWS-5, so no help unless we stack
// mono 3 more times at col8 to reach height topRow-1. Let's actually check what's needed
// for a clean/legal placement, or a >=50% (needing fair-play) but sensible one at 3/5 = 60%.
console.log('\nTrying to find placements of F05 that are legal (ok:true, need fair-play or not) touching the wall:')
const f05Options = enumeratePlacements(F05, filled, ROWS)
console.log('Total legal F05 placements (fresh board, wall only):', f05Options.length)
for (const opt of f05Options) {
  const touchesWallTop = opt.some(([r, c]) => c === WALL_COL && r === topRow)
  if (touchesWallTop) {
    const result = checkPlacement(opt, filled, ROWS)
    console.log(JSON.stringify(opt), '->', result.ok, result.reason, result.needsFairPlay)
  }
}
