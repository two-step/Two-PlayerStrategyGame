path = "src/App.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

def apply(old, new, label, count=1):
    global content
    n = content.count(old)
    assert n == count, f"{label}: expected {count} occurrence(s), found {n}"
    content = content.replace(old, new, count)
    print(f"OK: {label} ({n} replaced)")

HOVER_CLS = ' className="hover:text-deck transition-colors"'

# 2. "Prev rule" button (Step 4 / tutStep 3) -- add hover feedback + explicit pointer
#    cursor so it visibly reads as clickable instead of looking disabled.
apply(
    """              {rulesPanelIdx > 0 && (
                <button onClick={() => setRulesPanelIdx(i => i - 1)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 18px' }}>← Prev rule</button>
              )}""",
    """              {rulesPanelIdx > 0 && (
                <button onClick={() => setRulesPanelIdx(i => i - 1)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 18px', cursor: 'pointer' }}""" + HOVER_CLS + """>← Prev rule</button>
              )}""",
    "Prev rule button hover/cursor fix",
)

# Clarify the RETURN PATH panel copy -- Sergey asked "why can't even a Mono pass through
# the entrance here" about this exact demo. Make explicit that size doesn't matter --
# it's specifically the LAST reachable cell being taken that's illegal.
apply(
    """        title: 'RETURN PATH', headline: "The very last move can't seal the container shut",
        body: 'A placement is refused if it would leave nowhere left to deliver cargo, anywhere in the whole container — here every cell but the entrance is already full:',
        note: 'This only guards the literal last reachable cell. Walling off a smaller pocket earlier is legal — those cells simply become permanently dead space.',""",
    """        title: 'RETURN PATH', headline: "The very last move can't seal the container shut",
        body: 'A placement is refused if it would leave nowhere left to deliver cargo, anywhere in the whole container — here every cell but the entrance is already full, so even a single-cell Mono is rejected if it lands here:',
        note: "This isn't about the figure's size or shape — a Mono is as small as it gets and still can't take this cell. It only guards the literal last reachable cell. Walling off a smaller pocket earlier is legal — those cells simply become permanently dead space.",""",
    "Return path panel copy clarification",
)

# 3. Reset buttons on Steps 5 & 6 (tutStep 4 & 5) -- same hover/cursor fix.
apply(
    """              <button onClick={() => initStep(4)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 14px' }}>Reset</button>""",
    """              <button onClick={() => initStep(4)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 14px', cursor: 'pointer' }}""" + HOVER_CLS + """>Reset</button>""",
    "tutStep4 Reset button hover/cursor fix",
)

apply(
    """              <button onClick={() => initStep(5)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 14px' }}>Reset</button>""",
    """              <button onClick={() => initStep(5)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 13, padding: '10px 14px', cursor: 'pointer' }}""" + HOVER_CLS + """>Reset</button>""",
    "tutStep5 Reset button hover/cursor fix",
)

# 4. Step 7 (tutStep 6, shipments): split Reset into "Reset last" / "Reset all", tracked
#    via a small per-placement history so "last" can undo exactly one shipment's cells
#    and exactly its own dead-cell contribution, not the whole sequence.
apply(
    """  const [shipmentIdx, setShipmentIdx] = useState(0) // 0..7 across the Step 6 sequence
  const [shipmentDeadTotal, setShipmentDeadTotal] = useState(0)""",
    """  const [shipmentIdx, setShipmentIdx] = useState(0) // 0..7 across the Step 6 sequence
  const [shipmentDeadTotal, setShipmentDeadTotal] = useState(0)
  const [shipmentHistory, setShipmentHistory] = useState<{ figId: number; cells: Cells; newDead: number }[]>([])""",
    "add shipmentHistory state",
)

apply(
    """    } else if (step === 6) {
      setFilled(new Set()); setPieces([]); setSelectedFigId(SHIPMENT_FIGS[0]); setRotIdx(0); setClickPoints([])
      setNotation(''); setMessage(null); setDeadCellAdvisory(null)
      setNotationInput(''); setNotationInputError(null)
      setShipmentIdx(0); setShipmentDeadTotal(0); setPendingFairPlay(null)""",
    """    } else if (step === 6) {
      setFilled(new Set()); setPieces([]); setSelectedFigId(SHIPMENT_FIGS[0]); setRotIdx(0); setClickPoints([])
      setNotation(''); setMessage(null); setDeadCellAdvisory(null)
      setNotationInput(''); setNotationInputError(null)
      setShipmentIdx(0); setShipmentDeadTotal(0); setShipmentHistory([]); setPendingFairPlay(null)""",
    "reset shipmentHistory in initStep(6)",
)

