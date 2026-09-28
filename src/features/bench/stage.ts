import { giftById, type GiftId, type Tier } from '@rive/catalog'
import type { LaneKey, QueuePolicy } from '../gift/types'
import {
  benchQueueReducer,
  initialBenchQueue,
  type BenchQueueConfig,
  type BenchQueueState,
  type OverflowPolicy,
  type PlayingJob,
} from './queue'

/**
 * The live-stream stage for /perf: the production lanes (chatTop / center / full, or one strict
 * queue) with a configurable number of effects allowed to overlap per lane. Each lane is a bench
 * queue; this reducer routes gifts to lanes, keeps the chat rows and remembers which
 * (lane, slot, gift) combinations have been used so their pooled instances stay mounted.
 */
export type StageConfig = {
  readonly policy: QueuePolicy
  /** Effects allowed to play at once in one lane (1 = production behaviour). */
  readonly overlap: number
  readonly gapMs: number
  readonly overflow: OverflowPolicy
  readonly queueMax: number
}

export type StageChatRow = {
  readonly key: string
  readonly sender: string
  readonly giftId: GiftId
  readonly tier: Tier
  readonly count: number
  readonly at: number
}

export type StageState = {
  readonly config: StageConfig
  readonly lanes: Readonly<Partial<Record<LaneKey, BenchQueueState>>>
  /** `${laneKey}:${slot}` → gifts that have played there (one pooled instance each). */
  readonly seen: Readonly<Record<string, readonly GiftId[]>>
  readonly chat: readonly StageChatRow[]
  readonly sent: number
}

export type StageAction =
  | {
      readonly type: 'send'
      readonly giftId: GiftId
      readonly sender: string
      readonly now: number
    }
  | {
      readonly type: 'finished'
      readonly lane: LaneKey
      readonly slot: number
      readonly seq: number
      readonly now: number
    }
  | { readonly type: 'tick'; readonly now: number }
  | { readonly type: 'setConfig'; readonly config: Partial<StageConfig>; readonly now: number }
  | { readonly type: 'reset' }

export const MAX_CHAT_ROWS = 40
export const T1_COMBO_WINDOW_MS = 3_000

export const initialStage = (config: StageConfig): StageState => ({
  config,
  lanes: {},
  seen: {},
  chat: [],
  sent: 0,
})

export const slotKey = (lane: LaneKey, slot: number): string => `${lane}:${slot}`

export const laneKeyFor = (giftId: GiftId, policy: QueuePolicy): LaneKey => {
  const lane = giftById(giftId).lane
  if (lane === 'chat') throw new Error('T1 never enters a lane')
  return policy === 'strict' ? 'stage' : lane
}

const queueConfig = (config: StageConfig): BenchQueueConfig => ({
  maxConcurrent: config.overlap,
  gapMs: config.gapMs,
  overflow: config.overflow,
  queueMax: config.queueMax,
})

/** Record every (lane, slot, gift) that is playing so its instance is kept for replays. */
const remember = (seen: StageState['seen'], lanes: StageState['lanes']): StageState['seen'] => {
  let next: Record<string, readonly GiftId[]> | null = null
  for (const [lane, queue] of Object.entries(lanes) as [LaneKey, BenchQueueState][]) {
    queue.slots.forEach((job, slot) => {
      if (!job) return
      const key = slotKey(lane, slot)
      const gifts = (next ?? seen)[key] ?? []
      if (gifts.includes(job.giftId)) return
      next ??= { ...seen }
      next[key] = [...gifts, job.giftId]
    })
  }
  return next ?? seen
}

