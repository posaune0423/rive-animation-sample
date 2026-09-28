import type { GiftId, GiftLayout } from '@rive/catalog'
import type { PlayingJob } from './queue'

/** What every engine's tile implements: one pooled instance that replays on a new job. */
export type TileProps = {
  readonly giftId: GiftId
  /** Identifies this pooled instance to the callbacks (`lane:slot:gift`); callbacks must be stable. */
  readonly tileKey: string
  /** How the artboard maps onto its box (per gift, from the catalog). */
  readonly layout: GiftLayout
  /** Render resolution; null = the display's devicePixelRatio (capped at 2 for Rive, as in production). */
  readonly dpr: number | null
  readonly job: PlayingJob | null
  /** Instance created and ready to play, `ms` after the tile mounted. */
  readonly onReady: (tileKey: string, ms: number) => void
  readonly onFinished: (tileKey: string, seq: number) => void
}
