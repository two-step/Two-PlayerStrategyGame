// zz.probe — former ad-hoc debug probe (kept because deletion needs Sergey's sign-off).
// All real coverage now lives in the named suites; nothing imports this file.
import { describe, expect, it } from 'vitest'

describe.skip('legacy debug probe (pending deletion approval)', () => {
  it('noop', () => { expect(true).toBe(true) })
})
