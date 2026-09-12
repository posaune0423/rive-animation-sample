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
  type SceneNode,
} from '../writer/scene'
import { EASE, timeline, type TimelineBuilder } from '../writer/timeline'
import { range, seeded, sparkle, type GiftDefinition } from './shared'

const { width: W, height: H } = TIER_ARTBOARD[4]
const DUR = TIER_DURATION_SEC[4]
const ICON = 96

/**
 * T4 template: 0.0–0.8 light comes in from the edges (center still empty),
 * 0.8–5.5 something crosses the frame or the room frame opens, 5.5–8.0 light returns to the
 * edges and fades. The video stays visible the whole time; nothing opaque sits on the face.
 */
const edgeLights = (): SceneNode[] => [
  shape(
    'edgeL',
    { x: 30, y: H / 2, opacity: 0 },
    rect(60, H),
    linear(
      [-30, 0],
      [30, 0],
      [
        { position: 0, color: withAlpha(palette.ice, 0.45) },
        { position: 1, color: withAlpha(palette.ice, 0) },
      ],
    ),
  ),
  shape(
    'edgeR',
    { x: W - 30, y: H / 2, opacity: 0 },
    rect(60, H),
    linear(
      [30, 0],
      [-30, 0],
      [
        { position: 0, color: withAlpha(palette.ice, 0.45) },
        { position: 1, color: withAlpha(palette.ice, 0) },
      ],
    ),
  ),
]

const edgeLightKeys = (t: TimelineBuilder): TimelineBuilder => {
  for (const id of ['edgeL', 'edgeR']) {
    t.keys(id, 'opacity', [
      [0, 0, EASE.softOut],
      [0.8, 1, 'linear'],
      [5.5, 1, EASE.softIn],
      [8.0, 0],
    ])
  }
  return t
}

// ---- ダイヤ 10,000 -------------------------------------------------------------

const gemParts = (scale: number): SceneNode[] => {
  const s = scale
  return [
    shape(
      'gem',
      {},
      path([
        { x: -36 * s, y: -50 * s },
        { x: 36 * s, y: -50 * s },
        { x: 62 * s, y: -18 * s },
        { x: 0, y: 72 * s },
        { x: -62 * s, y: -18 * s },
      ]),
      linear(
        [-60 * s, -50 * s],
        [60 * s, 70 * s],
        [
          { position: 0, color: palette.white },
          { position: 0.45, color: palette.ice },
          { position: 1, color: palette.iceBlue },
        ],
      ),
    ),
    shape(
      'facetL',
      {},
      path([
        { x: -62 * s, y: -18 * s },
        { x: -20 * s, y: -18 * s },
        { x: 0, y: 72 * s },
      ]),
      solid(withAlpha(palette.white, 0.45)),
    ),
    shape(
      'facetTop',
      {},
      path([
        { x: -36 * s, y: -50 * s },
        { x: 36 * s, y: -50 * s },
        { x: 20 * s, y: -18 * s },
        { x: -20 * s, y: -18 * s },
      ]),
      solid(withAlpha(palette.white, 0.35)),
    ),
    shape(
      'glint',
      { x: -18 * s, y: -34 * s },
      ellipse(10 * s, 6 * s),
      solid(withAlpha(palette.white, 0.9)),
    ),
  ]
}

const TRAIL = 8
const GEM_Y = 330

export const diamond: GiftDefinition = {
  id: 'diamond',
  tier: 4,
  icon: scene('diamond', ICON, ICON, [
    group('gift', { x: ICON / 2, y: ICON / 2 - 4 }, gemParts(0.6)),
  ]),
  effect: {
    scene: scene('diamond', W, H, [
      ...edgeLights(),
      ...range(TRAIL).map(i =>
        sparkle(`trail${i}`, -100, GEM_Y, 18 + (i % 3) * 6, solid(withAlpha(palette.ice, 0.85))),
      ),
      group('gift', { x: -140, y: GEM_Y }, gemParts(0.9)),
    ]),
    play: (() => {
      const t = edgeLightKeys(timeline('play', DUR))
      // 映像枠の外から、中央を透かして横切り、反対側へ抜ける
      t.keys('gift', 'x', [
        [0.8, -140, EASE.inOut],
        [5.5, W + 140],
      ])
        .keys('gift', 'y', [
          [0.8, GEM_Y, EASE.inOut],
          [3.15, GEM_Y - 60, EASE.inOut],
          [5.5, GEM_Y],
        ])
        .keys('gift', 'rotation', [
          [0.8, -0.35, 'linear'],
          [5.5, 0.35],
        ])
      // 通ったあとの光は2秒以内
      const rand = seeded(10_000)
      range(TRAIL).forEach(i => {
        const at = 1.2 + (i / TRAIL) * 4.0
        const x = -140 + ((W + 280) * (at - 0.8)) / 4.7
        const y = GEM_Y - 60 * Math.sin(((at - 0.8) / 4.7) * Math.PI) + (rand() - 0.5) * 60
        t.keys(`trail${i}`, 'x', [[0, x, 'hold']])
          .keys(`trail${i}`, 'y', [
            [at, y, EASE.softOut],
            [at + 1.4, y + 30],
          ])
          .keys(`trail${i}`, 'opacity', [
            [0, 0, 'hold'],
            [at, 0, EASE.out],
            [at + 0.2, 1, EASE.softIn],
            [at + 1.4, 0],
          ])
          .keys(`trail${i}`, 'rotation', [
            [at, 0, 'linear'],
            [at + 1.4, 0.8],
          ])
      })
      return t.build()
    })(),
  },
}

// ---- スイートルーム 30,000 -------------------------------------------------------------

const CITY_LIGHTS = 14
const STARS = 10

