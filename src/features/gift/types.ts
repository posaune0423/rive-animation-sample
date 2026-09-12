import type { GiftId, GiftLane, Tier } from '@rive/catalog'

export type Sender = { readonly id: string; readonly name: string }

/** One gift sent by a viewer. `seq` is unique and monotonic. */
export type GiftEvent = {
  readonly seq: number
  readonly giftId: GiftId
  readonly tier: Tier
  readonly lane: GiftLane
  readonly sender: Sender
  /** performance.now() based ms */
  readonly at: number
}

export type PlayingGift = GiftEvent & { readonly startedAt: number }

export type QueuePolicy = 'per-lane' | 'strict'

/** Concurrency bucket. `stage` only exists under the strict policy (T2–T5 serialized). */
export type LaneKey = 'chatTop' | 'center' | 'full' | 'stage'

export type LaneState = {
  readonly active: PlayingGift | null
  readonly waiting: readonly GiftEvent[]
}

export type PinnedSender = {
  readonly seq: number
  readonly giftId: GiftId
  readonly tier: Tier
  readonly sender: Sender
  readonly until: number
}

export type ChatRow =
  | {
      readonly kind: 'comment'
      readonly key: string
      readonly sender: Sender
      readonly text: string
      readonly at: number
    }
  | {
      readonly kind: 'gift'
      readonly key: string
      readonly sender: Sender
      readonly giftId: GiftId
      readonly tier: Tier
      readonly count: number
      readonly at: number
    }

export type { GiftId, GiftLane, Tier }
