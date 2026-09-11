path = "src/App.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

def apply(old, new, label, count=1):
    global content
    n = content.count(old)
    assert n == count, f"{label}: expected {count} occurrence(s), found {n}"
    content = content.replace(old, new, count)
    print(f"OK: {label} ({n} replaced)")

# goBack(): step back one tutorial step. The tutStep-change effect already re-runs
# initStep()/fairPlayDemoPhase reset on ANY change to tutStep (forward or backward), so
# decrementing is enough -- the step being entered re-seeds itself the same way it does
# when reached going forward.
apply(
    """  function clearContainer() {""",
    """  function goBack() {
    setTutStep(s => Math.max(0, s - 1))
  }

  function clearContainer() {""",
    "add goBack function",
)

apply(
    """          {mode === 'tutorial' && tutStep < TOTAL_TUT_STEPS && (
            <button onClick={startFreeMode} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px' }}
              className="hover:text-deck transition-colors">Skip to free sandbox</button>
          )}""",
    """          {mode === 'tutorial' && tutStep > 0 && tutStep <= TOTAL_TUT_STEPS && (
            <button onClick={goBack} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px', cursor: 'pointer' }}
              className="hover:text-deck transition-colors">← Back</button>
          )}
          {mode === 'tutorial' && tutStep < TOTAL_TUT_STEPS && (
            <button onClick={startFreeMode} style={{ color: C.steelDim, border: `1px solid ${C.steelDim}40`, fontSize: 12, padding: '4px 12px' }}
              className="hover:text-deck transition-colors">Skip to free sandbox</button>
          )}""",
    "add Back button to header",
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Batch C done.")
