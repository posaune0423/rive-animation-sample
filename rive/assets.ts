import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ImageAsset } from './writer/scene'

const RENDERS = join(dirname(fileURLToPath(import.meta.url)), '..', 'art', 'renders')

/** Reads the pixel size from a WebP header (VP8 / VP8L / VP8X). */
export const webpSize = (bytes: Uint8Array): { width: number; height: number } => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP') throw new Error('not a WebP file')
  const chunk = tag(12)
  if (chunk === 'VP8X') {
    const w = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16))
    const h = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16))
    return { width: w, height: h }
  }
  if (chunk === 'VP8L') {
    const b = view.getUint32(21, true)
    return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) }
  }
  if (chunk === 'VP8 ') {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
  }
  throw new Error(`unsupported WebP chunk: ${chunk}`)
}

const cache = new Map<string, ImageAsset>()

/** Loads `art/renders/<name>.webp` as an embeddable image asset (cached per process). */
export const renderAsset = (name: string): ImageAsset => {
  const hit = cache.get(name)
  if (hit) return hit
  const file = join(RENDERS, `${name}.webp`)
  if (!existsSync(file)) throw new Error(`missing render: ${file} (run: bun run art/render.ts)`)
  const bytes = new Uint8Array(readFileSync(file))
  const asset: ImageAsset = { name, bytes, mime: 'image/webp', ...webpSize(bytes) }
  cache.set(name, asset)
  return asset
}

export const hasRender = (name: string): boolean => existsSync(join(RENDERS, `${name}.webp`))

/** Turntable frames `<name>_f00..` */
export const renderFrames = (name: string, count: number): ImageAsset[] =>
  Array.from({ length: count }, (_, i) => renderAsset(`${name}_f${String(i).padStart(2, '0')}`))
