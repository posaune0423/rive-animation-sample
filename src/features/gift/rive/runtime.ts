'use client'

import { RuntimeLoader } from '@rive-app/react-webgl2'
import manifest from '@rive/manifest.json'
import { recordWasm } from '../metrics'

/** Self-hosted `rive.wasm`, same version as the `@rive-app/webgl2` the React runtime pins. */
export const WASM_URL: string = manifest.wasm.file

let started: Promise<void> | null = null

/**
 * Starts downloading + compiling the WASM before any Rive component mounts
 * (docs: Runtimes → React → Preloading WASM). Safe to call many times.
 */
export const preloadRiveRuntime = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve()
  if (started) return started
  const t0 = performance.now()
  RuntimeLoader.setWasmUrl(WASM_URL)
  started = RuntimeLoader.awaitInstance().then(() => {
    const entry = performance
      .getEntriesByType('resource')
      .find((e): e is PerformanceResourceTiming => e.name.endsWith(WASM_URL))
    recordWasm({
      url: WASM_URL,
      loadMs: Math.round(performance.now() - t0),
      encodedBytes: entry?.encodedBodySize ?? null,
      decodedBytes: entry?.decodedBodySize ?? null,
      firstInstanceMs: null,
    })
  })
  return started
}
