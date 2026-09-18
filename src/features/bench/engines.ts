/** Which runtime draws the tiles on /perf. */
export type Engine = 'rive' | 'lottie-svg' | 'lottie-canvas'

export const ENGINES: readonly Engine[] = ['rive', 'lottie-svg', 'lottie-canvas']

export const ENGINE_LABEL: Record<Engine, string> = {
  rive: 'Rive (WebGL2)',
  'lottie-svg': 'Lottie (SVG)',
  'lottie-canvas': 'Lottie (Canvas)',
}

export const isEngine = (value: string | null): value is Engine =>
  value !== null && (ENGINES as readonly string[]).includes(value)