const roomIconParts = (): SceneNode[] => [
  shape('winFrame', { x: 0, y: 0 }, rect(64, 60, 6), solid(palette.amber)),
  shape('winGlass', { x: 0, y: 0 }, rect(52, 48, 4), solid(palette.nightBlue)),
  shape('winMoon', { x: 12, y: -10 }, ellipse(12), solid(palette.moon)),
  shape('winBar', { x: 0, y: 0 }, rect(4, 48), solid(palette.amber)),
  shape('winSill', { x: 0, y: 30 }, rect(70, 8, 3), solid(palette.amberDeep)),
]

export const suite: GiftDefinition = {
  id: 'suite',
  tier: 4,
  icon: scene('suite', ICON, ICON, [group('gift', { x: ICON / 2, y: ICON / 2 }, roomIconParts())]),
  effect: {
    scene: scene('suite', W, H, [
      // 窓の外の夜（枠の外周にだけ置く）
      shape(
        'moon',
        { x: 320, y: 100, opacity: 0 },
        ellipse(56),
        solid(withAlpha(palette.moon, 0.85)),
      ),
      ...range(STARS).map(i =>
        shape(
          `star${i}`,
          {
            x: (i % 5) * 70 + 40 + (i > 4 ? 25 : 0),
            y: 40 + (i > 4 ? 60 : 0) + (i % 3) * 14,
            opacity: 0,
          },
          ellipse(4 + (i % 2) * 2),
          solid(withAlpha(palette.ice, 0.9)),
        ),
      ),
      shape(
        'cityGlow',
        { x: W / 2, y: 790, opacity: 0 },
        ellipse(W + 80, 220),
        radial(
          [0, 0],
          [W / 2 + 40, 0],
          [
            { position: 0, color: withAlpha(palette.amber, 0.45) },
            { position: 1, color: withAlpha(palette.amber, 0) },
          ],
        ),
      ),
      ...range(CITY_LIGHTS).map(i =>
        shape(
          `city${i}`,
          { x: 18 + i * 27, y: 720 + (i % 4) * 22, opacity: 0 },
          rect(8, 12, 1),
          solid(withAlpha(palette.champagne, 0.85)),
        ),
      ),
      // 部屋の枠（窓枠とカーテンレール）
      shape(
        'rail',
        { x: W / 2, y: 22, opacity: 0 },
        rect(W - 40, 10, 4),
        solid(withAlpha(palette.gold, 0.7)),
      ),
      shape(
        'pillarL',
        { x: 22, y: H / 2, opacity: 0 },
        rect(24, H),
        solid(withAlpha(palette.amberDeep, 0.55)),
      ),
      shape(
        'pillarR',
        { x: W - 22, y: H / 2, opacity: 0 },
        rect(24, H),
        solid(withAlpha(palette.amberDeep, 0.55)),
      ),
      shape(
        'sill',
        { x: W / 2, y: H - 30, opacity: 0 },
        rect(W, 40),
        solid(withAlpha(palette.amberDeep, 0.6)),
      ),
      // カーテン（半透明。開いて中央を空ける）
      shape(
        'curtainL',
        { x: 100, y: H / 2 },
        rect(200, H),
        linear(
          [-100, 0],
          [100, 0],
          [
            { position: 0, color: withAlpha(palette.amber, 0.3) },
            { position: 1, color: withAlpha(palette.amberDeep, 0.2) },
          ],
        ),
      ),
      shape(
        'curtainR',
        { x: W - 100, y: H / 2 },
        rect(200, H),
        linear(
          [100, 0],
          [-100, 0],
          [
            { position: 0, color: withAlpha(palette.amber, 0.3) },
            { position: 1, color: withAlpha(palette.amberDeep, 0.2) },
          ],
        ),
      ),
    ]),
    play: (() => {
      const t = timeline('play', DUR)
      t.keys('root', 'opacity', [
        [0, 0, EASE.softOut],
        [0.8, 1, 'linear'],
        [7.0, 1, EASE.softIn],
        [8.0, 0],
      ])
      // 左右から枠が開き、窓の夜景が奥に見える。8秒で枠が閉じる
      t.keys('curtainL', 'x', [
        [0.8, 100, EASE.inOut],
        [2.6, -80, 'hold'],
        [5.5, -80, EASE.inOut],
        [7.4, 100],
      ]).keys('curtainR', 'x', [
        [0.8, W - 100, EASE.inOut],
        [2.6, W + 80, 'hold'],
        [5.5, W + 80, EASE.inOut],
        [7.4, W - 100],
      ])
      for (const id of ['rail', 'pillarL', 'pillarR', 'sill', 'cityGlow', 'moon']) {
        t.keys(id, 'opacity', [
          [0.8, 0, EASE.softOut],
          [2.4, 1, 'linear'],
          [5.8, 1, EASE.softIn],
          [7.2, 0],
        ])
      }
      const rand = seeded(30_000)
      range(STARS).forEach(i => {
        const at = 1.6 + rand() * 1.2
        t.keys(`star${i}`, 'opacity', [
          [at, 0, EASE.softOut],
          [at + 0.4, 1, EASE.inOut],
          [at + 1.6, 0.5, EASE.inOut],
          [at + 2.8, 1, EASE.softIn],
          [6.6, 0],
        ])
      })
      range(CITY_LIGHTS).forEach(i => {
        const at = 1.8 + rand() * 1.0
        const dim = 0.3 + rand() * 0.4
        t.keys(`city${i}`, 'opacity', [
          [at, 0, EASE.softOut],
          [at + 0.3, 1, EASE.inOut],
          [at + 1.2, dim, EASE.inOut],
          [at + 2.4, 1, EASE.inOut],
          [at + 3.2, dim, EASE.softIn],
          [6.8, 0],
        ])
      })
      return t.build()
    })(),
  },
}
