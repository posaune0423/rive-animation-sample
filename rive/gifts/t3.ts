import { TIER_ARTBOARD, TIER_DURATION_SEC } from '../contract'
import { palette } from '../palette'
import { withAlpha } from '../writer/binary'
import {
  ellipse,
  group,
  linear,
  path,
  radial,
  rect,
  scene,
  shape,
  solid,
  type Paint,
  type SceneNode,
} from '../writer/scene'
import { EASE, timeline, type TimelineBuilder } from '../writer/timeline'
import { range, seeded, sparkle, type GiftDefinition } from './shared'

const { width: W, height: H } = TIER_ARTBOARD[3]
const DUR = TIER_DURATION_SEC[3]
const CX = W / 2
const CY = H / 2
const ICON = 96

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

const ROSES: ReadonlyArray<readonly [x: number, y: number, r: number]> = [
  [0, -52, 30],
  [-36, -34, 27],
  [36, -34, 27],
  [-18, -10, 25],
  [18, -10, 25],
  [-52, -4, 22],
  [52, -4, 22],
]

const rosePaint = (): Paint =>
  radial(
    [-6, -6],
    [24, 24],
    [
      { position: 0, color: palette.deepRedLight },
      { position: 1, color: palette.deepRed },
    ],
  )

const bouquetParts = (scale: number): SceneNode[] => [
  shape(
    'wrap',
    { x: 0, y: 46 * scale },
    path([
      { x: -62 * scale, y: -40 * scale },
      { x: 62 * scale, y: -40 * scale },
      { x: 0, y: 84 * scale },
    ]),
    solid(palette.wrap),
  ),
  shape('tie', { x: 0, y: 30 * scale }, rect(48 * scale, 10 * scale, 4), solid(palette.gold)),
  ...range(3).map(i =>
    shape(
      `leaf${i}`,
      { x: (i - 1) * 46 * scale, y: 4 * scale, rotation: (i - 1) * 0.5 },
      ellipse(20 * scale, 44 * scale),
      solid(palette.leaf),
    ),
  ),
  ...ROSES.map(([x, y, r], i) =>
    group(`rose${i}`, { x: x * scale, y: y * scale }, [
      shape(`roseOuter${i}`, {}, ellipse(r * 2 * scale), rosePaint()),
      shape(
        `roseInner${i}`,
        { x: 3 * scale, y: 3 * scale },
        ellipse(r * scale),
        solid(palette.deepRed),
      ),
    ]),
  ),
]

