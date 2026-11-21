// Auth flow tests (TO_DO 45): the sign-in / sign-up / forgot-password / recovery flows
// on the real AuthPage, driven through the DOM with a scripted supabase auth mock.
// The AuthPage is a 3D flip card — BOTH faces are always in the DOM (hidden via CSS
// transforms only), so every query is scoped to the active face via `within`.
// @vitest-environment jsdom
import { afterEach, afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import App from '../../src/App'
import { translate } from '../../src/lib/i18n'

type Row = Record<string, unknown>

function builder(result: { data: Row[] | null; error: { message: string; code?: string } | null }): Record<string, unknown> {
  const b: Record<string, unknown> = {}
  const chain = (): unknown => b
  for (const m of ['select', 'eq', 'order', 'limit', 'like', 'single', 'upsert', 'insert', 'update', 'delete']) {
    b[m] = vi.fn(chain)
  }
  b.then = (onFulfilled: (r: { data: Row[] | null; error: unknown }) => unknown) =>
    Promise.resolve(result).then(onFulfilled)
  return b
}

const auth = {
  session: null as null | { user: { id: string; email: string } },
  recovery: false,
  email: 'x@y.z',
  password: 'password1',
  calls: { signUp: 0, signIn: 0, reset: 0, updateUser: 0 },
  listeners: new Set<(event: string, session: unknown) => void>(),
}

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: auth.session } }),
      onAuthStateChange: (cb?: (e: string, s: unknown) => void) => {
        if (cb) {
          auth.listeners.add(cb)
          queueMicrotask(() => {
            if (auth.recovery && auth.session) cb('PASSWORD_RECOVERY', auth.session)
            else cb('INITIAL_SESSION', auth.session)
          })
        }
        return { data: { subscription: { unsubscribe() { auth.listeners.delete(cb!) } } } }
      },
      signInWithPassword: async (creds: { email: string; password: string }) => {
        auth.calls.signIn++
        if (creds.email === auth.email && creds.password === auth.password) {
          auth.session = { user: { id: 'u1', email: creds.email } }
          setTimeout(() => auth.listeners.forEach((cb) => cb('SIGNED_IN', auth.session)), 0)
          return { error: null }
        }
        return { error: { message: 'Invalid login credentials' } }
      },
      signUp: async (data: { email: string }) => {
        auth.calls.signUp++
        if (data.email === 'taken@y.z') return { error: { message: 'User already registered' } }
        return { error: null }
      },
      resetPasswordForEmail: async () => {
        auth.calls.reset++
        return { error: null }
      },
      updateUser: async () => {
        auth.calls.updateUser++
        return { error: null }
      },
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {
      if (table === 'users') return builder({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
      return builder({ data: [], error: null })
    },
  },
}))

class FakeAudio {
  loop = false
  volume = 1
  src = ''
  paused = true
  private attrs = new Map<string, string>()
  async play() { this.paused = false; return undefined }
  pause() { this.paused = true }
  getAttribute(n: string) { return this.attrs.get(n) ?? null }
  setAttribute(n: string, v: string) { this.attrs.set(n, v) }
  removeAttribute(n: string) { this.attrs.delete(n) }
}