apply(
    """      else if (tutStep === 6) {
        setDeadCellAdvisory(newDead)
        setShipmentDeadTotal(t => t + newDead)
        const nextIdx = shipmentIdx + 1
        setShipmentIdx(nextIdx)""",
    """      else if (tutStep === 6) {
        setDeadCellAdvisory(newDead)
        setShipmentDeadTotal(t => t + newDead)
        setShipmentHistory(h => [...h, { figId: selectedFig.id, cells: result.cells!, newDead }])
        const nextIdx = shipmentIdx + 1
        setShipmentIdx(nextIdx)""",
    "record shipment placement into shipmentHistory",
)

# resetLastShipment(): undo exactly the most recent shipment placement.
apply(
    """  function clearContainer() {""",
    """  function resetLastShipment() {
    if (shipmentHistory.length === 0) return
    const last = shipmentHistory[shipmentHistory.length - 1]
    setFilled(f => {
      const next = new Set(f)
      last.cells.forEach(([r, c]) => next.delete(cellKey(r, c)))
      return next
    })
    setPieces(prev => prev.slice(0, -1))
    setShipmentHistory(h => h.slice(0, -1))
    setShipmentDeadTotal(t => Math.max(0, t - last.newDead))
    setShipmentIdx(i => Math.max(0, i - 1))
    setSelectedFigId(last.figId); setRotIdx(0); setClickPoints([]); setNotation(''); setMessage(null); setDeadCellAdvisory(null)
    setNotationInput(''); setNotationInputError(null)
  }

  function clearContainer() {""",
    "add resetLastShipment function",
)

apply(
    """            <div className="flex gap-2">
              <button onClick={() => initStep(6)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 12px', flex: 1 }}>Reset</button>
              {shipmentIdx >= SHIPMENT_CORE_COUNT && (
                <button onClick={() => setTutStep(7)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 12, padding: '8px 14px', border: 'none', flex: 1, cursor: 'pointer' }}>Next →</button>
              )}
            </div>""",
    """            <div className="flex gap-2">
              <button onClick={resetLastShipment} disabled={shipmentHistory.length === 0}
                style={{ color: shipmentHistory.length ? C.steelDim : `${C.steelDim}50`, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 10px', flex: 1, cursor: shipmentHistory.length ? 'pointer' : 'default' }}
                className={shipmentHistory.length ? 'hover:text-deck transition-colors' : ''}>Reset last</button>
              <button onClick={() => initStep(6)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 10px', flex: 1, cursor: 'pointer' }}""" + HOVER_CLS + """>Reset all</button>
              {shipmentIdx >= SHIPMENT_CORE_COUNT && (
                <button onClick={() => setTutStep(7)} style={{ background: C.blue, color: C.deck, fontWeight: 600, fontSize: 12, padding: '8px 14px', border: 'none', flex: 1, cursor: 'pointer' }}>Next →</button>
              )}
            </div>""",
    "split Step 7 Reset into Reset last / Reset all",
)

# 5. Step 8 (tutStep 7, climbing) Reset button -- same hover/cursor fix.
apply(
    """              <button onClick={() => initStep(7)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 12px', flex: 1 }}>Reset</button>""",
    """              <button onClick={() => initStep(7)} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 12px', flex: 1, cursor: 'pointer' }}""" + HOVER_CLS + """>Reset</button>""",
    "tutStep7 (climbing) Reset button hover/cursor fix",
)

# 6. Fair-play toggle buttons ("See the decline/confirm instead") -- same treatment.
apply(
    """<button onClick={() => setFairPlayDemoPhase('pending')} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 14px' }}>See the decline instead →</button>""",
    """<button onClick={() => setFairPlayDemoPhase('pending')} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 14px', cursor: 'pointer' }}""" + HOVER_CLS + """>See the decline instead →</button>""",
    "fair-play 'see decline' button hover/cursor fix",
)
apply(
    """<button onClick={() => setFairPlayDemoPhase('pending')} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 14px' }}>See the confirm instead →</button>""",
    """<button onClick={() => setFairPlayDemoPhase('pending')} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '8px 14px', cursor: 'pointer' }}""" + HOVER_CLS + """>See the confirm instead →</button>""",
    "fair-play 'see confirm' button hover/cursor fix",
)

# 7. Fix the mangled/corrupted arrow glyph on Step 9's Next button.
n_mangled = content.count('Next ���')
print(f"mangled-arrow occurrences found: {n_mangled}")
if n_mangled:
    content = content.replace('Next ���', 'Next →')
    print("OK: fixed mangled Next arrow (Step 9)")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Batch B done.")
