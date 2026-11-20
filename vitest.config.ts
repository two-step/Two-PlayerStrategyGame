import { defineConfig } from 'vitest/config'

// TO_DO item 45: unit/integration test harness for the PuzzleStow engine.
// Scope: the engine modules (src/engine/**) — the server-authoritative rule logic.
// App.tsx is recognized tech debt (46e: gradual migration); UI coverage is not gated here.
// Orientation canon (44a): row A at the BOTTOM (r = ROWS-1), row K on top, entrance A0,
// columns 0–14 left-to-right. Every fixture and assertion below follows it.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Engine decisions may cold-start with memo warmup (~1–2 s first call).
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      reporter: ['text', 'html'],
    },
  },
})
