import { describe, expect, it } from 'vitest'
import { shouldDeliver } from './frameCap'

/** Frames the page would see from a display ticking every `vsyncMs`, capped at `capHz`. */
const delivered = (vsyncMs: number, capHz: number | null, ticks = 120): number => {
  let last = Number.NEGATIVE_INFINITY
  let count = 0
  for (let i = 1; i <= ticks; i++) {
    const t = i * vsyncMs
    if (shouldDeliver(t, last, capHz)) {
      last = t
      count++
    }
  }
  return count
}

describe('frame cap', () => {
  it('a 120 Hz display delivers 60 frames a second under a 60 Hz cap, like iOS Safari', () => {
    expect(delivered(1000 / 120, 60)).toBe(60)
  })

  it('a 60 Hz display is untouched by a 60 Hz cap, even with timestamp jitter', () => {
    let last = Number.NEGATIVE_INFINITY
    let count = 0
    for (let i = 1; i <= 60; i++) {
      const t = i * (1000 / 60) + (i % 2 ? 0.4 : -0.4)
      if (shouldDeliver(t, last, 60)) {
        last = t
        count++
      }
    }
    expect(count).toBe(60)
  })

  it('without a cap every display frame is delivered', () => {
    expect(delivered(1000 / 120, null)).toBe(120)
  })
})
