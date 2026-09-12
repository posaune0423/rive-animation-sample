import { createEnv } from '@t3-oss/env-nextjs'
import * as v from 'valibot'

const booleanString = v.pipe(
  v.optional(v.picklist(['true', 'false']), 'true'),
  v.transform(value => value === 'true'),
)

const positiveInt = (fallback: string) =>
  v.pipe(v.optional(v.string(), fallback), v.transform(Number), v.integer(), v.minValue(1))

export const env = createEnv({
  client: {
    NEXT_PUBLIC_DEBUG_HUD: booleanString,
    NEXT_PUBLIC_QUEUE_POLICY: v.optional(v.picklist(['per-lane', 'strict']), 'per-lane'),
    NEXT_PUBLIC_T2_QUEUE_MAX: positiveInt('5'),
  },
  runtimeEnv: {
    NEXT_PUBLIC_DEBUG_HUD: process.env.NEXT_PUBLIC_DEBUG_HUD,
    NEXT_PUBLIC_QUEUE_POLICY: process.env.NEXT_PUBLIC_QUEUE_POLICY,
    NEXT_PUBLIC_T2_QUEUE_MAX: process.env.NEXT_PUBLIC_T2_QUEUE_MAX,
  },
  emptyStringAsUndefined: true,
})
