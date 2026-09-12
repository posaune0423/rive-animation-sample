'use client'

import { env } from '@/env'
import { DebugHud } from './DebugHud'
import { GiftProvider } from './GiftProvider'
import { GiftSheet } from './sheet/GiftSheet'
import { ChatColumn } from './stage/ChatColumn'
import { GiftStage } from './stage/GiftStage'

/** Portrait live-stream mock: fake video, chat on the lower-left, gift button at the bottom. */
export const LiveScreen = () => (
  <GiftProvider>
    <main className="relative mx-auto h-dvh w-full max-w-[430px] overflow-hidden bg-black text-white">
      <FakeVideo />
      <GiftStage />
      <ChatColumn />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
        <GiftSheet />
      </div>
      <header className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 text-[12px]">
        <span className="rounded-full bg-rose-600 px-2 py-0.5 font-semibold">LIVE</span>
        <span className="rounded-full bg-black/40 px-2 py-0.5">1,203 人が視聴中</span>
      </header>
      {env.NEXT_PUBLIC_DEBUG_HUD && <DebugHud />}
    </main>
  </GiftProvider>
)

const FakeVideo = () => (
  <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_80%_at_50%_100%,#3b1d3f_0%,#12091a_55%,#05030a_100%)]">
    <div className="fake-blob absolute top-[8%] left-[-20%] size-[70vw] rounded-full bg-fuchsia-600/25 blur-3xl" />
    <div className="fake-blob-slow absolute right-[-25%] bottom-[10%] size-[80vw] rounded-full bg-indigo-500/25 blur-3xl" />
    {/* streamer silhouette so the face-safe area is visible */}
    <div className="absolute top-[24%] left-1/2 h-[24%] w-[38%] -translate-x-1/2 rounded-[45%] bg-[#e8c4b0]/25" />
    <div className="absolute top-[45%] left-1/2 h-[40%] w-[62%] -translate-x-1/2 rounded-t-[40%] bg-[#e8c4b0]/15" />
    <div className="face-guide pointer-events-none absolute top-[18%] right-[22%] bottom-[42%] left-[22%] hidden rounded-xl border-2 border-dashed border-cyan-300/70" />
  </div>
)
