import { TIER_DURATION_SEC, type Tier } from './contract'
import type { GiftId } from './gifts/shared'

/** Where an effect is drawn. `chat`: inline in the chat row (T1, CSS only). */
export type GiftLane = 'chat' | 'chatTop' | 'center' | 'full'

export type GiftCatalogEntry = {
  readonly id: GiftId
  readonly name: string
  readonly price: number
  readonly tier: Tier
  readonly lane: GiftLane
  readonly durationMs: number
  /** Seconds the sender's name stays pinned above the chat (0 = not pinned). */
  readonly pinSec: number
  readonly rivSrc: string | null
  readonly iconSrc: string
  /**
   * How the artboard maps onto its canvas. The artboards are authored at a fixed size but the
   * browser viewport is rarely that aspect, so the default `cover` throws away the top and bottom
   * of a full-frame artboard. Gifts whose artwork reaches an edge say so here.
   */
  readonly layout: GiftLayout
}

export type GiftLayout = {
  readonly fit: 'cover' | 'contain' | 'fill'
  readonly align: 'center' | 'bottom'
}

const LAYOUT_BY_TIER: Record<Tier, GiftLayout> = {
  1: { fit: 'contain', align: 'center' },
  2: { fit: 'contain', align: 'center' },
  3: { fit: 'contain', align: 'center' },
  4: { fit: 'cover', align: 'center' },
  5: { fit: 'cover', align: 'center' },
}

/** Gifts whose artwork runs to an edge of the artboard and must not be cropped there. */
const LAYOUT_OVERRIDE: Partial<Record<GiftId, GiftLayout>> = {
  // the window frame spans the whole artboard: stretch it onto the screen so the rail at the top
  // and the sill at the bottom both stay in view
  suite: { fit: 'fill', align: 'center' },
  // the palace stands on the bottom edge; crop the empty sky above it instead of its base
  palace: { fit: 'cover', align: 'bottom' },
}

const LANE_BY_TIER: Record<Tier, GiftLane> = {
  1: 'chat',
  2: 'chatTop',
  3: 'center',
  4: 'full',
  5: 'full',
}

const PIN_SEC_BY_TIER: Record<Tier, number> = { 1: 0, 2: 0, 3: 10, 4: 30, 5: 60 }

const entry = (id: GiftId, name: string, price: number, tier: Tier): GiftCatalogEntry => ({
  id,
  name,
  price,
  tier,
  lane: LANE_BY_TIER[tier],
  durationMs: Math.round(TIER_DURATION_SEC[tier] * 1000),
  pinSec: PIN_SEC_BY_TIER[tier],
  rivSrc: tier === 1 ? null : `/rive/${id}.riv`,
  iconSrc: `/gifts/${id}.webp`,
  layout: LAYOUT_OVERRIDE[id] ?? LAYOUT_BY_TIER[tier],
})

/** 12 gifts, cheapest first (4 columns × 3 rows in the sheet). */
export const GIFTS: readonly GiftCatalogEntry[] = [
  entry('heart', 'ハート', 10, 1),
  entry('kiss', 'キスマーク', 30, 1),
  entry('candy', 'お菓子', 100, 2),
  entry('sparkling', 'シャンパン', 300, 2),
  entry('plush', 'ぬいぐるみ', 500, 2),
  entry('bouquet', '花束', 1_000, 3),
  entry('perfume', '香水', 3_000, 3),
  entry('ring', '指輪', 5_000, 3),
  entry('diamond', 'ダイヤ', 10_000, 4),
  entry('suite', 'スイートルーム', 30_000, 4),
  entry('palace', '夜の宮殿', 100_000, 5),
  entry('myth', '神話', 300_000, 5),
]

export const giftById = (id: GiftId): GiftCatalogEntry => {
  const found = GIFTS.find(g => g.id === id)
  if (!found) throw new Error(`unknown gift: ${id}`)
  return found
}

export type { GiftId, Tier }
