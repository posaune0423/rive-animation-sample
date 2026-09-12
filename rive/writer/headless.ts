import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { RiveCanvas } from '@rive-app/canvas-advanced'

/**
 * Loads the Rive WASM runtime outside a browser (bun / node / vitest) so generated files can be
 * parsed and driven headlessly. The advanced runtime touches `document` at module init, so a
 * minimal stub is installed before importing it.
 */
let instance: Promise<RiveCanvas> | undefined

export const loadHeadlessRive = (): Promise<RiveCanvas> => {
  instance ??= (async () => {
    const g = globalThis as { document?: unknown; window?: unknown }
    g.document ??= {
      createElement: () => ({ getContext: () => null, style: {} }),
    }
    g.window ??= globalThis
    const require = createRequire(import.meta.url)
    const wasmPath = require.resolve('@rive-app/canvas-advanced/rive.wasm')
    const bytes = readFileSync(wasmPath)
    const wasmBinary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    const mod = await import('@rive-app/canvas-advanced')
    return mod.default({ locateFile: () => wasmPath, wasmBinary })
  })()
  return instance
}
