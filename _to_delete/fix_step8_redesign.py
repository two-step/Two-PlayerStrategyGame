# -*- coding: utf-8 -*-
path = "src/App.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

def apply(old, new, label, count=1):
    global content
    n = content.count(old)
    assert n == count, f"{label}: expected {count} occurrence(s), found {n}"
    content = content.replace(old, new, count)
    print(f"OK: {label} ({n} replaced)")

# 1. Rebuild the Step 8 (tutStep 7) starting board: F04 standing vertically in the
# MIDDLE of the container (col 7), floor to height 4, open floor on BOTH sides -- per
# Sergey's 2026-09-10 redesign ("ступень 4х1 в обе стороны"). Verified against the real
# engine (find_step8_v2.ts): with the wall alone, the right side (cols 8-14) is fully
# unreachable; after ANY figure raises col 6 to height >=1, the empty run directly above
# the wall (row ROWS-5, i.e. one cell above the wall's top) becomes reachable, and from
# there either a Mono (0% overhang, safe) or an F05 resting 1-of-5 cells on the wall-top
# with the other 4 hanging over open air (80% overhang, needs fair-play -- exactly the
# existing "click Place again to confirm" flow, no new mechanism) can be placed. Neither
# solution creates any new dead cells.
apply(
    """// Step 7 (CLIMBING A TALL STEP) starting position: F4 stood vertically at column 1
// (height 4 -- not directly passable) with a thin, already-stowed floor layer beyond it
// (columns 2..14, height 1) standing in for "cargo already delivered earlier in a real
// game." Verified against the real engine (_to_delete/find_step_puzzle5.ts): with the
// wall alone, F15 has exactly one legal placement and it costs dead cells (a turning-
// pocket wedge right above the wall); after the player raises the entrance (column 0) by
// one cell with the Mono helper, F15 gets 48 legal options, many of them clean (0 new
// dead cells) -- a real demonstration of "shrink the near side of the step," not a
// contrived one.
function stepClimbInitialFilled(rows: number): Set<string> {
  const s = new Set<string>()
  for (let r = rows - 4; r <= rows - 1; r++) s.add(cellKey(r, 1))
  for (let c = 2; c <= 14; c++) s.add(cellKey(rows - 1, c))
  return s
}""",
    """// Step 8 (CLIMBING, AND CAREFULLY DESCENDING, A TALL STEP) starting position, redesigned
// 2026-09-10 per Sergey's playtest feedback: F4 stood vertically in the MIDDLE of the
// container (column 7), floor to height 4 -- a step 4x1 on BOTH sides of the wall, not
// just near the entrance. Verified against the real engine (find_step8_v2.ts): the right
// side (columns 8-14) starts fully unreachable; raising column 6 to height >=1 (any
// figure that touches its floor cell) bridges reachability into the open run directly
// above the wall, from which a Mono placed on top of the wall (0% overhang) or an F05
// resting 1 cell on the wall-top with 4 hanging over open air (80% overhang, needs the
// same fair-play "Place again to confirm" flow used elsewhere) both work, 0 new dead
// cells either way.
const STEP_CLIMB_WALL_COL = 7
function stepClimbInitialFilled(rows: number): Set<string> {
  const s = new Set<string>()
  for (let r = rows - 4; r <= rows - 1; r++) s.add(cellKey(r, STEP_CLIMB_WALL_COL))
  return s
}""",
    "rebuild stepClimbInitialFilled + wall column constant",
)

# 2. Replace the old id-based completion flags with live engine checks -- whether the
# player has ACTUALLY bridged the gap (any figure, any orientation, as long as it raises
# column 6) and whether they've ACTUALLY landed something on top of the wall (Mono or
# F05, whichever they chose), rather than hardcoding which figure id was expected.
apply(
    """  const stepClimbHelperPlaced = pieces.some(p => p.id === 1)
  const stepClimbTargetPlaced = pieces.some(p => p.id === 15)""",
    """  const stepClimbAboveWallRow = ROWS - 5
  const stepClimbBridged = (() => {
    if (tutStep !== 7) return false
    if (filled.has(cellKey(stepClimbAboveWallRow, STEP_CLIMB_WALL_COL))) return true
    return checkPlacement([[stepClimbAboveWallRow, STEP_CLIMB_WALL_COL]], filled, ROWS).ok
  })()
  const stepClimbDone = pieces.some(p => p.cells.some(([r, c]) => r === stepClimbAboveWallRow && c === STEP_CLIMB_WALL_COL))""",
    "replace stepClimbHelperPlaced/stepClimbTargetPlaced with live checks",
)

