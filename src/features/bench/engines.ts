/** Which runtime draws the tiles on /perf. */
export type Engine = 'rive' | 'rive-own-context' | 'lottie-svg' | 'lottie-canvas'

export const ENGINES: readonly Engine[] = [
  'rive',
  'rive-own-context',
  'lottie-svg',
  'lottie-canvas',
]

export const ENGINE_LABEL: Record<Engine, string> = {
  rive: 'Rive 共有ctx',
  'rive-own-context': 'Rive 個別ctx',
  'lottie-svg': 'Lottie (SVG)',
  'lottie-canvas': 'Lottie (Canvas)',
}

/**
 * Rive's `useOffscreenRenderer` packs every instance into one shared WebGL2 canvas (a texture
 * atlas, re-packed and resized each frame) and then copies each rect out to its own 2D canvas.
 * That keeps the WebGL context count at 1 — browsers cap live contexts, and iOS Safari drops them
 * under memory pressure — at the cost of a per-frame atlas resize plus one cross-context blit per
 * visible instance. Turning it off gives each canvas its own WebGL2 context: no blit, but the
 * context budget limits how many can be alive at once.
 */
export const usesSharedContext = (engine: Engine): boolean => engine === 'rive'

export const isRive = (engine: Engine): boolean =>
  engine === 'rive' || engine === 'rive-own-context'

export const isEngine = (value: string | null): value is Engine =>
  value !== null && (ENGINES as readonly string[]).includes(value)
