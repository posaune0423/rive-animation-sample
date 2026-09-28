import { describe, expect, it } from 'vitest'
import type { GiftId } from '@rive/catalog'
import {
  benchQueueReducer,
  initialBenchQueue,
  type BenchQueueAction,
  type BenchQueueConfig,
  type BenchQueueState,
} from './queue'

const gifts = (n: number): GiftId[] => Array.from({ length: n }, () => 'candy' as const)

const config = (over: Partial<BenchQueueConfig> = {}): BenchQueueConfig => ({
  maxConcurrent: 3,
  gapMs: 0,
  overflow: 'queue',
  queueMax: 0,
  ...over,
})

const run = (state: BenchQueueState, actions: BenchQueueAction[]): BenchQueueState =>
  actions.reduce(benchQueueReducer, state)

const slotSeqs = (state: BenchQueueState): (number | null)[] => state.slots.map(s => s?.seq ?? null)

const waitingSeqs = (state: BenchQueueState): number[] => state.waiting.map(w => w.seq)

describe('bench queue: concurrency', () => {
  it('fills every slot in order and queues the rest', () => {
    const s = benchQueueReducer(initialBenchQueue(config()), {
      type: 'enqueue',
      gifts: gifts(5),
      now: 0,
    })
    expect(slotSeqs(s)).toEqual([1, 2, 3])
    expect(waitingSeqs(s)).toEqual([4, 5])
    expect(s.started).toBe(3)
  })

  it('starts the next waiting job in the freed slot when there is no gap', () => {
    let s = benchQueueReducer(initialBenchQueue(config()), {
      type: 'enqueue',
      gifts: gifts(5),
      now: 0,
    })
    s = benchQueueReducer(s, { type: 'finished', slot: 1, seq: 2, now: 100 })
    expect(slotSeqs(s)).toEqual([1, 4, 3])
    expect(s.slots[1]?.startedAt).toBe(100)
    expect(waitingSeqs(s)).toEqual([5])
    expect(s.finished).toBe(1)
    expect(s.started).toBe(4)
  })

  it('ignores a finished event for a slot that no longer plays that job', () => {
    const s = benchQueueReducer(initialBenchQueue(config()), {
      type: 'enqueue',
      gifts: gifts(5),
      now: 0,
    })
    expect(benchQueueReducer(s, { type: 'finished', slot: 0, seq: 99, now: 100 })).toBe(s)
  })
})

describe('bench queue: gap after a finish', () => {
  it('keeps the freed slot empty until the gap has elapsed', () => {
    let s = run(initialBenchQueue(config({ gapMs: 500 })), [
      { type: 'enqueue', gifts: gifts(5), now: 0 },
      { type: 'finished', slot: 0, seq: 1, now: 1000 },
    ])
    expect(s.slots[0]).toBeNull()
    expect(s.nextStartAt).toBe(1500)

    s = benchQueueReducer(s, { type: 'tick', now: 1400 })
    expect(s.slots[0]).toBeNull()

    s = benchQueueReducer(s, { type: 'tick', now: 1500 })
    expect(s.slots[0]?.seq).toBe(4)
    expect(s.slots[0]?.startedAt).toBe(1500)
    expect(s.nextStartAt).toBeNull()
    expect(s.waitTimesMs.at(-1)).toBe(1500 - (s.slots[0]?.enqueuedAt ?? 0))
  })

  it('returns the same state when a tick changes nothing', () => {
    const s = run(initialBenchQueue(config({ gapMs: 500 })), [
      { type: 'enqueue', gifts: gifts(5), now: 0 },
      { type: 'finished', slot: 0, seq: 1, now: 1000 },
    ])
    expect(benchQueueReducer(s, { type: 'tick', now: 1400 })).toBe(s)
  })
})

describe('bench queue: overflow policies', () => {
  const burst = (overflow: BenchQueueConfig['overflow']): BenchQueueState =>
    benchQueueReducer(initialBenchQueue(config({ maxConcurrent: 1, overflow, queueMax: 5 })), {
      type: 'enqueue',
      gifts: gifts(20),
      now: 0,
    })

  it('drop-oldest keeps the newest waiting jobs', () => {
    const s = burst('drop-oldest')
    expect(slotSeqs(s)).toEqual([1])
    expect(waitingSeqs(s)).toEqual([16, 17, 18, 19, 20])
    expect(s.dropped).toBe(14)
  })

  it('drop-newest keeps the oldest waiting jobs', () => {
    const s = burst('drop-newest')
    expect(slotSeqs(s)).toEqual([1])
    expect(waitingSeqs(s)).toEqual([2, 3, 4, 5, 6])
    expect(s.dropped).toBe(14)
  })

  it('queue never drops', () => {
    const s = burst('queue')
    expect(s.waiting).toHaveLength(19)
    expect(s.dropped).toBe(0)
    expect(s.enqueued).toBe(20)
  })
})

describe('bench queue: config changes', () => {
  it('re-queues the jobs of removed slots in front when shrinking', () => {
    let s = benchQueueReducer(initialBenchQueue(config()), {
      type: 'enqueue',
      gifts: gifts(5),
      now: 0,
    })
    s = benchQueueReducer(s, {
      type: 'setConfig',
      config: { maxConcurrent: 1 },
      now: 100,
    })
    expect(slotSeqs(s)).toEqual([1])
    expect(waitingSeqs(s)).toEqual([2, 3, 4, 5])

    s = benchQueueReducer(s, {
      type: 'setConfig',
      config: { maxConcurrent: 3 },
      now: 200,
    })
    expect(slotSeqs(s)).toEqual([1, 2, 3])
    expect(waitingSeqs(s)).toEqual([4, 5])
    expect(s.slots[1]?.startedAt).toBe(200)
  })
})

describe('bench queue: reset', () => {
  it('clears every counter but keeps the config', () => {
    const cfg = config({ maxConcurrent: 2, gapMs: 300 })
    const s = benchQueueReducer(
      run(initialBenchQueue(cfg), [
        { type: 'enqueue', gifts: gifts(4), now: 0 },
        { type: 'finished', slot: 0, seq: 1, now: 10 },
      ]),
      { type: 'reset' },
    )
    expect(s).toEqual(initialBenchQueue(cfg))
    expect(s.config).toEqual(cfg)
    expect(s.enqueued).toBe(0)
    expect(s.dropped).toBe(0)
    expect(s.waitTimesMs).toEqual([])
    expect(s.slots).toEqual([null, null])
  })
})
