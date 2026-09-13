import { renderAsset, renderFrames } from '../assets'
import { TIER_ARTBOARD, TIER_DURATION_SEC } from '../contract'
import { palette } from '../palette'
import { withAlpha } from '../writer/binary'
import { ellipse, group, image, scene, shape, solid } from '../writer/scene'
import { EASE, timeline, type TimelineBuilder } from '../writer/timeline'
import { flipbook, playFlipbook } from './flipbook'
import { range, seeded, sparkle, type GiftDefinition } from './shared'

const { width: W, height: H } = TIER_ARTBOARD[3]
const DUR = TIER_DURATION_SEC[3]
const CX = W / 2
const CY = H / 2
/** Rendered parts share one camera, so every part is placed at the same point and width. */
const ART = 300

/**
 * T3 template: 0.0–0.4 appear small at the center, 0.4–3.6 main motion,
 * 3.6–5.0 fade through to nothing. One subject, never darkens the video.
 */
const appearAndFade = (t: TimelineBuilder, root: string): TimelineBuilder =>
  t
    .keys(root, 'opacity', [
      [0, 0, EASE.softOut],
      [0.4, 1],
      [3.6, 1, EASE.softIn],
      [5.0, 0],
    ])
    .keys(root, 'scaleX', [
      [0, 0.35, EASE.out],
      [0.4, 1],
    ])
    .keys(root, 'scaleY', [
      [0, 0.35, EASE.out],
      [0.4, 1],
    ])

// ---- 花束 1,000 -------------------------------------------------------------

export const bouquet: GiftDefinition = {
  id: 'bouquet',
  tier: 3,
  iconRender: 'bouquet_open',
  effect: {
    scene: scene('bouquet', W, H, [
      group('gift', { x: CX, y: CY }, [
        // closed buds cross-fade into the open bouquet
        image('closed', {}, renderAsset('bouquet_closed'), ART),
        image('open', { opacity: 0, scaleX: 0.92, scaleY: 0.92 }, renderAsset('bouquet_open'), ART),
        ...range(8).map(i =>
          shape(
            `petal${i}`,
            { x: (i - 3.5) * 24, y: -30, opacity: 0, rotation: i * 0.7 },
            ellipse(12, 18),
            solid(withAlpha(palette.deepRedLight, 0.6)),
          ),
        ),
      ]),
    ]),
    play: (() => {
      const t = appearAndFade(timeline('play', DUR), 'gift')
      // 閉じた束が中央で開く
      t.keys('closed', 'opacity', [
        [0.6, 1, EASE.inOut],
        [1.7, 0],
      ])
        .keys('open', 'opacity', [
          [0.6, 0, EASE.inOut],
          [1.7, 1],
        ])
        .keys('open', 'scaleX', [
          [0.6, 0.92, EASE.out],
          [1.9, 1],
        ])
        .keys('open', 'scaleY', [
          [0.6, 0.92, EASE.out],
          [1.9, 1],
        ])
      // 花弁は透ける。映像枠を埋めない
      const rand = seeded(1000)
      range(8).forEach(i => {
        const start = 1.3 + rand() * 1.2
        const x0 = (i - 3.5) * 24
        t.keys(`petal${i}`, 'opacity', [
          [start, 0, EASE.softOut],
          [start + 0.3, 0.6, EASE.softIn],
          [start + 1.6, 0],
        ])
          .keys(`petal${i}`, 'y', [
            [start, -30, EASE.softOut],
            [start + 1.6, -30 - 70 - rand() * 40],
          ])
          .keys(`petal${i}`, 'x', [
            [start, x0, EASE.inOut],
            [start + 1.6, x0 + (rand() - 0.5) * 60],
          ])
      })
      return t.build()
    })(),
  },
}

// ---- 香水 3,000 -------------------------------------------------------------

const MIST = 10

export const perfume: GiftDefinition = {
  id: 'perfume',
  tier: 3,
  iconRender: 'perfume',
  effect: {
    scene: scene('perfume', W, H, [
      group('gift', { x: CX, y: CY }, [
        image('bottle', {}, renderAsset('perfume_bottle'), ART),
        image('cap', {}, renderAsset('perfume_cap'), ART),
        ...range(MIST).map(i =>
          shape(
            `mist${i}`,
            { x: 0, y: -110, opacity: 0 },
            ellipse(26 + (i % 3) * 10),
            solid(withAlpha(palette.ice, 0.25)),
          ),
        ),
      ]),
    ]),
    play: (() => {
      const t = appearAndFade(timeline('play', DUR), 'gift')
      // 1回噴霧。霧が左右に薄く広がって消える（霧は必ず半透明）
      t.keys('cap', 'y', [
        [0.8, 0, EASE.in],
        [1.0, 7, EASE.out],
        [1.3, 0],
      ])
      const rand = seeded(3000)
      range(MIST).forEach(i => {
        const side = i % 2 === 0 ? -1 : 1
        const start = 1.0 + (i % 5) * 0.12
        const end = start + 1.6 + rand() * 0.6
        t.keys(`mist${i}`, 'opacity', [
          [start, 0, EASE.softOut],
          [start + 0.25, 1, EASE.softIn],
          [end, 0],
        ])
          .keys(`mist${i}`, 'x', [
            [start, side * 6, EASE.out],
            [end, side * (40 + rand() * 70)],
          ])
          .keys(`mist${i}`, 'y', [
            [start, -110, EASE.out],
            [end, -140 - rand() * 60],
          ])
          .keys(`mist${i}`, 'scaleX', [
            [start, 0.4, EASE.out],
            [end, 1.8],
          ])
          .keys(`mist${i}`, 'scaleY', [
            [start, 0.4, EASE.out],
            [end, 1.8],
          ])
      })
      return t.build()
    })(),
  },
}

// ---- 指輪 5,000 -------------------------------------------------------------

const RING_FRAMES = 24

/** Rendered gold ring (24-frame turntable) cross-faded through one slow turn. */
export const ring: GiftDefinition = {
  id: 'ring',
  tier: 3,
  iconRender: 'ring_f00',
  effect: {
    scene: scene('ring', W, H, [
      group('gift', { x: CX, y: CY }, [
        flipbook('spin', renderFrames('ring', RING_FRAMES), {}, ART),
        sparkle('sparkA', -80, -60, 26, solid(withAlpha(palette.white, 0.95))),
        sparkle('sparkB', 70, 40, 20, solid(withAlpha(palette.white, 0.95))),
        sparkle('sparkC', 10, -120, 16, solid(withAlpha(palette.white, 0.95))),
      ]),
    ]),
    play: (() => {
      const t = appearAndFade(timeline('play', DUR), 'gift')
      // その場でゆっくり1回転。きらめきは点
      playFlipbook(t, 'spin', RING_FRAMES, { start: 0.4, end: 3.6, turns: 1 })
      const flashes: ReadonlyArray<readonly [id: string, at: number]> = [
        ['sparkA', 1.1],
        ['sparkB', 2.0],
        ['sparkC', 2.9],
      ]
      for (const [id, at] of flashes) {
        t.keys(id, 'opacity', [
          [0, 0, 'hold'],
          [at, 0, EASE.out],
          [at + 0.18, 1, EASE.in],
          [at + 0.5, 0],
        ]).keys(id, 'rotation', [
          [at, -0.4, EASE.out],
          [at + 0.5, 0.4],
        ])
      }
      return t.build()
    })(),
  },
}
