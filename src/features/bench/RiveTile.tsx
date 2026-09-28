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
import type { TileProps } from './tile'

const FIT: Record<GiftLayout['fit'], Fit> = {
  cover: Fit.Cover,
  contain: Fit.Contain,
  fill: Fit.Fill,
}
const ALIGNMENT: Record<GiftLayout['align'], Alignment> = {
  center: Alignment.Center,
  bottom: Alignment.BottomCenter,
}

const hasName = (data: RiveRuntimeEvent['data']): data is { name: string } =>
  typeof data === 'object' && data !== null && 'name' in data

/**
 * One pooled Rive instance for a bench slot — the same control path as `RiveGiftEffect`
 * (shared parsed file, `play` trigger, `finished` event). `sharedContext` picks Rive's
 * `useOffscreenRenderer` (see `usesSharedContext`).
 */
export const RiveTile = ({
  giftId,
  riveFile,
  tileKey,
  layout: giftLayout,
  dpr,
  job,
  onReady,
  onFinished,
  sharedContext,
}: TileProps & { readonly riveFile: RiveFile; readonly sharedContext: boolean }) => {
  const layout = useMemo(
    () => new Layout({ fit: FIT[giftLayout.fit], alignment: ALIGNMENT[giftLayout.align] }),
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
      onLoad: () => onReady(tileKey, performance.now() - (createdAt.current ?? performance.now())),
    },
    {
      useOffscreenRenderer: sharedContext,
      customDevicePixelRatio:
        dpr ?? Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, 2),
    },
  )

  const jobRef = useRef(job)
  useEffect(() => {
    jobRef.current = job
  }, [job])

  useEffect(() => {
    if (!rive) return
    let pauseTimer: number | undefined
    const onEvent = (event: RiveRuntimeEvent) => {
      if (!hasName(event.data) || event.data.name !== RIVE_CONTRACT.finishedEvent) return
      const current = jobRef.current
      if (!current) return
      onFinished(tileKey, current.seq)
      pauseTimer = window.setTimeout(() => {
        if (!jobRef.current) rive.pause()
      }, 150)
    }
    rive.on(EventType.RiveEvent, onEvent)
    return () => {
      rive.off(EventType.RiveEvent, onEvent)
      window.clearTimeout(pauseTimer)
    }
  }, [rive, tileKey, onFinished])

  const seq = job?.seq
  useEffect(() => {
    if (!rive) return
    // No job (fresh, finished, or evicted by a smaller overlap): park it paused. An instance left
    // playing its settled idle state stops getting frames from the shared renderer's scheduler,
    // so the next play would never render; pause/play also resets that.
    if (seq === undefined) {
      rive.pause()
      return
    }
    if (!rive.isPlaying) rive.play()
    rive
      .stateMachineInputs(RIVE_CONTRACT.stateMachine)
      ?.find(input => input.name === RIVE_CONTRACT.playTrigger)
      ?.fire()
  }, [rive, seq])

  return <RiveComponent className="size-full" />
}