let originalFetch: typeof fetch
beforeAll(() => {
  originalFetch = globalThis.fetch
  globalThis.fetch = (async () => { throw new TypeError('offline') }) as typeof fetch
  vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio)
})
afterAll(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllGlobals()
})
beforeEach(() => {
  auth.session = null
  auth.recovery = false
  auth.calls = { signUp: 0, signIn: 0, reset: 0, updateUser: 0 }
  auth.listeners.clear()
  window.localStorage.clear()
  window.localStorage.setItem('ps_geo_prompt', 'done')
  window.history.replaceState({}, '', '/')
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const T = (key: string) => translate('BY', key)

/** The active face of the AuthPage flip card: the sign-in (front) or sign-up (back) side. */
function face(kind: 'signin' | 'signup'): HTMLElement {
  const faces = [...document.querySelectorAll<HTMLDivElement>('div[style*="backface"]')]
  const hit = faces.find((el) =>
    kind === 'signup' ? el.style.transform === 'rotateY(180deg)' : el.style.transform === '' || el.style.transform === 'rotateY(0deg)')
  if (!hit) throw new Error(`flip-card face ${kind} not found (${faces.map((f) => f.style.transform).join(' / ')})`)
  return hit
}

const inputByType = (root: ParentNode, type: string) =>
  [...root.querySelectorAll('input')].find((el) => el.getAttribute('type') === type) as HTMLInputElement

const btnIn = (root: ParentNode, txt: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === txt) as HTMLButtonElement

async function openAuth(user: ReturnType<typeof userEvent.setup>): Promise<RenderResult> {
  const view = render(<App />)
  // The header's Sign In button and the AuthPage h2 share the label — take the button.
  await user.click((await screen.findAllByText(T('Sign In'))).find((el) => el.tagName === 'BUTTON')!)
  await screen.findByText(T('New here?'))
  return view
}

async function pollSignOut(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 300))
    if (screen.queryByTitle(T('Sign out')) !== null) return
  }
}

describe('AuthPage — sign in', () => {
  it('empty submit shows validation, wrong credentials show the localized error, correct ones sign in', async () => {
    const user = userEvent.setup()
    await openAuth(user)
    const f = face('signin')

    // 1) Empty submit → validation errors.
    await user.click(btnIn(f, T('Sign in')))
    expect(within(f).getByText(T('Enter a valid email address'))).toBeInTheDocument()
    expect(within(f).getByText(T('Required'))).toBeInTheDocument()

    // 2) Wrong credentials → localized error, no session.
    await user.type(inputByType(f, 'email'), 'who@y.z')
    await user.type(inputByType(f, 'password'), 'wrongpass')
    await user.click(btnIn(f, T('Sign in')))
    expect(await within(f).findByText(T('Incorrect email or password'))).toBeInTheDocument()
    expect(screen.queryByTitle(T('Sign out'))).toBeNull()
    expect(auth.calls.signIn).toBe(1)

    // 3) Correct credentials → the SIGNED_IN event reaches the app shell → sign-out control.
    await user.clear(inputByType(f, 'email'))
    await user.type(inputByType(f, 'email'), auth.email)
    await user.clear(inputByType(f, 'password'))
    await user.type(inputByType(f, 'password'), auth.password)
    await user.click(btnIn(f, T('Sign in')))
    await pollSignOut()
    expect(screen.queryByTitle(T('Sign out'))).not.toBeNull()
    expect(auth.calls.signIn).toBe(2)
  }, 60_000)
})

