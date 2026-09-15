import { group, image, type GroupNode, type ImageAsset, type Transform } from '../writer/scene'
import type { TimelineBuilder } from '../writer/timeline'

/**
 * Turntable frames stacked as image nodes. `play` cross-fades neighbours (linear opacity) so a
 * 24-frame turn reads smoothly even at 7–8 frames/s, instead of a hard 24 fps flip.
 */
export const flipbook = (
  id: string,
  frames: readonly ImageAsset[],
  transform: Transform,
  width: number,
): GroupNode =>
  group(
    id,
    transform,
    frames.map((asset, i) => image(`${id}_${i}`, { opacity: i === 0 ? 1 : 0 }, asset, width)),
  )

export type FlipbookPlay = {
  readonly start: number
  readonly end: number
  /** Full turns between start and end. */
  readonly turns?: number
  /** Frame shown before `start` and after `end`. */
  readonly restFrame?: number
}

export const playFlipbook = (
  t: TimelineBuilder,
  id: string,
  frameCount: number,
  { start, end, turns = 1, restFrame = 0 }: FlipbookPlay,
): TimelineBuilder => {
  const steps = frameCount * turns
  const dt = (end - start) / steps
  for (let i = 0; i < frameCount; i++) {
    const keys: Array<readonly [number, number, 'linear' | 'hold']> = []
    const rest = i === restFrame ? 1 : 0
    keys.push([0, rest, 'hold'])
    if (start > 0) keys.push([Math.max(0, start - dt), rest, 'linear'])
    for (let s = 0; s <= steps; s++) {
      if (s % frameCount !== i) continue
      const at = start + s * dt
      if (at - dt > start - dt) keys.push([Math.max(start, at - dt), 0, 'linear'])
      keys.push([at, 1, 'linear'])
      if (at + dt <= end) keys.push([at + dt, 0, 'linear'])
    }
    keys.push([end, i === restFrame ? 1 : 0, 'hold'])
    // dedupe by time, keep the last value written for that instant
    const byTime = new Map<number, (typeof keys)[number]>()
    for (const k of keys) byTime.set(Math.round(k[0] * 1000) / 1000, k)
    t.keys(
      `${id}_${i}`,
      'opacity',
      [...byTime.values()].toSorted((a, b) => a[0] - b[0]),
    )
  }
  return t
}
