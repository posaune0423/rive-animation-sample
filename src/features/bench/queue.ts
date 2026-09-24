import type { GiftId } from '@rive/catalog'

export type OverflowPolicy = 'queue' | 'drop-oldest' | 'drop-newest'

export type BenchQueueConfig = {
  /** Number of slots that can play at once (grid size). >= 1 */
  readonly maxConcurrent: number
  /** ms to wait after ANY slot finishes before the next waiting job may start. >= 0 */
  readonly gapMs: number
  readonly overflow: OverflowPolicy
  /** Max waiting jobs for the drop policies; ignored for 'queue'. >= 0 */
  readonly queueMax: number
}

export type BenchJob = {
  readonly seq: number
  readonly giftId: GiftId
  readonly enqueuedAt: number
}

export type PlayingJob = BenchJob & { readonly startedAt: number }

export type BenchQueueState = {
  readonly config: BenchQueueConfig
  /** length === config.maxConcurrent; null = free slot */
  readonly slots: readonly (PlayingJob | null)[]
  readonly waiting: readonly BenchJob[]
  /** No waiting job may start before this timestamp; null = no cooldown. */
  readonly nextStartAt: number | null
  readonly nextSeq: number
  readonly enqueued: number
  readonly started: number
  readonly finished: number
  readonly dropped: number
  /** ms between enqueue and start, most recent last. */
  readonly waitTimesMs: readonly number[]
}

export type BenchQueueAction =
  | { readonly type: 'enqueue'; readonly gifts: readonly GiftId[]; readonly now: number }
  | {
      readonly type: 'finished'
      readonly slot: number
      readonly seq: number
      readonly now: number
    }
  | { readonly type: 'tick'; readonly now: number }
  | {
      readonly type: 'setConfig'
      readonly config: Partial<BenchQueueConfig>
      readonly now: number
    }
  | { readonly type: 'reset' }

export const MAX_WAIT_SAMPLES = 200

export const initialBenchQueue = (config: BenchQueueConfig): BenchQueueState => ({
  config,
  slots: Array.from({ length: config.maxConcurrent }, () => null),
  waiting: [],
  nextStartAt: null,
  nextSeq: 1,
  enqueued: 0,
  started: 0,
  finished: 0,
  dropped: 0,
  waitTimesMs: [],
})

/** Move waiting jobs into free slots, oldest job into the lowest-index slot. */
const fill = (state: BenchQueueState, now: number): BenchQueueState => {
  if (state.nextStartAt !== null && now < state.nextStartAt) return state
  const slots = [...state.slots]
  const waiting = [...state.waiting]
  const waitTimesMs = [...state.waitTimesMs]
  let started = state.started
  for (let i = 0; i < slots.length && waiting.length > 0; i++) {
    if (slots[i] !== null) continue
    const job = waiting.shift()
    if (!job) break
    slots[i] = { ...job, startedAt: now }
    waitTimesMs.push(now - job.enqueuedAt)
    started++
  }
  if (started === state.started) return state
  return {
    ...state,
    slots,
    waiting,
    started,
    waitTimesMs: waitTimesMs.slice(-MAX_WAIT_SAMPLES),
  }
}

/** Trim the waiting list down to `queueMax` under the drop policies. */
const applyOverflow = (state: BenchQueueState): BenchQueueState => {
  const { overflow, queueMax } = state.config
  if (overflow === 'queue' || state.waiting.length <= queueMax) return state
  const dropped = state.waiting.length - queueMax
  return {
    ...state,
    waiting:
      overflow === 'drop-oldest' ? state.waiting.slice(dropped) : state.waiting.slice(0, queueMax),
    dropped: state.dropped + dropped,
  }
}

const settle = (state: BenchQueueState, now: number): BenchQueueState =>
  applyOverflow(fill(state, now))

const resize = (state: BenchQueueState, config: BenchQueueConfig): BenchQueueState => {
  const kept = state.slots.slice(0, config.maxConcurrent)
  const evicted = state.slots
    .slice(config.maxConcurrent)
    .flatMap(s => (s ? [{ seq: s.seq, giftId: s.giftId, enqueuedAt: s.enqueuedAt }] : []))
  return {
    ...state,
    config,
    slots: [
      ...kept,
      ...Array.from({ length: Math.max(0, config.maxConcurrent - kept.length) }, () => null),
    ],
    waiting: [...evicted, ...state.waiting],
  }
}

export const benchQueueReducer = (
  state: BenchQueueState,
  action: BenchQueueAction,
): BenchQueueState => {
  switch (action.type) {
    case 'enqueue': {
      const jobs = action.gifts.map((giftId, i) => ({
        seq: state.nextSeq + i,
        giftId,
        enqueuedAt: action.now,
      }))
      return settle(
        {
          ...state,
          waiting: [...state.waiting, ...jobs],
          nextSeq: state.nextSeq + jobs.length,
          enqueued: state.enqueued + jobs.length,
        },
        action.now,
      )
    }
    case 'finished': {
      const playing = state.slots[action.slot]
      if (!playing || playing.seq !== action.seq) return state
      return fill(
        {
          ...state,
          slots: state.slots.map((s, i) => (i === action.slot ? null : s)),
          finished: state.finished + 1,
          nextStartAt: state.config.gapMs > 0 ? action.now + state.config.gapMs : null,
        },
        action.now,
      )
    }
    case 'tick': {
      const cooled = state.nextStartAt !== null && action.now >= state.nextStartAt
      return fill(cooled ? { ...state, nextStartAt: null } : state, action.now)
    }
    case 'setConfig':
      return settle(resize(state, { ...state.config, ...action.config }), action.now)
    case 'reset':
      return initialBenchQueue(state.config)
  }
}
