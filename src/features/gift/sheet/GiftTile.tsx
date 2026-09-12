'use client'

import type { GiftCatalogEntry } from '@rive/catalog'
import { cn } from '@/lib/utils'

type Props = {
  readonly gift: GiftCatalogEntry
  readonly selected: boolean
  readonly onSelect: (gift: GiftCatalogEntry) => void
}

export const GiftTile = ({ gift, selected, onSelect }: Props) => (
  <button
    type="button"
    data-testid={`gift-tile-${gift.id}`}
    data-tier={gift.tier}
    aria-pressed={selected}
    onClick={() => onSelect(gift)}
    className={cn(
      'flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors active:scale-95',
      selected
        ? 'border-amber-300 bg-amber-300/15'
        : 'border-transparent bg-white/5 hover:bg-white/10',
    )}
  >
    <img src={gift.iconSrc} alt="" className="size-12" />
    <span className="text-[12px] leading-tight text-white">{gift.name}</span>
    <span className="text-[11px] tabular-nums text-amber-200">
      {gift.price.toLocaleString('ja-JP')}
    </span>
  </button>
)
