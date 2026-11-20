// I18n dictionary parity + translation behaviour (TO_DO 28/45).
// Canon: EN source keys; every entry carries non-empty RU and BY translations.
// jsdom env for the localStorage-backed language helpers.
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  COUNTRY_TO_LANG, DEFAULT_LANG, DICT, LANGS, LANG_STORAGE_KEY,
  detectCountryCode, geoPromptAnswered, htmlLangTag, langForCountry,
  loadStoredLang, markGeoPromptAnswered, saveStoredLang, translate,
  translateEngineText,
} from '../../src/lib/i18n'

describe('dictionary parity (EN source → RU/BY)', () => {
  it('every RU key has a BY entry and vice versa', () => {
    const ru = Object.keys(DICT.RU).sort()
    const by = Object.keys(DICT.BY).sort()
    expect(ru).toEqual(by)
  })

  it('no empty translations', () => {
    for (const [lang, dict] of Object.entries(DICT)) {
      if (lang === 'EN') continue
      for (const [key, value] of Object.entries(dict)) {
        expect(value, `${lang}: ${key}`).toBeTruthy()
        expect((value as string).trim().length, `${lang}: ${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('static t() literals used in App.tsx all exist in the dictionary', () => {
    const appSrc = readFileSync('src/App.tsx', 'utf8')
    const used = new Set<string>()
    for (const m of appSrc.matchAll(/\bt\(\s*'((?:[^'\\\n]|\\.)*)'\s*[),]/g)) used.add(m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'))
    for (const m of appSrc.matchAll(/\bt\(\s*"((?:[^"\\\n]|\\.)*)"\s*[),]/g)) used.add(m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
    expect(used.size).toBeGreaterThan(50)
    const missing = [...used].filter((k) => !(k in DICT.RU))
    expect(missing, 'untranslated static keys').toEqual([])
  })
})

describe('translate()', () => {
  it('EN falls back to the source key; RU/BY translate known keys', () => {
    const key = 'Sign in to play Practice'
    expect(translate('EN', key)).toBe(key)
    expect(translate('RU', key)).toBe('Войдите, чтобы играть в Тренировку')
    expect(translate('BY', key)).toBe('Увайдзіце, каб гуляць у Трэніроўку')
  })

  it('unknown keys degrade to EN (the key itself), never throw', () => {
    expect(translate('RU', 'No such key')).toBe('No such key')
    expect(translate('BY', 'No such key')).toBe('No such key')
  })

  it('interpolates {name} params', () => {
    const key = 'We sent a password reset link to {email}. Follow it to choose a new password.'
    const out = translate('RU', key, { email: 'a@b.c' })
    expect(out).toContain('a@b.c')
    expect(out).not.toContain('{email}')
  })
})

describe('engine-text translation', () => {
  it('regex patterns re-insert captures as params', () => {
    const out = translateEngineText('RU', 'Point A5 is outside the 11-row container')
    expect(out).not.toBe('Point A5 is outside the 11-row container')
    expect(out).toContain('11')
  })

  it('unknown messages pass through untranslated (never throws)', () => {
    const msg = 'Totally unknown engine message'
    expect(translateEngineText('EN', msg)).toBe(msg)
    expect(translateEngineText('RU', msg)).toBe(msg)
  })
})

describe('language persistence and geo helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to BY (Belarusian start), persists and loads', () => {
    expect(DEFAULT_LANG).toBe('BY')
    expect(loadStoredLang()).toBe('BY')
    saveStoredLang('RU')
    expect(loadStoredLang()).toBe('RU')
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('RU')
  })

  it('geo-prompt answered flag round-trips', () => {
    expect(geoPromptAnswered()).toBe(false)
    markGeoPromptAnswered()
    expect(geoPromptAnswered()).toBe(true)
  })

  it('country → language mapping and BCP-47 tags', () => {
    expect(Object.keys(COUNTRY_TO_LANG).sort()).toEqual(['BY', 'RU'])
    expect(langForCountry('ru')).toBe('RU')
    expect(langForCountry('BY')).toBe('BY')
    expect(langForCountry(null)).toBe('EN')
    expect(langForCountry('US')).toBe('EN')
    expect(htmlLangTag('BY')).toBe('be')
    expect(htmlLangTag('RU')).toBe('ru')
    expect(htmlLangTag('EN')).toBe('en')
  })

  it('detectCountryCode never rejects; failures return null', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => { throw new TypeError('offline') }) as typeof fetch
    await expect(detectCountryCode()).resolves.toBeNull()
    globalThis.fetch = (async () => ({ ok: false })) as unknown as typeof fetch
    await expect(detectCountryCode()).resolves.toBeNull()
    globalThis.fetch = originalFetch
  })

  it('LANGS exposes exactly the three viewing languages', () => {
    expect(Object.keys(LANGS).sort()).toEqual(['BY', 'EN', 'RU'])
  })
})
