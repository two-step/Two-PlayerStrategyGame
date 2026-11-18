/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the IP-geolocation endpoint used by the language gate (TO_DO 28). */
  readonly VITE_GEO_URL?: string
}
