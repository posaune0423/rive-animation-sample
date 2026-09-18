'use client'

import { giftById, type GiftId, type GiftLane } from '@rive/catalog'
import { cn } from '@/lib/utils'
import type { LaneKey } from '../gift/types'
import type { BenchAsset } from './assets'
import type { Engine } from './engines'
import { LottieTile } from './LottieTile'
import type { PlayingJob } from './queue'
import { RiveTile } from './RiveTile'
import { fullFrameActive, slotKey, type StageChatRow, type StageState } from './stage'

export const STAGE_WIDTH = 390
export const STAGE_HEIGHT = 844

type Props = {
  readonly engine: Engine
  readonly state: StageState
  readonly assets: Readonly<Partial<Record<GiftId, BenchAsset>>>
  readonly dpr: number | null
  /** Stable callbacks; `tileKey` is `lane:slot:gift` (see `parseTileKey`). */
  readonly onReady: (tileKey: string, ms: number) => void
  readonly onFinished: (tileKey: string, seq: number) => void
}

export const tileKeyOf = (lane: LaneKey, slot: number, giftId: GiftId): string =>
  `${lane}:${slot}:${giftId}`

export const parseTileKey = (key: string): { lane: LaneKey; slot: number; giftId: GiftId } => {
  const [lane, slot, giftId] = key.split(':') as [LaneKey, string, GiftId]
  return { lane, slot: Number(slot), giftId }
}

type TileSpec = {
  readonly key: string
  readonly laneKey: LaneKey
  readonly slot: number
  readonly giftId: GiftId
  readonly job: PlayingJob | null
}

/**
 * Every pooled instance, grouped by the visual lane it draws in. Under the strict policy the queue
 * lane is `stage` but a gift still draws where its tier says (a T2 in the chat column, a T4 over
 * the whole frame).
 */
const tilesByLane = (state: StageState): Record<Exclude<GiftLane, 'chat'>, TileSpec[]> => {
  const out: Record<Exclude<GiftLane, 'chat'>, TileSpec[]> = { chatTop: [], center: [], full: [] }
  for (const [laneKey, queue] of Object.entries(state.lanes) as [
    LaneKey,
    StageState['lanes'][LaneKey],
  ][]) {
    if (!queue) continue
    queue.slots.forEach((job, slot) => {
      for (const giftId of state.seen[slotKey(laneKey, slot)] ?? []) {
        const lane = giftById(giftId).lane
        if (lane === 'chat') continue
        out[lane].push({
          key: tileKeyOf(laneKey, slot, giftId),
          laneKey,
          slot,
          giftId,
          job: job && job.giftId === giftId ? job : null,
        })
      }
    })
  }
  return out
}

/**
 * The portrait live-stream mock at phone size, with the production layer order: video, stream UI
 * (header, chat with the chatTop slot), effects (center, full) on top and click-through.
 */
