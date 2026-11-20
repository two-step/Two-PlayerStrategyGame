// I18nContext — React layer over i18n.ts (TO_DO item 28).
// Purpose: single source of the viewing language for the whole SPA; persists the
// choice; detects the visitor's country once and exposes a suggested language so
// App.tsx can ASK (never silently switch) whether to change the viewing language.
//
// Preconditions: rendered once, above every translated component (App root).
// Postconditions: useLang() always returns a working { lang, setLang, t, geoSuggestion }
// — missing provider degrades to a static EN fallback instead of throwing.
// Invariants: `lang` is always a valid Lang; document.documentElement.lang follows it.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  DEFAULT_LANG, detectCountryCode, geoPromptAnswered, htmlLangTag, langForCountry,
  loadStoredLang, markGeoPromptAnswered, saveStoredLang, translate, type Lang,
} from "./i18n"

/** One-time geo result the App renders as a "change language?" question. */
export interface GeoSuggestion {
  /** Language suggested for the detected country (unmapped countries suggest EN). */
  suggested: Lang
  /** Two-letter country code the suggestion came from ("BY", "RU", …) or null. */
  countryCode: string | null
}

interface I18nContextValue {
  /** Current viewing language (starts at DEFAULT_LANG or the stored choice). */
  lang: Lang
  /** Switches the viewing language and persists it. */
  setLang: (lang: Lang) => void
  /** Translate an English source key with {param} interpolation. */
  t: (key: string, params?: Record<string, string | number>) => string
  /** One-time geo suggestion, or null when none should be asked. */
  geoSuggestion: GeoSuggestion | null
  /** Dismisses the question, recording that it was answered. */
  dismissGeoSuggestion: () => void
  /** Accepts the suggestion: switches to the suggested language. */
  acceptGeoSuggestion: () => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STATIC_FALLBACK: I18nContextValue = {
  lang: "EN",
  setLang: () => undefined,
  t: key => key,
  geoSuggestion: null,
  dismissGeoSuggestion: () => undefined,
  acceptGeoSuggestion: () => undefined,
}

/**
 * Provider owning the viewing language and the one-time geo question.
 * Preconditions: mount once above all translated UI.
 * Postconditions: children can call useLang(); <html lang> mirrors the choice.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadStoredLang)
  const [geoSuggestion, setGeoSuggestion] = useState<GeoSuggestion | null>(null)

  // One-shot country detection on first visit: fetch the country, map it to a
  // suggested language, and surface the question only when it differs from the
  // current viewing language AND this browser hasn't answered before.
  useEffect(() => {
    if (geoPromptAnswered()) return
    let cancelled = false
    detectCountryCode().then(code => {
      if (cancelled) return
      const suggested = langForCountry(code)
      markGeoPromptAnswered()
      if (suggested !== lang) setGeoSuggestion({ suggested, countryCode: code })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // <html lang> mirrors the viewing language (a11y, spellcheck, translation tools).
  useEffect(() => {
    document.documentElement.lang = htmlLangTag(lang)
  }, [lang])

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    setLang: nextLang => {
      setLangState(nextLang)
      saveStoredLang(nextLang)
    },
    t: (key, params) => translate(lang, key, params),
    geoSuggestion,
    dismissGeoSuggestion: () => { markGeoPromptAnswered(); setGeoSuggestion(null) },
    acceptGeoSuggestion: () => {
      if (!geoSuggestion) return
      setLangState(geoSuggestion.suggested)
      saveStoredLang(geoSuggestion.suggested)
      markGeoPromptAnswered()
      setGeoSuggestion(null)
    },
  }), [lang, geoSuggestion])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * Accesses the viewing language + translator.
 * Preconditions: component is under an I18nProvider (App root guarantees it).
 * Postconditions: without a provider returns a safe EN fallback (never throws).
 */
/* eslint-disable react-refresh/only-export-components -- context-file pattern:
 * the hook shares the module's context object; splitting it into a separate file
 * would force every consumer to import two paths for one concept. */
export function useLang(): I18nContextValue {
  return useContext(I18nContext) ?? STATIC_FALLBACK
}

/** Convenience re-export for consumers that need the DEFAULT_LANG constant. */
export { DEFAULT_LANG }
