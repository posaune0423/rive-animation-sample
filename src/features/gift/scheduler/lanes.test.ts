import { giftById } from '@rive/catalog'
import { describe, expect, it } from 'vitest'
import type { GiftEvent, GiftId, Sender } from '../types'
import {
  activeCount,
  initialScheduler,
  MAX_CHAT_ROWS,
  schedulerReducer,
  waitingCount,
  type SchedulerAction,
  type SchedulerState,
} from './lanes'

const alice: Sender = { id: 'a', name: 'alice' }
const bob: Sender = { id: 'b', name: 'bob' }

let seq = 0
const send = (giftId: GiftId, at: number, sender: Sender = alice): SchedulerAction => {
  const gift = giftById(giftId)
  const event: GiftEvent = { seq: ++seq, giftId, tier: gift.tier, lane: gift.lane, sender, at }
  return { type: 'send', event }
}

const run = (state: SchedulerState, actions: SchedulerAction[]): SchedulerState =>
  actions.reduce(schedulerReducer, state)

describe('scheduler: per-lane policy', () => {
  it('plays one effect per lane and queues the rest FIFO', () => {
    const s = run(initialScheduler('per-lane', 5), [
      send('candy', 0),
      send('sparkling', 10),
      send('bouquet', 20),
      send('diamond', 30),
      send('suite', 40),
    ])
    expect(s.lanes.chatTop?.active?.giftId).toBe('candy')
    expect(s.lanes.chatTop?.waiting.map(w => w.giftId)).toEqual(['sparkling'])
    expect(s.lanes.center?.active?.giftId).toBe('bouquet')
    expect(s.lanes.full?.active?.giftId).toBe('diamond')
    expect(s.lanes.full?.waiting.map(w => w.giftId)).toEqual(['suite'])
    expect(activeCount(s)).toBe(3)
    expect(waitingCount(s)).toBe(2)
  })

  it('advances a lane only when the active seq finishes', () => {
    let s = run(initialScheduler('per-lane', 5), [send('candy', 0), send('plush', 10)])
    const active = s.lanes.chatTop?.active
    s = schedulerReducer(s, { type: 'finished', lane: 'chatTop', seq: 999, now: 100 })
    expect(s.lanes.chatTop?.active?.seq).toBe(active?.seq)
    s = schedulerReducer(s, {
      type: 'finished',
      lane: 'chatTop',
      seq: active?.seq ?? -1,
      now: 3000,
    })
    expect(s.lanes.chatTop?.active?.giftId).toBe('plush')
    expect(s.lanes.chatTop?.active?.startedAt).toBe(3000)
    expect(s.lanes.chatTop?.waiting).toEqual([])
  })

  it('puts T5 ahead of waiting T4 and never drops either', () => {
    const s = run(initialScheduler('per-lane', 5), [
      send('diamond', 0),
      send('suite', 1),
      send('diamond', 2),
      send('myth', 3),
      send('palace', 4),
    ])
    expect(s.lanes.full?.waiting.map(w => w.giftId)).toEqual(['myth', 'palace', 'suite', 'diamond'])
  })

  it('drops the oldest waiting T2 beyond the limit and counts it', () => {
    const s = run(initialScheduler('per-lane', 2), [
      send('candy', 0),
      send('sparkling', 1),
      send('plush', 2),
      send('candy', 3),
    ])
    expect(s.lanes.chatTop?.waiting.map(w => w.giftId)).toEqual(['plush', 'candy'])
    expect(s.droppedT2).toBe(1)
    expect(s.chat.filter(r => r.kind === 'gift')).toHaveLength(4)
  })
})

describe('scheduler: strict policy', () => {
  it('serializes T2–T5 into one queue', () => {
    const s = run(initialScheduler('strict', 5), [
      send('candy', 0),
      send('bouquet', 1),
      send('diamond', 2),
    ])
    expect(s.lanes.stage?.active?.giftId).toBe('candy')
    expect(s.lanes.stage?.waiting.map(w => w.giftId)).toEqual(['bouquet', 'diamond'])
    expect(s.lanes.center).toBeUndefined()
  })

  it('re-buckets queued effects when the policy changes', () => {
    let s = run(initialScheduler('per-lane', 5), [
      send('candy', 0),
      send('bouquet', 1),
      send('diamond', 2),
    ])
    expect(activeCount(s)).toBe(3)
    s = schedulerReducer(s, { type: 'setPolicy', policy: 'strict', now: 50 })
    expect(activeCount(s)).toBe(1)
    expect(s.lanes.stage?.waiting).toHaveLength(2)
    s = schedulerReducer(s, { type: 'setPolicy', policy: 'per-lane', now: 60 })
    expect(activeCount(s)).toBe(3)
  })
})

describe('scheduler: T1, chat and pins', () => {
  it('collapses rapid T1 from the same sender into ×n and never enters a lane', () => {
    const s = run(initialScheduler('per-lane', 5), [
      send('heart', 0),
      send('heart', 500),
      send('heart', 2900),
      send('heart', 6500),
      send('heart', 6600, bob),
    ])
    const gifts = s.chat.filter(r => r.kind === 'gift')
    expect(gifts.map(r => (r.kind === 'gift' ? r.count : 0))).toEqual([3, 1, 1])
    expect(s.lanes).toEqual({})
    expect(s.sent).toBe(5)
  })

  it('pins T3+ senders for the tier duration, highest tier first, max 3', () => {
    let s = run(initialScheduler('per-lane', 5), [
      send('candy', 0),
      send('bouquet', 0),
      send('diamond', 1),
      send('myth', 2),
      send('perfume', 3),
    ])
    expect(s.pins.map(p => p.giftId)).toEqual(['myth', 'diamond', 'perfume'])
    expect(s.pins.map(p => p.until)).toEqual([2 + 60_000, 1 + 30_000, 3 + 10_000])
    s = schedulerReducer(s, { type: 'tick', now: 10_004 })
    expect(s.pins.map(p => p.giftId)).toEqual(['myth', 'diamond'])
  })

  it('keeps only the newest rows', () => {
    const actions: SchedulerAction[] = Array.from({ length: MAX_CHAT_ROWS + 10 }, (_, i) => ({
      type: 'comment',
      sender: bob,
      text: `hi ${i}`,
      at: i,
    }))
    const s = run(initialScheduler('per-lane', 5), actions)
    expect(s.chat).toHaveLength(MAX_CHAT_ROWS)
    expect(s.chat.at(-1)).toMatchObject({ text: `hi ${MAX_CHAT_ROWS + 9}` })
  })
})
