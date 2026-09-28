'use client'

import type { GiftLayout } from '@rive/catalog'
import type { AnimationItem } from 'lottie-web'
import { useEffect, useRef, useState } from 'react'
import type { TileProps } from './tile'

/** SVG preserveAspectRatio for the catalog's fit / align (lottie-web uses it for canvas too). */
const aspect = ({ fit, align }: GiftLayout): string => {
  if (fit === 'fill') return 'none'
  const y = align === 'bottom' ? 'YMax' : 'YMid'
  return `xMid${y} ${fit === 'cover' ? 'slice' : 'meet'}`
}

/**
 * One lottie-web instance for a bench slot. `animationData` is the shared parsed JSON (lottie-web
 * keeps a reference and adds bookkeeping flags to it, as every instance on a page normally does).
 * A new job replays from frame 0; `complete` is the Lottie counterpart of Rive's `finished` event.
 */
export const LottieTile = ({
  renderer,
  animationData,
  tileKey,
  layout,
  dpr,
  job,
  onReady,
  onFinished,
}: TileProps & { readonly renderer: 'svg' | 'canvas'; readonly animationData: object }) => {
  const preserveAspectRatio = aspect(layout)
  const container = useRef<HTMLDivElement>(null)
  const [anim, setAnim] = useState<AnimationItem | null>(null)
  const jobRef = useRef(job)
  useEffect(() => {
    jobRef.current = job
  }, [job])

  useEffect(() => {
    const el = container.current
    if (!el) return
    let cancelled = false
    let instance: AnimationItem | null = null
    const t0 = performance.now()
    // lottie-web reads `navigator`/`document` when imported, so it only loads in the browser.
    void import('lottie-web').then(({ default: lottie }) => {
      if (cancelled) return
      instance = lottie.loadAnimation({
        container: el,
        renderer,
        loop: false,
        autoplay: false,
        animationData,
        rendererSettings: {
          preserveAspectRatio,
          progressiveLoad: false,
          clearCanvas: true,
          // canvas renderer only; SVG rasterizes at the display's ratio whatever we ask
          dpr: dpr ?? window.devicePixelRatio,
        },
      })
      instance.addEventListener('DOMLoaded', () => onReady(tileKey, performance.now() - t0))
      // lottie-web swallows configuration errors into this event; without it a broken file is
      // just an empty tile.
      instance.addEventListener('error', event => console.error('[lottie]', event))
      instance.addEventListener('complete', () => {
        const current = jobRef.current
        if (current) onFinished(tileKey, current.seq)
      })
      setAnim(instance)
    })
    return () => {
      cancelled = true
      instance?.destroy()
      setAnim(null)
    }
  }, [renderer, animationData, tileKey, preserveAspectRatio, dpr, onReady, onFinished])

  const seq = job?.seq
  useEffect(() => {
    if (!anim) return
    // No job (fresh, finished, or evicted by a smaller overlap): park it so an invisible tile
    // never keeps drawing — that would land on the meter as load nobody can see.
    if (seq === undefined) anim.goToAndStop(0, true)
    else anim.goToAndPlay(0, true)
  }, [anim, seq])

  return <div ref={container} className="size-full [&>canvas]:size-full [&>svg]:size-full" />
}
