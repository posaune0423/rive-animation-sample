import { GIFTS, type GiftId } from '@rive/catalog'
import type { StageConfig } from './stage'

/**
 * How busy the stream is. Viewers keep sending gifts at `perSecond` for `seconds`; each of the
 * three effect lanes (chat top, center, full screen) may stack `overlap` effects, so the screen
 * holds `3 × overlap` effects at once while it lasts. Gifts beyond that wait (the oldest waiting
 * ones are dropped past 5 per lane), which keeps the load bounded and identical across runtimes.
 */
export type LoadId = 'normal' | 'busy' | 'heavy' | 'extreme'

export type LoadLevel = {
  readonly id: LoadId
  readonly label: string
  readonly overlap: number
  readonly perSecond: number
  readonly seconds: number
  /** One line for people who have never seen the bench. */
  readonly summary: string
}

export const LOADS: readonly LoadLevel[] = [
  {
    id: 'normal',
    label: '本番想定',
    overlap: 1,
    perSecond: 5,
    seconds: 10,
    summary: '演出は各レーン 1 本ずつ。残りは順番待ち',
  },
  {
    id: 'busy',
    label: '盛り上がり',
    overlap: 3,
    perSecond: 10,
    seconds: 10,
    summary: '同じ場所に 3 本まで重ねて出す',
  },
  {
    id: 'heavy',
    label: 'イベント終盤',
    overlap: 10,
    perSecond: 30,
    seconds: 10,
    summary: 'ランキング終盤の投げ合い。10 本ずつ重なる',
  },
  {
    id: 'extreme',
    label: '限界',
    overlap: 20,
    perSecond: 50,
    seconds: 10,
    summary: '同時 60 本。どこで崩れるかを見るための上限',
  },
]

export const loadById = (id: LoadId): LoadLevel => {
  const found = LOADS.find(l => l.id === id)
  if (!found) throw new Error(`unknown load: ${id}`)
  return found
}

export const isLoadId = (value: string | null): value is LoadId => LOADS.some(l => l.id === value)

/** Effects on screen at once while the load runs: three lanes, `overlap` each. */
export const onScreen = (load: LoadLevel): number => 3 * load.overlap

export const loadStageConfig = (load: LoadLevel): StageConfig => ({
  policy: 'per-lane',
  overlap: load.overlap,
  gapMs: 0,
  overflow: 'drop-oldest',
  queueMax: 5,
})

const EFFECT_GIFTS: readonly GiftId[] = GIFTS.filter(g => g.tier >= 2).map(g => g.id)

/**
 * The gifts sent over `seconds` at `perSecond`: every effect gift in catalog order, round and
 * round. Fixed rather than random so each runtime draws exactly the same thing.
 */
export const giftBurst = (perSecond: number, seconds: number): GiftId[] =>
  Array.from(
    { length: perSecond * seconds },
    (_, i) => EFFECT_GIFTS[i % EFFECT_GIFTS.length] as GiftId,
  )