const pushChat = (
  chat: readonly StageChatRow[],
  action: Extract<StageAction, { type: 'send' }>,
  seq: number,
): readonly StageChatRow[] => {
  const { tier } = giftById(action.giftId)
  const last = chat.at(-1)
  if (
    tier === 1 &&
    last &&
    last.giftId === action.giftId &&
    last.sender === action.sender &&
    action.now - last.at <= T1_COMBO_WINDOW_MS
  ) {
    return [...chat.slice(0, -1), { ...last, count: last.count + 1, at: action.now }]
  }
  return [
    ...chat,
    {
      key: `g${seq}`,
      sender: action.sender,
      giftId: action.giftId,
      tier,
      count: 1,
      at: action.now,
    },
  ].slice(-MAX_CHAT_ROWS)
}

const withLane = (
  state: StageState,
  lane: LaneKey,
  update: (queue: BenchQueueState) => BenchQueueState,
): StageState => {
  const queue = state.lanes[lane] ?? initialBenchQueue(queueConfig(state.config))
  const next = update(queue)
  if (next === state.lanes[lane]) return state
  const lanes = { ...state.lanes, [lane]: next }
  return { ...state, lanes, seen: remember(state.seen, lanes) }
}

export const stageReducer = (state: StageState, action: StageAction): StageState => {
  switch (action.type) {
    case 'send': {
      const seq = state.sent + 1
      const base = { ...state, sent: seq, chat: pushChat(state.chat, action, seq) }
      if (giftById(action.giftId).tier === 1) return base
      const lane = laneKeyFor(action.giftId, state.config.policy)
      return withLane(base, lane, q =>
        benchQueueReducer(q, { type: 'enqueue', gifts: [action.giftId], now: action.now }),
      )
    }
    case 'finished':
      return withLane(state, action.lane, q =>
        benchQueueReducer(q, {
          type: 'finished',
          slot: action.slot,
          seq: action.seq,
          now: action.now,
        }),
      )
    case 'tick': {
      let next = state
      for (const lane of Object.keys(state.lanes) as LaneKey[]) {
        next = withLane(next, lane, q => benchQueueReducer(q, { type: 'tick', now: action.now }))
      }
      return next
    }
    case 'setConfig': {
      const config = { ...state.config, ...action.config }
      if (config.policy !== state.config.policy) {
        // Re-route everything that is playing or waiting through the new lane set, in send order.
        const queued = Object.values(state.lanes)
          .flatMap(q =>
            q ? [...q.slots.filter((s): s is PlayingJob => s !== null), ...q.waiting] : [],
          )
          .toSorted((a, b) => a.enqueuedAt - b.enqueuedAt)
        let next: StageState = { ...state, config, lanes: {} }
        for (const job of queued) {
          const lane = laneKeyFor(job.giftId, config.policy)
          next = withLane(next, lane, q =>
            benchQueueReducer(q, { type: 'enqueue', gifts: [job.giftId], now: action.now }),
          )
        }
        return next
      }
      let next: StageState = { ...state, config }
      for (const lane of Object.keys(state.lanes) as LaneKey[]) {
        next = withLane(next, lane, q =>
          benchQueueReducer(q, { type: 'setConfig', config: queueConfig(config), now: action.now }),
        )
      }
      return next
    }
    case 'reset':
      return initialStage(state.config)
  }
}

export const stageActive = (state: StageState): number =>
  Object.values(state.lanes).reduce((n, q) => n + (q?.slots.filter(Boolean).length ?? 0), 0)

export const stageWaiting = (state: StageState): number =>
  Object.values(state.lanes).reduce((n, q) => n + (q?.waiting.length ?? 0), 0)

export const stageDropped = (state: StageState): number =>
  Object.values(state.lanes).reduce((n, q) => n + (q?.dropped ?? 0), 0)

export const stageWaitTimes = (state: StageState): number[] =>
  Object.values(state.lanes).flatMap(q => q?.waitTimesMs ?? [])

/** Is a full-frame effect playing? The chat log steps aside for it, as in production. */
export const fullFrameActive = (state: StageState): boolean =>
  Object.values(state.lanes).some(q =>
    q?.slots.some(job => job && giftById(job.giftId).lane === 'full'),
  )
