'use client'

import { Fit } from '@rive-app/react-webgl2'
import { LaneEffects } from './LaneEffects'

/**
 * Full-frame (T4/T5) and center (T3) lanes over the video. The chatTop lane lives inside the
 * chat column. Everything here ignores pointer events.
 */
export const GiftStage = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="gift-stage">
    <div className="absolute inset-0" data-lane-slot="full">
      <LaneEffects lane="full" fit={Fit.Cover} className="absolute inset-0" />
    </div>
    <div
      className="absolute inset-x-0 top-[31%] flex h-[33dvh] max-h-[300px] justify-center"
      data-lane-slot="center"
    >
      <LaneEffects lane="center" fit={Fit.Contain} className="absolute inset-0" />
    </div>
  </div>
)
