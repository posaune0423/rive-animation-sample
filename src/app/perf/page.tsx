import type { Metadata } from 'next'
import { Suspense } from 'react'
import { StageScreen } from '@/features/bench/StageScreen'

export const metadata: Metadata = {
  title: 'Rive vs Lottie 配信ギフト負荷計測',
  description:
    'スマホサイズの配信画面にギフト演出を重ねて送り、Rive / Lottie の fps・フレーム時間・キュー挙動を実測する',
}

/**
 * /perf?engine=rive|lottie-svg|lottie-canvas&policy=per-lane|strict&overlap=3&gap=0&overflow=queue&qmax=5
 * The live-stream screen at phone size, gift buttons and storms, queue controls and a live meter.
 */
export default function PerfPage() {
  return (
    <Suspense>
      <StageScreen />
    </Suspense>
  )
}