export const LiveStage = ({ engine, state, assets, dpr, onReady, onFinished }: Props) => {
  const tiles = tilesByLane(state)
  const dimChat = fullFrameActive(state)
  const renderTile = (t: TileSpec, className?: string) => {
    const asset = assets[t.giftId]
    if (!asset) return null
    const props = {
      giftId: t.giftId,
      tileKey: t.key,
      layout: giftById(t.giftId).layout,
      dpr,
      job: t.job,
      onReady,
      onFinished,
    }
    return (
      <div
        key={`${t.key}@${dpr ?? 'auto'}`}
        data-lane={t.laneKey}
        data-slot={t.slot}
        data-gift={t.giftId}
        data-active={t.job ? 'true' : 'false'}
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-200',
          t.job ? 'opacity-100' : 'opacity-0',
          className,
        )}
      >
        {asset.kind === 'rive' ? (
          <RiveTile riveFile={asset.file} {...props} />
        ) : (
          <LottieTile
            renderer={engine === 'lottie-canvas' ? 'canvas' : 'svg'}
            animationData={asset.data}
            {...props}
          />
        )}
      </div>
    )
  }
  const instances = tiles.chatTop.length + tiles.center.length + tiles.full.length
  const chatTopJobs = tiles.chatTop.filter(t => t.job)

  return (
    <div
      data-testid="live-stage"
      data-instances={instances}
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
      className="relative isolate shrink-0 overflow-hidden rounded-[28px] bg-black text-white shadow-2xl ring-8 ring-zinc-800"
    >
      <FakeVideo />

      <header className="pointer-events-none absolute top-3 left-3 z-10 flex w-[78%] flex-col gap-2 text-[12px]">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-rose-600 px-2 py-0.5 font-semibold">LIVE</span>
          <span className="rounded-full bg-black/40 px-2 py-0.5">1,203 人が視聴中</span>
        </div>
      </header>

      <div className="pointer-events-none absolute bottom-16 left-3 z-10 flex w-[72%] flex-col gap-2">
        <div className="flex h-16 items-center gap-2" data-lane-slot="chatTop">
          <div className="relative size-16 shrink-0">{tiles.chatTop.map(t => renderTile(t))}</div>
          {chatTopJobs[0] && (
            <p className="rounded-full bg-amber-300/90 px-3 py-1 text-[12px] font-medium text-neutral-900 shadow">
              {giftById(chatTopJobs[0].giftId).name} を贈りました
              {chatTopJobs.length > 1 && ` (+${chatTopJobs.length - 1})`}
            </p>
          )}
        </div>
        <ul
          className={cn(
            'flex flex-col justify-end gap-1 transition-opacity duration-500 [mask-image:linear-gradient(to_bottom,transparent,black_18%)]',
            dimChat && 'opacity-0',
          )}
          data-testid="stage-chat"
        >
          {state.chat.slice(-8).map(row => (
            <ChatRowView key={row.key} row={row} />
          ))}
        </ul>
      </div>

      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
        <div
          className="absolute inset-x-0 top-[31%] z-0 flex h-[33%] max-h-[300px] justify-center"
          data-lane-slot="center"
        >
          {tiles.center.map(t => renderTile(t))}
        </div>
        <div className="absolute inset-0 z-10" data-lane-slot="full">
          {tiles.full.map(t => renderTile(t))}
        </div>
      </div>
    </div>
  )
}

const FakeVideo = () => (
  <div className="absolute inset-0 z-0 overflow-hidden bg-[radial-gradient(120%_80%_at_50%_100%,#3b1d3f_0%,#12091a_55%,#05030a_100%)]">
    <div className="fake-blob absolute top-[8%] left-[-20%] size-[70%] rounded-full bg-fuchsia-600/25 blur-3xl" />
    <div className="fake-blob-slow absolute right-[-25%] bottom-[10%] size-[80%] rounded-full bg-indigo-500/25 blur-3xl" />
    <div className="absolute top-[24%] left-1/2 h-[24%] w-[38%] -translate-x-1/2 rounded-[45%] bg-[#e8c4b0]/25" />
    <div className="absolute top-[45%] left-1/2 h-[40%] w-[62%] -translate-x-1/2 rounded-t-[40%] bg-[#e8c4b0]/15" />
  </div>
)

const ChatRowView = ({ row }: { readonly row: StageChatRow }) => {
  const gift = giftById(row.giftId)
  const t1 = row.tier === 1
  return (
    <li
      data-testid="stage-chat-row"
      data-tier={row.tier}
      className={cn(
        'flex w-fit max-w-full items-center gap-1.5 rounded-2xl px-2 py-1 text-[13px] text-white backdrop-blur-[2px]',
        t1 ? 'bg-black/35' : 'bg-amber-400/25 ring-1 ring-amber-200/60',
      )}
    >
      <img
        key={`${row.key}-${row.count}`}
        src={gift.iconSrc}
        alt={gift.name}
        className={cn('size-5', t1 && 'animate-gift-pop')}
      />
      <span className="text-white/70">{row.sender}</span>
      {t1 ? (
        row.count > 1 && (
          <span className="font-semibold tabular-nums text-rose-200">×{row.count}</span>
        )
      ) : (
        <span>
          さんが <span className="font-medium text-amber-100">{gift.name}</span> を贈りました
        </span>
      )}
    </li>
  )
}
