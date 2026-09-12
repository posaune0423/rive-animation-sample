'use client'

import { Alignment, EventType, Fit, Layout, useRive } from '@rive-app/react-webgl2'
import { RIVE_CONTRACT } from '@rive/contract'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { preloadRiveRuntime } from '../rive/runtime'

export const LabViewer = () => {
  const params = useSearchParams()
  const src = params.get('src') ?? '/rive/candy.riv'
  const width = Number(params.get('w') ?? 390)
  const height = Number(params.get('h') ?? 844)
  const loop = params.get('loop') === '1'
  const [plays, setPlays] = useState(0)
  const [finished, setFinished] = useState(0)
  const layout = useMemo(() => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }), [])

  useEffect(() => {
    void preloadRiveRuntime()
  }, [])

  const { rive, RiveComponent } = useRive(
    { src, stateMachine: RIVE_CONTRACT.stateMachine, autoplay: true, layout },
    { useOffscreenRenderer: true },
  )

  const fire = () => {
    if (!rive) return
    if (rive.isPaused) rive.play()
    rive
      .stateMachineInputs(RIVE_CONTRACT.stateMachine)
      ?.find(i => i.name === RIVE_CONTRACT.playTrigger)
      ?.fire()
    setPlays(n => n + 1)
  }

  useEffect(() => {
    if (!rive) return
    const onEvent = (e: { data?: unknown }) => {
      const data = e.data
      if (typeof data === 'object' && data && 'name' in data && data.name === 'finished') {
        setFinished(n => n + 1)
        if (loop) window.setTimeout(fire, 300)
      }
    }
    rive.on(EventType.RiveEvent, onEvent)
    window.setTimeout(fire, 100)
    return () => rive.off(EventType.RiveEvent, onEvent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rive])

  return (
    <main className="flex min-h-dvh flex-col items-center gap-3 bg-[#1b1030] p-4 text-white">
      <div className="flex items-center gap-3 font-mono text-xs">
        <code>{src}</code>
        <span data-testid="lab-plays">plays {plays}</span>
        <span data-testid="lab-finished">finished {finished}</span>
        <button
          type="button"
          data-testid="lab-play"
          onClick={fire}
          className="rounded border border-white/30 px-2 py-0.5"
        >
          play
        </button>
      </div>
      <div
        data-testid="lab-canvas"
        style={{ width, height }}
        className="relative outline outline-white/15"
      >
        <RiveComponent className="size-full" />
      </div>
    </main>
  )
}