# 3. Replace the whole Step 8 (tutStep 7) JSX block with the two-phase flow.
old_block = """      {mode === 'tutorial' && tutStep === 7 && (
        <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_340px] gap-6">
          <div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} onCellClick={handleCellClick}
                onCellHover={(r, c) => setHoverCell({ r, c })} onCellLeave={() => setHoverCell(null)}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && stepClimbTargetPlaced && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>That placement walled off {deadCellAdvisory} cell{deadCellAdvisory > 1 ? 's' : ''}. Reset and try another spot for a clean one.</p>
                : <p style={{ color: C.green, fontSize: 13, marginTop: 10 }}>Clean — you got F15 past the wall with 0 dead cells.</p>
            )}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>STEP 8 OF 10 — CLIMBING A TALL STEP</p>
            <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              F4 is standing on end just past the entrance — a step 4 cells tall, too tall to cross directly.
              But the entrance side is still open: raise it by just one cell and the gap to the wall's top shrinks
              to 3 — passable. Do that first, then bring F15 in past the wall.
            </p>
            {!stepClimbHelperPlaced ? (
              <button onClick={() => selectFigure(FIGURES.find(f => f.id === 1)!)}
                style={{ background: selectedFigId === 1 ? C.cyan : 'transparent', color: selectedFigId === 1 ? C.graphite : C.cyan, border: `1px solid ${C.cyan}`, fontWeight: 700, fontSize: 13, padding: '10px 16px', width: '100%', marginBottom: 10, cursor: 'pointer' }}>
                1. Pick Mono (F01) — raise the entrance
              </button>
            ) : (
              <button onClick={() => selectFigure(FIGURES.find(f => f.id === 15)!)} disabled={stepClimbTargetPlaced}
                style={{ background: selectedFigId === 15 ? C.cyan : stepClimbTargetPlaced ? C.graphite : 'transparent', color: selectedFigId === 15 ? C.graphite : C.cyan, border: `1px solid ${C.cyan}`, fontWeight: 700, fontSize: 13, padding: '10px 16px', width: '100%', marginBottom: 10, cursor: stepClimbTargetPlaced ? 'default' : 'pointer', opacity: stepClimbTargetPlaced ? 0.5 : 1 }}>
                2. Pick F15 — bring it past the wall
              </button>
            )}
            {selectedFig && (
              <>
                {notation && <code style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, display: 'block', marginBottom: 10 }}>{notation}</code>}
                <button onClick={() => place()} disabled={clickPoints.length < pointsNeeded}
                  style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '10px 14px', border: 'none', width: '100%', cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default', marginBottom: 10 }}>Place</button>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={() => initStep(7)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 12px', flex: 1, cursor: 'pointer' }} className="hover:text-deck transition-colors">Reset</button>
              {stepClimbTargetPlaced && (
                <button onClick={() => setTutStep(8)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 12, padding: '8px 14px', border: 'none', flex: 1, cursor: 'pointer' }}>Next →</button>
              )}
            </div>
          </div>
        </div>
      )}"""

new_block = """      {mode === 'tutorial' && tutStep === 7 && (
        <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_340px] gap-6">
          <div>
            <div className="overflow-x-auto">
              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} onCellClick={handleCellClick}
                onCellHover={(r, c) => setHoverCell({ r, c })} onCellLeave={() => setHoverCell(null)}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && stepClimbBridged && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>That placement walled off {deadCellAdvisory} cell{deadCellAdvisory > 1 ? 's' : ''}. Reset and try another spot for a clean one.</p>
                : <p style={{ color: C.green, fontSize: 13, marginTop: 10 }}>Clean — 0 new dead cells.</p>
            )}
          </div>
          <div style={{ border: `1px solid ${C.cyan}40`, background: C.graphite2 }} className="p-5 h-fit">
            <p style={{ color: C.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, marginBottom: 10 }}>STEP 8 OF 10 — CLIMBING (AND CAREFULLY DESCENDING) A TALL STEP</p>
            {!stepClimbBridged ? (
              <>
                <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  F4 is standing on end in the middle of the container — a wall 4 cells tall, too tall to cross
                  from either side. You can fix the situation by placing a figure to the left of the tall step.
                  You have a repair toolkit — choose the right figure and place it so you can pass further.
                </p>
                <div className="flex gap-2 mb-3">
                  {[1, 2, 3].map(id => {
                    const f = FIGURES.find(ff => ff.id === id)!
                    return (
                      <button key={id} onClick={() => selectFigure(f)}
                        style={{ background: selectedFigId === id ? C.cyan : 'transparent', color: selectedFigId === id ? C.graphite : C.cyan, border: `1px solid ${C.cyan}`, fontWeight: 700, fontSize: 12, padding: '10px 8px', flex: 1, cursor: 'pointer' }}>
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <p style={{ color: C.steel, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  The gap is bridged — the space right above the wall is reachable now. Place cargo carefully
                  to the right of the tall step, hanging over open air, to gently set down fragile cargo.
                  Choose the right cargo and reduce the height of the problem: <b style={{ color: C.deck }}>F01
                  (Mono)</b> rests safely right on top of the wall, no risk. <b style={{ color: C.deck }}>F05</b>{' '}
                  reaches further but hangs mostly over open air — that needs your fair-play OK, same as the
                  overhang rule from Step 4.
                </p>
                <div className="flex gap-2 mb-3">
                  {[5, 1].map(id => {
                    const f = FIGURES.find(ff => ff.id === id)!
                    return (
                      <button key={id} onClick={() => selectFigure(f)}
                        style={{ background: selectedFigId === id ? C.cyan : 'transparent', color: selectedFigId === id ? C.graphite : C.cyan, border: `1px solid ${C.cyan}`, fontWeight: 700, fontSize: 12, padding: '10px 8px', flex: 1, cursor: 'pointer' }}>
                        {f.label} — {f.name}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {selectedFig && (
              <>
                {notation && <code style={{ color: C.deck, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, display: 'block', marginBottom: 10 }}>{notation}</code>}
                <button onClick={() => place()} disabled={clickPoints.length < pointsNeeded}
                  style={{ background: clickPoints.length >= pointsNeeded ? C.cyan : C.steelDim, color: C.graphite, fontWeight: 700, fontSize: 12, padding: '10px 14px', border: 'none', width: '100%', cursor: clickPoints.length >= pointsNeeded ? 'pointer' : 'default', marginBottom: 10 }}>Place</button>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={() => initStep(7)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 12px', flex: 1, cursor: 'pointer' }} className="hover:text-deck transition-colors">Reset</button>
              {stepClimbDone && (
                <button onClick={() => setTutStep(8)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 12, padding: '8px 14px', border: 'none', flex: 1, cursor: 'pointer' }}>Next →</button>
              )}
            </div>
          </div>
        </div>
      )}"""

apply(old_block, new_block, "replace Step 8 (tutStep 7) JSX block")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Step 8 redesign applied.")
