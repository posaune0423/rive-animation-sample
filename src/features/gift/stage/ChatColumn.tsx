'use client'

import { Fit } from '@rive-app/react-webgl2'
import { giftById } from '@rive/catalog'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { randomSender, useGift } from '../GiftProvider'
import type { ChatRow } from '../types'
import { LaneEffects } from './LaneEffects'
import { PinnedSenders } from './PinnedSenders'

const COMMENTS = [
  'かわいい〜',
  'こんばんは！',
  '今日も来ました',
  'その衣装すき',
  '8888',
  '待ってた',
  '声いいね',
  '今日は何時まで？',
]

const VISIBLE_ROWS = 8

/**
 * Comments overlaid on the lower-left of the video. Gift rows render here too:
 * T1 = icon pop (+ ×n), T2 = highlighted row with the chatTop Rive slot at the top of the column.
 */
export const ChatColumn = () => {
  const { state, comment, laneKeyOf } = useGift()

  useEffect(() => {
    let timer: number
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          comment(randomSender(), COMMENTS[Math.floor(Math.random() * COMMENTS.length)] as string)
          schedule()
        },
        2500 + Math.random() * 2500,
      )
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [comment])

  const rows = state.chat.slice(-VISIBLE_ROWS)
  const chatTopActive = state.lanes[laneKeyOf('chatTop')]?.active
  const chatTopJob = chatTopActive?.lane === 'chatTop' ? chatTopActive : null

  return (
    <div
      className="pointer-events-none absolute bottom-20 left-3 flex w-[72%] flex-col gap-2"
      data-testid="chat-column"
    >
      <PinnedSenders />
      <div
        className="flex h-16 items-center gap-2"
        data-lane-slot="chatTop"
        data-active={chatTopJob ? 'true' : 'false'}
      >
        <div className="relative size-16 shrink-0">
          <LaneEffects lane="chatTop" fit={Fit.Contain} className="absolute inset-0" />
        </div>
        {chatTopJob && (
          <p className="rounded-full bg-amber-300/90 px-3 py-1 text-[12px] font-medium text-neutral-900 shadow">
            {chatTopJob.sender.name} さんが {giftById(chatTopJob.giftId).name} を贈りました
          </p>
        )}
      </div>
      <ul className="flex flex-col justify-end gap-1 [mask-image:linear-gradient(to_bottom,transparent,black_18%)]">
        {rows.map(row => (
          <ChatRowView key={row.key} row={row} />
        ))}
      </ul>
    </div>
  )
}

const ChatRowView = ({ row }: { row: ChatRow }) => {
  if (row.kind === 'comment') {
    return (
      <li
        data-testid="chat-row"
        data-kind="comment"
        className="w-fit max-w-full rounded-2xl bg-black/35 px-3 py-1 text-[13px] text-white/90 backdrop-blur-[2px]"
      >
        <span className="mr-1.5 text-white/60">{row.sender.name}</span>
        {row.text}
      </li>
    )
  }
  const gift = giftById(row.giftId)
  const t1 = row.tier === 1
  return (
    <li
      data-testid="chat-row"
      data-kind="gift"
      data-tier={row.tier}
      data-count={row.count}
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
      <span className="text-white/70">{row.sender.name}</span>
      {t1 ? (
        row.count > 1 && (
          <span className="font-semibold tabular-nums text-rose-200" data-testid="combo">
            ×{row.count}
          </span>
        )
      ) : (
        <span>
          さんが <span className="font-medium text-amber-100">{gift.name}</span> を贈りました
        </span>
      )}
    </li>
  )
}
