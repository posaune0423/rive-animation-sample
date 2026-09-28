import type { NextConfig } from 'next'

/**
 * GitHub Pages serves this repository at `/<repo>/`, so the app is exported as static files under
 * that prefix. `basePath` only rewrites `next/link` and the framework's own assets; anything we
 * fetch by hand (the .riv / Lottie / WebP files and rive.wasm) is prefixed in `rive/catalog.ts`
 * and `src/features/gift/rive/runtime.ts` from the same environment variable.
 *
 * Locally the variable is unset, so the app keeps serving from the root.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT_EXPORT === 'true' ? { output: 'export' } : {}),
  ...(basePath === '' ? {} : { basePath }),
  // `/perf` is emitted as `perf/index.html`, which a static host serves without extra rules
  trailingSlash: true,
}

export default nextConfig
