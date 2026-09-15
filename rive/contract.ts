/**
 * Contract between the generated .riv files and the web runtime.
 * Anything the app relies on by name lives here so that a designer-made .riv can replace the
 * generated ones by honoring the same names.
 */
export const RIVE_CONTRACT = {
  stateMachine: 'Main',
  /** Trigger input that starts one playback. */
  playTrigger: 'play',
  /** Rive Event reported when the playback finished. */
  finishedEvent: 'finished',
  /** Timeline played once per trigger. */
  playAnimation: 'play',
  /** One-frame timeline that hides everything while idle (lets the runtime self-pause). */
  idleAnimation: 'idle',
  fps: 60,
} as const

export type Tier = 1 | 2 | 3 | 4 | 5

/** Playback length in seconds per tier (spec: 0.15 / 3 / 5 / 8 / 12). */
export const TIER_DURATION_SEC: Record<Tier, number> = { 1: 0.15, 2: 3, 3: 5, 4: 8, 5: 12 }

/** Artboard size per tier. T1 has no Rive artboard (CSS pop on an SVG icon). */
export const TIER_ARTBOARD: Record<Exclude<Tier, 1>, { width: number; height: number }> = {
  2: { width: 96, height: 96 },
  3: { width: 360, height: 360 },
  4: { width: 390, height: 844 },
  5: { width: 390, height: 844 },
}

/** Max drawables (shapes + images) per file, enforced by `riv:build`. */
export const TIER_SHAPE_BUDGET: Record<Exclude<Tier, 1>, number> = { 2: 20, 3: 40, 4: 80, 5: 150 }

/** Max .riv size in KB (embedded WebP renders included), enforced by `riv:build`. */
export const TIER_FILE_BUDGET_KB: Record<Exclude<Tier, 1>, number> = {
  2: 150,
  3: 320,
  4: 420,
  5: 420,
}

/**
 * Region of a full-frame artboard that must stay see-through (the streamer's face).
 * Fractions of width / height.
 */
export const FACE_SAFE_AREA = { left: 0.22, right: 0.78, top: 0.18, bottom: 0.58 } as const
