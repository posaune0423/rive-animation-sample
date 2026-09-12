import { giftById } from '@rive/catalog'
import type {
  ChatRow,
  GiftEvent,
  GiftId,
  LaneKey,
  LaneState,
  PinnedSender,
  QueuePolicy,
  Sender,
} from '../types'

export type SchedulerState = {
  readonly policy: QueuePolicy
  readonly t2QueueMax: number
  readonly lanes: Readonly<Partial<Record<LaneKey, LaneState>>>
  readonly pins: readonly PinnedSender[]
  readonly chat: readonly ChatRow[]
  readonly sent: number
  readonly droppedT2: number
}

export type SchedulerAction =
  | { readonly type: 'send'; readonly event: GiftEvent }
  | {
      readonly type: 'finished'
      readonly lane: LaneKey
      readonly seq: number
      readonly now: number
    }
  | {
      readonly type: 'comment'
      readonly sender: Sender
      readonly text: string
      readonly at: number
    }
  | { readonly type: 'tick'; readonly now: number }
  | { readonly type: 'setPolicy'; readonly policy: QueuePolicy; readonly now: number }
  | { readonly type: 'purge' }

export const MAX_CHAT_ROWS = 40
export const MAX_PINS = 3
/** Same sender + same T1 gift inside this window collapses into `×n`. */
export const T1_COMBO_WINDOW_MS = 3_000

const EMPTY_LANE: LaneState = { active: null, waiting: [] }

export const initialScheduler = (policy: QueuePolicy, t2QueueMax: number): SchedulerState => ({
  policy,
  t2QueueMax,
  lanes: {},
  pins: [],
  chat: [],
  sent: 0,
  droppedT2: 0,
})

/** Which concurrency bucket an event goes to. */
export const laneKeyFor = (event: Pick<GiftEvent, 'lane'>, policy: QueuePolicy): LaneKey => {
  if (event.lane === 'chat') throw new Error('T1 never enters a lane')
  return policy === 'strict' ? 'stage' : event.lane
}

/** T5 goes in front of anything cheaper that is still waiting; otherwise FIFO. */
const insertWaiting = (waiting: readonly GiftEvent[], event: GiftEvent): GiftEvent[] => {
  if (event.tier < 5) return [...waiting, event]
  const idx = waiting.findIndex(w => w.tier < 5)
  return idx === -1 ? [...waiting, event] : [...waiting.slice(0, idx), event, ...waiting.slice(idx)]
}

const enqueue = (
  lanes: SchedulerState['lanes'],
  key: LaneKey,
  event: GiftEvent,
  t2QueueMax: number,
): { lanes: SchedulerState['lanes']; dropped: number } => {
  const lane = lanes[key] ?? EMPTY_LANE
  if (lane.active === null) {
    return {
      lanes: { ...lanes, [key]: { active: { ...event, startedAt: event.at }, waiting: [] } },
      dropped: 0,
    }
  }
  let waiting = insertWaiting(lane.waiting, event)
  let dropped = 0
  while (waiting.filter(w => w.tier === 2).length > t2QueueMax) {
    const oldest = waiting.findIndex(w => w.tier === 2)
    waiting = waiting.filter((_, i) => i !== oldest)
    dropped++
  }
  return { lanes: { ...lanes, [key]: { active: lane.active, waiting } }, dropped }
}

const pushPin = (pins: readonly PinnedSender[], event: GiftEvent): readonly PinnedSender[] => {
  const { pinSec } = giftById(event.giftId)
  if (pinSec === 0) return pins
  const next: PinnedSender[] = [
    ...pins,
    {
      seq: event.seq,
      giftId: event.giftId,
      tier: event.tier,
      sender: event.sender,
      until: event.at + pinSec * 1000,
    },
  ]
  return next.toSorted((a, b) => b.tier - a.tier || b.seq - a.seq).slice(0, MAX_PINS)
}

const pushChat = (chat: readonly ChatRow[], row: ChatRow): readonly ChatRow[] =>
  [...chat, row].slice(-MAX_CHAT_ROWS)

const pushGiftRow = (chat: readonly ChatRow[], event: GiftEvent): readonly ChatRow[] => {
  const last = chat.at(-1)
  if (
    event.tier === 1 &&
    last?.kind === 'gift' &&
    last.giftId === event.giftId &&
    last.sender.id === event.sender.id &&
    event.at - last.at <= T1_COMBO_WINDOW_MS
  ) {
    return [...chat.slice(0, -1), { ...last, count: last.count + 1, at: event.at }]
  }
  return pushChat(chat, {
    kind: 'gift',
    key: `g${event.seq}`,
    sender: event.sender,
    giftId: event.giftId,
    tier: event.tier,
    count: 1,
    at: event.at,
  })
}

const allQueued = (lanes: SchedulerState['lanes']): GiftEvent[] =>
  Object.values(lanes)
    .flatMap(l => (l ? [...(l.active ? [l.active] : []), ...l.waiting] : []))
    .toSorted((a, b) => a.seq - b.seq)

export const schedulerReducer = (
  state: SchedulerState,
  action: SchedulerAction,
): SchedulerState => {
  switch (action.type) {
    case 'send': {
      const { event } = action
      const chat = pushGiftRow(state.chat, event)
      const pins = pushPin(state.pins, event)
      if (event.tier === 1) return { ...state, chat, pins, sent: state.sent + 1 }
      const key = laneKeyFor(event, state.policy)
      const { lanes, dropped } = enqueue(state.lanes, key, event, state.t2QueueMax)
      return {
        ...state,
        chat,
        pins,
        lanes,
        sent: state.sent + 1,
        droppedT2: state.droppedT2 + dropped,
      }
    }
    case 'finished': {
      const lane = state.lanes[action.lane]
      if (!lane || lane.active?.seq !== action.seq) return state
      const [next, ...rest] = lane.waiting
      return {
        ...state,
        lanes: {
          ...state.lanes,
          [action.lane]: {
            active: next ? { ...next, startedAt: action.now } : null,
            waiting: rest,
          },
        },
      }
    }
    case 'comment':
      return {
        ...state,
        chat: pushChat(state.chat, {
          kind: 'comment',
          key: `c${action.at}-${action.sender.id}`,
          sender: action.sender,
          text: action.text,
          at: action.at,
        }),
      }
    case 'tick': {
      const pins = state.pins.filter(p => p.until > action.now)
      return pins.length === state.pins.length ? state : { ...state, pins }
    }
    case 'setPolicy': {
      if (action.policy === state.policy) return state
      let lanes: SchedulerState['lanes'] = {}
      let droppedT2 = state.droppedT2
      for (const event of allQueued(state.lanes)) {
        const key = laneKeyFor(event, action.policy)
        const result = enqueue(lanes, key, { ...event, at: action.now }, state.t2QueueMax)
        lanes = result.lanes
        droppedT2 += result.dropped
      }
      return { ...state, policy: action.policy, lanes, droppedT2 }
    }
    case 'purge':
      return { ...state, lanes: {}, pins: [] }
  }
}

export const activeCount = (state: SchedulerState): number =>
  Object.values(state.lanes).filter(l => l?.active).length

export const waitingCount = (state: SchedulerState): number =>
  Object.values(state.lanes).reduce((n, l) => n + (l?.waiting.length ?? 0), 0)

export const activeGiftIds = (state: SchedulerState): GiftId[] =>
  Object.values(state.lanes).flatMap(l => (l?.active ? [l.active.giftId] : []))
