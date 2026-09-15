'use client'

import { LaneEffects } from './LaneEffects'

/**
 * Full-frame (T4/T5) and center (T3) lanes over the video, above every other stream layer (see
 * LiveScreen for the scale). The chatTop lane lives inside the chat column. Nothing here takes
 * pointer events, so the gift button underneath stays tappable while an effect plays.
 *
 * When both lanes run at once the higher tier wins: the full-frame effect paints over the centred
 * one. Full-frame effects keep the middle of the frame clear, so this hides neither.
 *
 * How each artboard maps onto its canvas is per gift (`layout` in the catalog), not per lane.
 */
export const GiftStage = () => (
  <div
    className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
    data-testid="gift-stage"
  >
    <div
      className="absolute inset-x-0 top-[31%] z-0 flex h-[33dvh] max-h-[300px] justify-center"
      data-lane-slot="center"
    >
      <LaneEffects lane="center" className="absolute inset-0" />
    </div>
    <div className="absolute inset-0 z-10" data-lane-slot="full">
      <LaneEffects lane="full" className="absolute inset-0" />
    </div>
  </div>
)
