import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Set in .env.local (gitignored) -- see .env.example. VITE_-prefixed so Vite
// exposes them to client code. Publishable key is safe to ship to the
// browser (it's the whole point of the split from the service_role key) --
// row access is still gated by the RLS policies on public.users.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !publishableKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Supabase env vars missing -- copy .env.example to .env.local and fill in VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.'
  )
}

export const supabase: SupabaseClient = createClient(url ?? '', publishableKey ?? '')

// PuzzleStow's row in public.users -- see supabase/migrations/20260908101531_create_users_table.sql,
// 20260908102500_add_nickname_to_users.sql and 20260908173050_add_avatar_blob_to_users.sql. 1:1
// with auth.users via id.
//
// avatar is stored as raw binary (bytea) IN THE ROW -- Sergey's explicit choice, not a Supabase
// Storage URL reference (see the migration's comment for why that's a deliberate deviation from
// PairSec_Спецификация_Final_2026.docx §10.1's `photo_url` field). PostgREST represents bytea as
// a Postgres hex-escape string ("\\x89504e47...") over JSON, both reading and writing -- it is
// NOT raw bytes and NOT base64. avatar_content_type carries the MIME type since bytea alone has
// no way to say whether it's a PNG, JPEG, etc.
export interface PuzzleStowProfile {
  id: string
  name: string
  telegram_id: number | null
  game_qualification: string
  nickname: string | null
  use_nickname: boolean
  subscribed_to_news: boolean
  role: string
  avatar: string | null
  avatar_content_type: string | null
  agreed_to_terms_at: string
  created_at: string
}

// Max dimension (px) an avatar is downscaled to before upload, and the max raw file size
// accepted before even attempting that -- avatar lives inline in the users row (not Storage),
// so keeping it small matters more here than it would for a normal image upload: an
// unresized photo would bloat this row (and every profile fetch) for no visual benefit at
// this display size.
const AVATAR_MAX_DIM = 256
const AVATAR_MAX_SOURCE_BYTES = 8 * 1024 * 1024 // 8 MB raw upload cap, before resize

// Downscales an image file to at most AVATAR_MAX_DIM on its longest side (never upscales a
// smaller image) and re-encodes it as JPEG, so a phone photo doesn't end up stored at full
// resolution inside a database row.
export async function resizeAvatarFile(file: File): Promise<{ blob: Blob; contentType: string }> {
  if (file.size > AVATAR_MAX_SOURCE_BYTES) {
    throw new Error(`Image is too large (max ${(AVATAR_MAX_SOURCE_BYTES / (1024 * 1024)).toFixed(0)} MB)`)
  }
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, AVATAR_MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Could not encode image')
  return { blob, contentType: 'image/jpeg' }
}

// Blob -> Postgres bytea hex-escape string ("\\x..."), the format PostgREST expects for a
// bytea column on insert/update.
export async function blobToByteaHex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let hex = '\\x'
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return hex
}

// Postgres bytea hex-escape string -> a browser object URL for <img src>. Caller is
// responsible for revoking the URL (URL.revokeObjectURL) when it's no longer displayed, to
// avoid leaking memory across repeated avatar changes in the same session.
export function byteaHexToObjectUrl(hex: string, contentType: string): string {
  const clean = hex.startsWith('\\x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16)
  return URL.createObjectURL(new Blob([bytes], { type: contentType }))
}