describe('AuthPage — sign up', () => {
  it('validation: short password and no consent block the submit before signUp() is called', async () => {
    const user = userEvent.setup()
    await openAuth(user)
    await user.click(within(face('signin')).getByText(T('Create an account')))
    const f = face('signup')
    await within(f).findByText(T('First Name'))
    await user.type(inputByType(f, 'email'), 'new@y.z')
    await user.type(inputByType(f, 'password'), 'short')
    await user.click(btnIn(f, T('Стварыць акаўнт')))
    expect(within(f).getByText(T('Minimum 8 characters'))).toBeInTheDocument()
    expect(within(f).getByText(T('You must agree to the rules to continue'))).toBeInTheDocument()
    expect(auth.calls.signUp).toBe(0)
  }, 40_000)

  it('happy path lands on "Check your email"; a taken email shows the localized error', async () => {
    const user = userEvent.setup()
    await openAuth(user)
    {
      await user.click(within(face('signin')).getByText(T('Create an account')))
      const f = face('signup')
      await within(f).findByText(T('First Name'))
      const inputs = [...f.querySelectorAll('input')]
      await user.type(inputs.find((el) => !el.getAttribute('type'))!, 'Сяргей')
      await user.type(inputByType(f, 'email'), 'fresh@y.z')
      await user.type(inputByType(f, 'password'), 'password1')
      await user.type([...f.querySelectorAll('input[type="password"]')][1], 'password1')
      await user.click(within(f).getByText(T('I have read and agree to the game rules and terms of use')).closest('label')!.querySelector('div')!)
      await user.click(btnIn(f, T('Стварыць акаўнт')))
      expect(await screen.findByText(T('Check your email'))).toBeInTheDocument()
      expect(screen.getByText(/fresh@y\.z/)).toBeInTheDocument()
      expect(auth.calls.signUp).toBe(1)
    }

    // Fresh render for the taken-email leg: the sent view has no way back (canon).
    cleanup()
    await openAuth(user)
    await user.click(within(face('signin')).getByText(T('Create an account')))
    const f = face('signup')
    await within(f).findByText(T('First Name'))
    const inputs = [...f.querySelectorAll('input')]
    await user.type(inputs.find((el) => !el.getAttribute('type'))!, 'Сяргей')
    await user.type(inputByType(f, 'email'), 'taken@y.z')
    await user.type(inputByType(f, 'password'), 'password1')
    await user.type([...f.querySelectorAll('input[type="password"]')][1], 'password1')
    await user.click(within(f).getByText(T('I have read and agree to the game rules and terms of use')).closest('label')!.querySelector('div')!)
    await user.click(btnIn(f, T('Стварыць акаўнт')))
    expect(await within(f).findByText(T('This email is already used'))).toBeInTheDocument()
    expect(auth.calls.signUp).toBe(2)
  }, 60_000)
})

describe('AuthPage — forgot password', () => {
  it('invalid email shows the validation error; a valid one reports the sent link', async () => {
    const user = userEvent.setup()
    await openAuth(user)
    const f = face('signin')
    await user.click(within(f).getByText(T('Forgot password?')))
    await screen.findByText(T('Reset your password'))
    const email = inputByType(document.body, 'email')
    await user.type(email, 'not-an-email')
    await user.click(btnIn(document.body, T('Send reset link')))
    expect(screen.getByText(T('Enter a valid email address'))).toBeInTheDocument()
    expect(auth.calls.reset).toBe(0)

    await user.type(email, 'me@y.z')
    await user.click(btnIn(document.body, T('Send reset link')))
    expect(await screen.findByText(/me@y\.z/)).toBeInTheDocument()
    expect(screen.getAllByText(T('Back to sign in')).length).toBeGreaterThan(0)
    expect(auth.calls.reset).toBe(1)
  }, 40_000)
})

describe('AuthPage — recovery mode (?type=recovery)', () => {
  it('with a recovery session: short password rejected, mismatch rejected, a valid one shows "Password updated"', async () => {
    auth.recovery = true
    auth.session = { user: { id: 'u1', email: 'x@y.z' } }
    window.history.replaceState({}, '', '/?type=recovery')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(T('Set a new password'))
    const pwd = [...document.querySelectorAll('input[type="password"]')] as HTMLInputElement[]
    expect(pwd.length).toBe(2)
    // Weak password.
    await user.type(pwd[0], 'short')
    await user.click(btnIn(document.body, T('Save new password')))
    expect(screen.getByText(T('Minimum 8 characters'))).toBeInTheDocument()
    // Mismatch (clear first — user.type appends).
    await user.clear(pwd[0])
    await user.type(pwd[0], 'password1')
    await user.type(pwd[1], 'password2')
    await user.click(btnIn(document.body, T('Save new password')))
    expect(screen.getByText(T('Passwords do not match'))).toBeInTheDocument()
    expect(auth.calls.updateUser).toBe(0)
    // Valid.
    await user.clear(pwd[1])
    await user.type(pwd[1], 'password1')
    await user.click(btnIn(document.body, T('Save new password')))
    expect(await screen.findByText(T('Password updated'))).toBeInTheDocument()
    expect(auth.calls.updateUser).toBe(1)
  }, 40_000)
})
