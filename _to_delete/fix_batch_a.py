import re

path = "src/App.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

def apply(old, new, label, count=1):
    global content
    n = content.count(old)
    assert n == count, f"{label}: expected {count} occurrence(s), found {n}"
    content = content.replace(old, new, count)
    print(f"OK: {label} ({n} replaced)")

# 1. Add hover wiring to the 4 click-to-place tutorial grids (steps 1, 4, 6, 7) so the
#    live "where would point 2 land" preview (already built into ContainerGrid, already
#    used in free mode / DevTestPage) actually shows during the tutorial too.
apply(
    """              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={30}
                pieces={pieces} onCellClick={handleCellClick}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />""",
    """              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={30}
                pieces={pieces} onCellClick={handleCellClick}
                onCellHover={(r, c) => setHoverCell({ r, c })} onCellLeave={() => setHoverCell(null)}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />""",
    "hover wiring: tutStep 1 grid",
)

apply(
    """              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} onCellClick={handleCellClick}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>This placement walled off {deadCellAdvisory} cell{deadCellAdvisory > 1 ? 's' : ''} — they can never receive cargo now. Try Reset for a cleaner spot.</p>""",
    """              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} onCellClick={handleCellClick}
                onCellHover={(r, c) => setHoverCell({ r, c })} onCellLeave={() => setHoverCell(null)}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>This placement walled off {deadCellAdvisory} cell{deadCellAdvisory > 1 ? 's' : ''} — they can never receive cargo now. Try Reset for a cleaner spot.</p>""",
    "hover wiring: tutStep 4 grid",
)

apply(
    """              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} onCellClick={handleCellClick}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>That one walled off {deadCellAdvisory} cell{deadCellAdvisory > 1 ? 's' : ''}.</p>""",
    """              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} onCellClick={handleCellClick}
                onCellHover={(r, c) => setHoverCell({ r, c })} onCellLeave={() => setHoverCell(null)}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && (
              deadCellAdvisory > 0
                ? <p style={{ color: '#ffaa00', fontSize: 13, marginTop: 10 }}>That one walled off {deadCellAdvisory} cell{deadCellAdvisory > 1 ? 's' : ''}.</p>""",
    "hover wiring: tutStep 6 (shipments) grid",
)

apply(
    """              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} onCellClick={handleCellClick}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && stepClimbTargetPlaced && (""",
    """              <ContainerGrid filledCells={filled} rows={ROWS} showJKSeparator cellSize={26}
                pieces={pieces} onCellClick={handleCellClick}
                onCellHover={(r, c) => setHoverCell({ r, c })} onCellLeave={() => setHoverCell(null)}
                ghostCells={ghostCells} ghostValid={ghostValid} markCells={clickPoints} />
            </div>
            {message && <p style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{message}</p>}
            {deadCellAdvisory != null && stepClimbTargetPlaced && (""",
    "hover wiring: tutStep 7 (climbing) grid",
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Batch A part 1 (hover wiring) done.")
