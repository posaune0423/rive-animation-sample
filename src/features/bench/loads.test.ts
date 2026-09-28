import { giftById } from '@rive/catalog'
import { describe, expect, it } from 'vitest'
import { giftBurst, LOADS, loadStageConfig, onScreen } from './loads'
import { initialStage, stageActive, stageReducer } from './stage'

describe('load levels', () => {
  // T2 effects last 3 s, so before then nothing has finished and the stage only fills up.
  const BEFORE_FIRST_FINISH_MS = 2_900

  it.each(LOADS)('$label puts exactly $overlap effect(s) per lane on screen', load => {
    let s = initialStage(loadStageConfig(load))
    const gifts = giftBurst(load.perSecond, load.seconds)
    gifts.forEach((giftId, i) => {
      const now = (i * 1000) / load.perSecond
      if (now < BEFORE_FIRST_FINISH_MS)
        s = stageReducer(s, { type: 'send', giftId, sender: 'さくら', now })
    })
    expect(stageActive(s)).toBe(onScreen(load))
  })

  it('sends the same gifts in the same order every time, so engines see an identical load', () => {
    const burst = giftBurst(20, 3)
    expect(burst).toHaveLength(60)
    expect(giftBurst(20, 3)).toEqual(burst)
    // only gifts that draw an effect: T1 would be a chat row, not load on the renderer
    expect(burst.every(id => giftById(id).tier >= 2)).toBe(true)
  })
})