export const bouquet: GiftDefinition = {
  id: 'bouquet',
  tier: 3,
  icon: scene('bouquet', ICON, ICON, [
    group('gift', { x: ICON / 2, y: ICON / 2 - 4 }, bouquetParts(0.34)),
  ]),
  effect: {
    scene: scene('bouquet', W, H, [
      group('gift', { x: CX, y: CY }, [
        ...bouquetParts(1),
        ...range(8).map(i =>
          shape(
            `petal${i}`,
            { x: (i - 3.5) * 22, y: -20, opacity: 0, rotation: i * 0.7 },
            ellipse(12, 18),
            solid(withAlpha(palette.deepRedLight, 0.6)),
          ),
        ),
      ]),
    ]),
    play: (() => {
      const t = appearAndFade(timeline('play', DUR), 'gift')
      // 閉じた束が中央で開く
      ROSES.forEach(([x, y], i) => {
        const delay = 0.4 + i * 0.12
        t.keys(`rose${i}`, 'scaleX', [
          [0, 0.55, EASE.out],
          [delay, 0.6, EASE.overshoot],
          [delay + 0.9, 1],
        ])
          .keys(`rose${i}`, 'scaleY', [
            [0, 0.55, EASE.out],
            [delay, 0.6, EASE.overshoot],
            [delay + 0.9, 1],
          ])
          .keys(`rose${i}`, 'x', [
            [0, x * 0.5, EASE.out],
            [delay + 0.9, x],
          ])
          .keys(`rose${i}`, 'y', [
            [0, y * 0.5 + 10, EASE.out],
            [delay + 0.9, y],
          ])
      })
      // 花弁は透ける。映像枠を埋めない
      const rand = seeded(1000)
      range(8).forEach(i => {
        const start = 1.2 + rand() * 1.2
        const x0 = (i - 3.5) * 22
        t.keys(`petal${i}`, 'opacity', [
          [start, 0, EASE.softOut],
          [start + 0.3, 0.6, EASE.softIn],
          [start + 1.6, 0],
        ])
          .keys(`petal${i}`, 'y', [
            [start, -20, EASE.softOut],
            [start + 1.6, -20 - 70 - rand() * 40],
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

const perfumeParts = (scale: number): SceneNode[] => [
  shape(
    'bottle',
    { x: 0, y: 34 * scale },
    rect(92 * scale, 112 * scale, 14 * scale),
    linear(
      [-46 * scale, 0],
      [46 * scale, 0],
      [
        { position: 0, color: withAlpha(palette.amberGlass, 0.95) },
        { position: 0.5, color: withAlpha(palette.champagneLight, 0.85) },
        { position: 1, color: withAlpha(palette.amberGlass, 0.95) },
      ],
    ),
  ),
  shape(
    'liquid',
    { x: 0, y: 48 * scale },
    rect(78 * scale, 72 * scale, 10 * scale),
    solid(palette.amber),
  ),
  shape(
    'rim',
    { x: 0, y: -26 * scale },
    rect(40 * scale, 14 * scale, 3 * scale),
    solid(palette.gold),
  ),
  shape(
    'cap',
    { x: 0, y: -46 * scale },
    rect(30 * scale, 28 * scale, 6 * scale),
    solid(palette.goldDeep),
  ),
  shape(
    'shine',
    { x: -26 * scale, y: 24 * scale, rotation: 0.1 },
    rect(10 * scale, 70 * scale, 5 * scale),
    solid(withAlpha(palette.white, 0.35)),
  ),
]

const MIST = 10

export const perfume: GiftDefinition = {
  id: 'perfume',
  tier: 3,
  icon: scene('perfume', ICON, ICON, [
    group('gift', { x: ICON / 2, y: ICON / 2 - 2 }, perfumeParts(0.42)),
  ]),
  effect: {
    scene: scene('perfume', W, H, [
      group('gift', { x: CX, y: CY }, [
        ...perfumeParts(1),
        ...range(MIST).map(i =>
          shape(
            `mist${i}`,
            { x: 0, y: -70, opacity: 0 },
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
        [0.8, -46, EASE.in],
        [1.0, -40, EASE.out],
        [1.3, -46],
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
            [start, -70, EASE.out],
            [end, -100 - rand() * 60],
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

const ringParts = (scale: number): SceneNode[] => [
  shape('band', { x: 0, y: 14 * scale }, ellipse(120 * scale), undefined, {
    paint: linear(
      [-60 * scale, -60 * scale],
      [60 * scale, 60 * scale],
      [
        { position: 0, color: palette.champagneLight },
        { position: 0.5, color: palette.gold },
        { position: 1, color: palette.goldDeep },
      ],
    ),
    thickness: 16 * scale,
  }),
  shape(
    'prong',
    { x: 0, y: -46 * scale },
    rect(22 * scale, 12 * scale, 3 * scale),
    solid(palette.gold),
  ),
  shape(
    'stone',
    { x: 0, y: -58 * scale },
    ellipse(22 * scale),
    radial(
      [-4 * scale, -4 * scale],
      [11 * scale, 11 * scale],
      [
        { position: 0, color: palette.white },
        { position: 1, color: palette.iceBlue },
      ],
    ),
  ),
]

export const ring: GiftDefinition = {
  id: 'ring',
  tier: 3,
  icon: scene('ring', ICON, ICON, [
    group('gift', { x: ICON / 2, y: ICON / 2 + 2 }, ringParts(0.5)),
  ]),
  effect: {
    scene: scene('ring', W, H, [
      group('gift', { x: CX, y: CY }, [
        group('spin', {}, ringParts(1)),
        sparkle('sparkA', -70, -40, 26, solid(withAlpha(palette.white, 0.95))),
        sparkle('sparkB', 62, 30, 20, solid(withAlpha(palette.white, 0.95))),
        sparkle('sparkC', 10, -90, 16, solid(withAlpha(palette.white, 0.95))),
      ]),
    ]),
    play: (() => {
      const t = appearAndFade(timeline('play', DUR), 'gift')
      // その場でゆっくり1回転（scaleX で奥行きを見せる）。きらめきは点
      t.keys('spin', 'scaleX', [
        [0.4, 1, EASE.inOut],
        [1.2, 0.12, EASE.inOut],
        [2.0, -1, EASE.inOut],
        [2.8, -0.12, EASE.inOut],
        [3.6, 1],
      ])
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
