'use client'

import type { Fit } from '@rive-app/react-webgl2'
import { useGift } from '../GiftProvider'
import { RiveGiftEffect } from '../RiveGiftEffect'
import type { GiftLane } from '../types'

type Props = {
  readonly lane: Exclude<GiftLane, 'chat'>
  readonly fit: Fit
  readonly className?: string
}

/**
 * Renders the pool of Rive instances for one visual lane. An instance is created the first time a
 * gift is sent to that lane and kept mounted afterwards (see RiveGiftEffect).
 */
export const LaneEffects = ({ lane, fit, className }: Props) => {
  const { seen, riveFiles, activeFor, finished, laneKeyOf } = useGift()
  return (
    <>
      {seen[lane].map(giftId => {
        const riveFile = riveFiles[giftId]
        if (!riveFile) return null
        return (
          <RiveGiftEffect
            key={giftId}
            lane={lane}
            laneKey={laneKeyOf(lane)}
            giftId={giftId}
            riveFile={riveFile}
            job={activeFor(lane, giftId)}
            fit={fit}
            onFinished={finished}
            className={className}
          />
        )
      })}
    </>
  )
}
