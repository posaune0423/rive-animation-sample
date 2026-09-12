import { heart, kiss } from './t1'
import { candy, plush, sparkling } from './t2'
import { bouquet, perfume, ring } from './t3'
import { diamond, suite } from './t4'
import { myth, palace } from './t5'
import type { GiftDefinition } from './shared'

/** Cheapest first — the same order as the gift sheet. */
export const GIFT_DEFINITIONS: readonly GiftDefinition[] = [
  heart,
  kiss,
  candy,
  sparkling,
  plush,
  bouquet,
  perfume,
  ring,
  diamond,
  suite,
  palace,
  myth,
]

export type { GiftDefinition, GiftId } from './shared'
