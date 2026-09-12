'use client'

import { giftById } from '@rive/catalog'
import { useGift } from '../GiftProvider'

/** Sender names pinned above the chat: T3 10s / T4 30s / T5 60s, highest tier first, max 3. */
export const PinnedSenders = () => {
  const { state } = useGift()
  if (state.pins.length === 0) return null
  return (
    <ul className="flex flex-col gap-1" data-testid="pins">
      {state.pins.map(pin => {
        const gift = giftById(pin.giftId)
        return (
          <li
            key={pin.seq}
            data-testid="pin"
            data-tier={pin.tier}
            className="flex items-center gap-2 rounded-full border border-amber-200/40 bg-black/45 py-1 pr-3 pl-1 text-[12px] text-amber-50 backdrop-blur-sm"
          >
            <img src={gift.iconSrc} alt="" className="size-6" />
            <span className="font-medium">{pin.sender.name}</span>
            <span className="text-amber-100/80">さんが {gift.name} を贈りました</span>
          </li>
        )
      })}
    </ul>
  )
}
