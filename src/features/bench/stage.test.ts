import type { GiftId } from '@rive/catalog'
import { describe, expect, it } from 'vitest'
import {
  fullFrameActive,
  initialStage,
  slotKey,
  stageActive,
  stageDropped,
  stageReducer,
  stageWaiting,
  type StageConfig,
  type StageState,
} from './stage'

const CONFIG: StageConfig = {
  policy: 'per-lane',
  overlap: 1,
  gapMs: 0,
  overflow: 'queue',
  queueMax: 5,
}

const send = (state: StageState, giftId: GiftId, now = 0) =>
  stageReducer(state, { type: 'send', giftId, sender: 'さくら', now })

describe('stage', () => {
  it('per-lane: one effect per lane plays, the rest of that lane waits', () => {
    let s = initialStage(CONFIG)
    s = send(s, 'candy', 0)
    s = send(s, 'ring', 1)
    s = send(s, 'myth', 2)
    s = send(s, 'palace', 3)
    expect(stageActive(s)).toBe(3)
    expect(stageWaiting(s)).toBe(1)
    expect(s.lanes.full?.slots[0]?.giftId).toBe('myth')
    expect(s.lanes.full?.waiting[0]?.giftId).toBe('palace')
    expect(fullFrameActive(s)).toBe(true)
    // the pooled instance for (full, slot 0, myth) is remembered for replays
    expect(s.seen[slotKey('full', 0)]).toEqual(['myth'])
  })

  it('overlap lets several effects stack in one lane', () => {
    let s = initialStage({ ...CONFIG, overlap: 3 })
    for (let i = 0; i < 5; i++) s = send(s, 'myth', i)
    expect(s.lanes.full?.slots.filter(Boolean)).toHaveLength(3)
    expect(s.lanes.full?.waiting).toHaveLength(2)
    s = stageReducer(s, { type: 'finished', lane: 'full', slot: 1, seq: 2, now: 100 })
    expect(s.lanes.full?.slots[1]?.seq).toBe(4)
  })

  it('strict serialises every T2+ gift through one queue', () => {
    let s = initialStage({ ...CONFIG, policy: 'strict' })
    s = send(s, 'candy', 0)
    s = send(s, 'myth', 1)
    expect(stageActive(s)).toBe(1)
    expect(s.lanes.stage?.waiting[0]?.giftId).toBe('myth')
    expect(s.lanes.full).toBeUndefined()
  })

  it('T1 gifts never enter a lane and collapse into a combo row', () => {
    let s = initialStage(CONFIG)
    s = send(s, 'heart', 0)
    s = send(s, 'heart', 1000)
    s = send(s, 'heart', 5000)
    expect(Object.keys(s.lanes)).toHaveLength(0)
    expect(s.chat.map(r => r.count)).toEqual([2, 1])
    expect(s.sent).toBe(3)
  })

  it('drop-oldest keeps the newest waiting gifts and counts the rest', () => {
    let s = initialStage({ ...CONFIG, overflow: 'drop-oldest', queueMax: 2 })
    for (let i = 0; i < 6; i++) s = send(s, 'diamond', i)
    expect(s.lanes.full?.waiting.map(j => j.seq)).toEqual([5, 6])
    expect(stageDropped(s)).toBe(3)
  })

  it('switching policy re-routes what is playing and waiting, in send order', () => {
    let s = initialStage(CONFIG)
    s = send(s, 'candy', 0)
    s = send(s, 'myth', 1)
    s = stageReducer(s, { type: 'setConfig', config: { policy: 'strict' }, now: 2 })
    expect(s.lanes.stage?.slots[0]?.giftId).toBe('candy')
    expect(s.lanes.stage?.waiting[0]?.giftId).toBe('myth')
    expect(s.lanes.center).toBeUndefined()
  })

  it('tick returns the same state when nothing can start', () => {
    let s = initialStage({ ...CONFIG, gapMs: 500 })
    s = send(s, 'candy', 0)
    const ticked = stageReducer(s, { type: 'tick', now: 100 })
    expect(ticked).toBe(s)
  })
})
