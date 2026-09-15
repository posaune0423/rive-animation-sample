'use client'

import {
  Alignment,
  EventType,
  Fit,
  Layout,
  useRive,
  type Event as RiveRuntimeEvent,
  type RiveFile,
} from '@rive-app/react-webgl2'
import type { GiftLayout } from '@rive/catalog'
import { RIVE_CONTRACT } from '@rive/contract'
import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import { recordFinished, recordFirstAdvance, recordFirstInstance, recordPlayFired } from './metrics'
import type { GiftId, GiftLane, LaneKey, PlayingGift } from './types'

type Props = {
  readonly lane: Exclude<GiftLane, 'chat'>
  readonly laneKey: LaneKey
  readonly giftId: GiftId
  readonly riveFile: RiveFile
  readonly job: PlayingGift | null
  readonly layout: GiftLayout
  readonly onFinished: (lane: LaneKey, seq: number) => void
  readonly className?: string
}

const hasName = (data: RiveRuntimeEvent['data']): data is { name: string } =>
  typeof data === 'object' && data !== null && 'name' in data

const FIT: Record<GiftLayout['fit'], Fit> = {
  cover: Fit.Cover,
  contain: Fit.Contain,
  fill: Fit.Fill,
}

const ALIGNMENT: Record<GiftLayout['align'], Alignment> = {
  center: Alignment.Center,
  bottom: Alignment.BottomCenter,
}

/**
 * One pooled Rive instance for a (lane, gift) pair. Mounted once and reused: every play fires the
 * `play` trigger of the state machine and waits for the `finished` Rive Event.
 *
 * This is the only file that knows how the .riv is controlled. A designer-made file that exposes
 * View Model triggers instead would swap `stateMachineInputs(...).fire()` for
 * `viewModelInstance.trigger('play')` and the RiveEvent listener for a `finished` trigger observer.
 */
export const RiveGiftEffect = ({
  lane,
  laneKey,
  giftId,
  riveFile,
  job,
  layout: giftLayout,
  onFinished,
  className,
}: Props) => {
  const layout = useMemo(
    () =>
      new Layout({
        fit: FIT[giftLayout.fit],
        alignment: ALIGNMENT[giftLayout.align],
      }),
    [giftLayout.fit, giftLayout.align],
  )
  const createdAt = useRef<number | null>(null)
  useEffect(() => {
    createdAt.current ??= performance.now()
  }, [])
  const { rive, RiveComponent } = useRive(
    {
      riveFile,
      artboard: giftId,
      stateMachine: RIVE_CONTRACT.stateMachine,
      autoplay: true,
      layout,
      shouldDisableRiveListeners: true,
      onLoad: () =>
        recordFirstInstance(
          Math.round(performance.now() - (createdAt.current ?? performance.now())),
        ),
    },
    {
      useOffscreenRenderer: true,
      customDevicePixelRatio: Math.min(
        typeof window === 'undefined' ? 1 : window.devicePixelRatio,
        2,
      ),
    },
  )

  const jobRef = useRef<PlayingGift | null>(null)
  useEffect(() => {
    jobRef.current = job
  }, [job])

  // Finished → hand the lane back, then let the idle timeline hide everything and pause.
  useEffect(() => {
    if (!rive) return
    let pauseTimer: number | undefined
    const onEvent = (event: RiveRuntimeEvent) => {
      if (!hasName(event.data) || event.data.name !== RIVE_CONTRACT.finishedEvent) return
      const current = jobRef.current
      if (!current) return
      recordFinished(giftId, lane, performance.now())
      onFinished(laneKey, current.seq)
      pauseTimer = window.setTimeout(() => {
        if (!jobRef.current) rive.pause()
      }, 150)
    }
    rive.on(EventType.RiveEvent, onEvent)
    return () => {
      rive.off(EventType.RiveEvent, onEvent)
      window.clearTimeout(pauseTimer)
    }
  }, [rive, giftId, lane, laneKey, onFinished])

  // A new job for this instance → resume the render loop and fire the trigger.
  const seq = job?.seq
  useEffect(() => {
    if (!rive || seq === undefined) return
    if (rive.isPaused) rive.play()
    const onAdvance = () => {
      recordFirstAdvance(giftId, lane, performance.now())
      rive.off(EventType.Advance, onAdvance)
    }
    rive.on(EventType.Advance, onAdvance)
    recordPlayFired(giftId, lane, performance.now())
    const trigger = rive
      .stateMachineInputs(RIVE_CONTRACT.stateMachine)
      ?.find(input => input.name === RIVE_CONTRACT.playTrigger)
    trigger?.fire()
    return () => rive.off(EventType.Advance, onAdvance)
  }, [rive, seq, giftId, lane])

  return (
    <div
      data-lane={lane}
      data-gift={giftId}
      data-active={job ? 'true' : 'false'}
      data-seq={job?.seq}
      className={cn(
        'pointer-events-none transition-opacity duration-200',
        job ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <RiveComponent className="size-full" />
    </div>
  )
}
