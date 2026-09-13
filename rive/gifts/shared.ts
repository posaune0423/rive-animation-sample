import type { Scene } from '../writer/scene'
import {
  ellipse,
  path,
  shape,
  solid,
  star,
  type CubicVertex,
  type Paint,
  type SceneNode,
} from '../writer/scene'
import type { Timeline } from '../writer/timeline'
import type { Tier } from '../contract'

export type GiftId =
  | 'heart'
  | 'kiss'
  | 'candy'
  | 'sparkling'
  | 'plush'
  | 'bouquet'
  | 'perfume'
  | 'ring'
  | 'diamond'
  | 'suite'
  | 'palace'
  | 'myth'

export type GiftDefinition = {
  readonly id: GiftId
  readonly tier: Tier
  /** Vector drawing for the gift list (square artboard); used when `iconRender` is absent. */
  readonly icon?: Scene
  /** Name of a render in art/renders to use as the list icon. One of icon / iconRender is required. */
  readonly iconRender?: string
  /** Rive effect. Absent for T1 (CSS pop only). */
  readonly effect?: { readonly scene: Scene; readonly play: Timeline }
}

/** Deterministic PRNG (mulberry32) so generated files are byte-stable. */
export const seeded = (seed: number) => {
  let a = seed >>> 0
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

const angleDist = (
  from: readonly [number, number],
  to: readonly [number, number],
): { rotation: number; distance: number } => ({
  rotation: Math.atan2(to[1] - from[1], to[0] - from[0]),
  distance: Math.hypot(to[0] - from[0], to[1] - from[1]),
})

/** Cubic vertex from absolute handle positions (what an SVG path author thinks in). */
export const bez = (
  x: number,
  y: number,
  inHandle: readonly [number, number],
  outHandle: readonly [number, number],
): CubicVertex => {
  const i = angleDist([x, y], inHandle)
  const o = angleDist([x, y], outHandle)
  return {
    x,
    y,
    inRotation: i.rotation,
    inDistance: i.distance,
    outRotation: o.rotation,
    outDistance: o.distance,
  }
}

/** Heart outline in a 100×100 box centered at the origin. */
export const heartPath = (scale = 1) => {
  const s = scale
  return path([
    bez(0, -20 * s, [10 * s, -40 * s], [-10 * s, -40 * s]),
    bez(-50 * s, -10 * s, [-50 * s, -40 * s], [-50 * s, 20 * s]),
    bez(0, 50 * s, [-20 * s, 35 * s], [20 * s, 35 * s]),
    bez(50 * s, -10 * s, [50 * s, 20 * s], [50 * s, -40 * s]),
  ])
}

/** Lips (upper + lower) as two closed paths in a 100×60 box centered at the origin. */
export const lipPaths = (scale = 1) => {
  const s = scale
  const upper = path([
    { x: -50 * s, y: 0 },
    bez(-30 * s, -14 * s, [-42 * s, -8 * s], [-18 * s, -20 * s]),
    bez(0, -8 * s, [-8 * s, -14 * s], [8 * s, -14 * s]),
    bez(30 * s, -14 * s, [18 * s, -20 * s], [42 * s, -8 * s]),
    { x: 50 * s, y: 0 },
  ])
  const lower = path([
    { x: -50 * s, y: 2 * s },
    bez(0, 30 * s, [-32 * s, 30 * s], [32 * s, 30 * s]),
    { x: 50 * s, y: 2 * s },
  ])
  return { upper, lower }
}

/** Four-point sparkle. */
export const sparkle = (id: string, x: number, y: number, size: number, paint: Paint): SceneNode =>
  shape(id, { x, y }, star(size, size, 4, 0.28), paint)

export const dot = (id: string, x: number, y: number, size: number, paint: Paint): SceneNode =>
  shape(id, { x, y }, ellipse(size), paint)

export const solidOf = (color: number): Paint => solid(color)

/** 0..n-1 */
export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)
