'use client'

import { GIFTS, type GiftCatalogEntry } from '@rive/catalog'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { useGift } from '../GiftProvider'
import { GiftTile } from './GiftTile'

const INITIAL_BALANCE = 12_345

/**
 * Bottom sheet with the 12 gifts (4 × 3, cheapest first, heart preselected).
 * T1 sends on tap (no confirmation, repeat-tap friendly). T2+ asks once before sending.
 */
export const GiftSheet = () => {
  const { send } = useGift()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<GiftCatalogEntry>(GIFTS[0] as GiftCatalogEntry)
  const [confirming, setConfirming] = useState<GiftCatalogEntry | null>(null)
  const [balance, setBalance] = useState(INITIAL_BALANCE)

  const spend = (gift: GiftCatalogEntry) => {
    send(gift.id)
    setBalance(b => Math.max(0, b - gift.price))
  }

  const onSelect = (gift: GiftCatalogEntry) => {
    setSelected(gift)
    if (gift.tier === 1) {
      spend(gift)
      return
    }
    setConfirming(gift)
  }

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger
          render={
            <Button
              data-testid="gift-button"
              size="lg"
              className="pointer-events-auto h-12 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-8 text-base font-semibold text-neutral-900 shadow-lg hover:from-amber-200 hover:to-amber-400"
            />
          }
        >
          ギフトを送る
        </DrawerTrigger>
        <DrawerContent className="bg-neutral-950/95 text-white" data-testid="gift-sheet">
          <DrawerHeader className="flex-row items-center justify-between">
            <div>
              <DrawerTitle className="text-white">ギフト</DrawerTitle>
              <DrawerDescription className="text-white/60">
                タップで贈る（ハート・キスマークは確認なし）
              </DrawerDescription>
            </div>
            <p className="text-right text-[12px] text-white/70">
              残高
              <span
                className="ml-1 text-base font-semibold tabular-nums text-amber-200"
                data-testid="balance"
              >
                {balance.toLocaleString('ja-JP')}
              </span>
            </p>
          </DrawerHeader>
          <div className="grid grid-cols-4 gap-2 px-4 pb-6">
            {GIFTS.map(gift => (
              <GiftTile
                key={gift.id}
                gift={gift}
                selected={selected.id === gift.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={confirming !== null} onOpenChange={o => !o && setConfirming(null)}>
        <DialogContent className="max-w-xs" data-testid="gift-confirm">
          {confirming && (
            <>
              <DialogTitle className="flex items-center gap-2">
                <img src={confirming.iconSrc} alt="" className="size-8" />
                {confirming.name} を贈りますか？
              </DialogTitle>
              <DialogDescription>
                {confirming.price.toLocaleString('ja-JP')} コインを使います。
              </DialogDescription>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirming(null)}>
                  やめる
                </Button>
                <Button
                  data-testid="gift-confirm-send"
                  onClick={() => {
                    spend(confirming)
                    setConfirming(null)
                    setOpen(false)
                  }}
                >
                  贈る
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
