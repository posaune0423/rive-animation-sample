import { TIER_ARTBOARD, TIER_DURATION_SEC } from '../contract'
import { palette } from '../palette'
import { withAlpha } from '../writer/binary'
import {
  ellipse,
  group,
  polygon,
  radial,
  rect,
  scene,
  shape,
  solid,
  type SceneNode,
} from '../writer/scene'
import { EASE, timeline } from '../writer/timeline'
import { range, seeded, sparkle, type GiftDefinition } from './shared'

const { width: W, height: H } = TIER_ARTBOARD[5]
const DUR = TIER_DURATION_SEC[5]
const ICON = 96

/**
 * T5: 0.0–1.5 only light, things still small. 1.5–8.0 the subject; the center stays see-through.
 * 8.0–12.0 slow fade, the lingering is part of the price.
 */

// ---- 夜の宮殿 100,000 -------------------------------------------------------------

type Win = { readonly id: string; readonly x: number; readonly y: number }

const palaceWindows = (): Win[] => {
  const wins: Win[] = []
  range(5).forEach(row =>
    range(3).forEach(col =>
      wins.push({ id: `wc${row}${col}`, x: 195 + (col - 1) * 20, y: 560 + row * 36 }),
    ),
  )
  range(2).forEach(row =>
    range(6).forEach(col =>
      wins.push({ id: `wb${row}${col}`, x: 195 + (col - 2.5) * 46, y: 712 + row * 40 }),
    ),
  )
  range(4).forEach(row => {
    wins.push({ id: `wl${row}`, x: 90, y: 620 + row * 40 })
    wins.push({ id: `wr${row}`, x: 300, y: 620 + row * 40 })
  })
  return wins
}

const palaceParts = (scale: number, withWindows: boolean): SceneNode[] => {
  const s = scale
  const body = withAlpha(palette.nightBlue, 0.92)
  const parts: SceneNode[] = [
    shape('body', { x: 195 * s, y: 770 * s }, rect(300 * s, 200 * s, 6 * s), solid(body)),
    shape('towerL', { x: 90 * s, y: 700 * s }, rect(58 * s, 240 * s, 4 * s), solid(body)),
    shape('towerR', { x: 300 * s, y: 700 * s }, rect(58 * s, 240 * s, 4 * s), solid(body)),
    shape('towerC', { x: 195 * s, y: 650 * s }, rect(74 * s, 330 * s, 4 * s), solid(body)),
    shape(
      'roofL',
      { x: 90 * s, y: 548 * s },
      polygon(78 * s, 70 * s, 3),
      solid(withAlpha(palette.night, 0.95)),
    ),
    shape(
      'roofR',
      { x: 300 * s, y: 548 * s },
      polygon(78 * s, 70 * s, 3),
      solid(withAlpha(palette.night, 0.95)),
    ),
    shape(
      'roofC',
      { x: 195 * s, y: 452 * s },
      polygon(96 * s, 80 * s, 3),
      solid(withAlpha(palette.night, 0.95)),
    ),
    shape('spire', { x: 195 * s, y: 400 * s }, rect(4 * s, 40 * s), solid(palette.gold)),
    shape(
      'gate',
      { x: 195 * s, y: 830 * s },
      rect(44 * s, 80 * s, 20 * s),
      solid(withAlpha(palette.gold, 0.9)),
    ),
  ]
  if (withWindows) {
    for (const w of palaceWindows()) {
      parts.push(
        shape(
          w.id,
          { x: w.x * s, y: w.y * s, opacity: 0 },
          rect(9 * s, 15 * s, 2 * s),
          solid(palette.champagne),
        ),
      )
    }
  }
  return parts
}

const PALACE_DUST = 24

export const palace: GiftDefinition = {
  id: 'palace',
  tier: 5,
  icon: scene('palace', ICON, ICON, [
    // 建物だけを収める（下端を切る）
    group('gift', { x: 0, y: -46 }, palaceParts(0.2, false)),
    shape('iconMoon', { x: 20, y: 22 }, ellipse(12), solid(palette.moon)),
  ]),
  effect: {
    scene: scene('palace', W, H, [
      shape(
        'glow',
        { x: W / 2, y: 820, opacity: 0 },
        ellipse(620, 360),
        radial(
          [0, 0],
          [310, 0],
          [
            { position: 0, color: withAlpha(palette.champagneLight, 0.6) },
            { position: 1, color: withAlpha(palette.champagneLight, 0) },
          ],
        ),
      ),
      shape(
        'moonHalo',
        { x: 70, y: 110, opacity: 0 },
        ellipse(120),
        solid(withAlpha(palette.moon, 0.15)),
      ),
      shape(
        'moon',
        { x: 70, y: 110, opacity: 0 },
        ellipse(48),
        solid(withAlpha(palette.moon, 0.9)),
      ),
      ...range(PALACE_DUST).map(i =>
        shape(
          `dust${i}`,
          { x: 0, y: 900, opacity: 0 },
          ellipse(3 + (i % 3) * 2),
          solid(withAlpha(palette.champagne, 0.85)),
        ),
      ),
      group('palace', { x: 0, y: 460 }, palaceParts(1, true)),
    ]),
    play: (() => {
      const t = timeline('play', DUR)
      t.keys('root', 'opacity', [
        [0, 1, 'hold'],
        [8.5, 1, EASE.softIn],
        [12, 0],
      ])
      // 0–1.5 余白。光だけ
      t.keys('glow', 'opacity', [
        [0, 0, EASE.softOut],
        [1.5, 0.6, EASE.inOut],
        [6.5, 1, 'linear'],
        [8.5, 1],
      ])
      for (const id of ['moon', 'moonHalo']) {
        t.keys(id, 'opacity', [
          [0.4, 0, EASE.softOut],
          [2.0, 1],
        ])
      }
      // 下から宮殿がせり上がる
      t.keys('palace', 'y', [
        [1.5, 460, EASE.out],
        [4.2, 0],
      ])
      // 窓が次々点灯
      const rand = seeded(100_000)
      const wins = palaceWindows()
      wins.forEach((w, i) => {
        const at = 3.2 + (i / wins.length) * 3.6 + rand() * 0.15
        t.keys(w.id, 'opacity', [
          [at, 0, EASE.out],
          [at + 0.25, 1, EASE.inOut],
          [at + 0.6, 0.75, EASE.inOut],
          [at + 1.0, 1],
        ])
      })
      // 星や光の粒子が周囲を舞う
      range(PALACE_DUST).forEach(i => {
        const start = 1.8 + rand() * 5.5
        const life = 2.2 + rand() * 1.8
        const x0 = 20 + rand() * (W - 40)
        t.keys(`dust${i}`, 'x', [
          [start, x0, EASE.inOut],
          [start + life, x0 + (rand() - 0.5) * 80],
        ])
          .keys(`dust${i}`, 'y', [
            [start, 860, EASE.softOut],
            [start + life, 300 + rand() * 350],
          ])
          .keys(`dust${i}`, 'opacity', [
            [start, 0, EASE.softOut],
            [start + 0.3, 1, EASE.softIn],
            [start + life, 0],
          ])
      })
      return t.build()
    })(),
  },
}

// ---- 神話 300,000 -------------------------------------------------------------

const RINGS = 4
const DUST = 44
const RAIN = 12
const FLARES = 4
const CENTER_Y = 400

const ringStroke = (thickness: number) => ({
  paint: solid(withAlpha(palette.gold, 0.9)),
  thickness,
})

export const myth: GiftDefinition = {
  id: 'myth',
  tier: 5,
  icon: scene('myth', ICON, ICON, [
    shape('iconRing', { x: 48, y: 50 }, ellipse(56), undefined, ringStroke(5)),
    shape('iconRing2', { x: 48, y: 50 }, ellipse(34), undefined, ringStroke(3)),
    sparkle('iconStar', 48, 50, 30, solid(palette.champagneLight)),
    sparkle('iconStarS', 72, 26, 14, solid(palette.champagne)),
    sparkle('iconStarT', 24, 74, 10, solid(palette.champagne)),
  ]),
  effect: {
    scene: scene('myth', W, H, [
      shape(
        'glow',
        { x: W / 2, y: CENTER_Y, opacity: 0 },
        ellipse(640),
        radial(
          [0, 0],
          [320, 0],
          [
            { position: 0, color: withAlpha(palette.champagneLight, 0.55) },
            { position: 0.55, color: withAlpha(palette.gold, 0.18) },
            { position: 1, color: withAlpha(palette.gold, 0) },
          ],
        ),
      ),
      ...range(RINGS).map(i =>
        shape(
          `ring${i}`,
          { x: W / 2, y: CENTER_Y, opacity: 0, scaleX: 0.2, scaleY: 0.2 },
          ellipse(240),
          undefined,
          ringStroke(6 - i),
        ),
      ),
      ...range(DUST).map(i =>
        shape(
          `dust${i}`,
          { x: -40, y: 0, opacity: 0 },
          ellipse(3 + (i % 4) * 1.5),
          solid(withAlpha(i % 3 === 0 ? palette.champagneLight : palette.champagne, 0.9)),
        ),
      ),
      ...range(RAIN).map(i =>
        sparkle(`rain${i}`, 0, -40, 14 + (i % 3) * 6, solid(withAlpha(palette.white, 0.95))),
      ),
      ...range(FLARES).map(i =>
        sparkle(
          `flare${i}`,
          i % 2 === 0 ? 50 : W - 50,
          i < 2 ? 120 : H - 140,
          70,
          solid(withAlpha(palette.champagneLight, 0.95)),
        ),
      ),
    ]),
    play: (() => {
      const t = timeline('play', DUR)
      t.keys('root', 'opacity', [
        [0, 1, 'hold'],
        [8.6, 1, EASE.softIn],
        [12, 0],
      ])
      // 光の輪が中央から広がる。8秒付近がいちばん明るい
      t.keys('glow', 'opacity', [
        [0, 0, EASE.softOut],
        [1.5, 0.35, EASE.inOut],
        [8.0, 1, 'linear'],
        [8.6, 1],
      ])
      range(RINGS).forEach(i => {
        const at = 1.5 + i * 1.3
        const life = 3.2
        t.keys(`ring${i}`, 'scaleX', [
          [at, 0.2, EASE.out],
          [at + life, 3.4],
        ])
          .keys(`ring${i}`, 'scaleY', [
            [at, 0.2, EASE.out],
            [at + life, 3.4],
          ])
          .keys(`ring${i}`, 'opacity', [
            [at, 0, EASE.out],
            [at + 0.3, 0.9, EASE.softIn],
            [at + life, 0],
          ])
      })
      // 金の粒子が画面を横切る（顔の上を通ってよい）
      const rand = seeded(300_000)
      range(DUST).forEach(i => {
        const start = 1.5 + rand() * 6.0
        const life = 2.4 + rand() * 2.2
        const y0 = 80 + rand() * 720
        const dir = i % 4 === 0 ? -1 : 1
        const x0 = dir === 1 ? -40 : W + 40
        t.keys(`dust${i}`, 'x', [
          [start, x0, EASE.inOut],
          [start + life, x0 + dir * (W + 80)],
        ])
          .keys(`dust${i}`, 'y', [
            [start, y0, EASE.inOut],
            [start + life, y0 - 40 - rand() * 80],
          ])
          .keys(`dust${i}`, 'opacity', [
            [start, 0, EASE.softOut],
            [start + 0.4, 1, 'linear'],
            [start + life - 0.5, 1, EASE.softIn],
            [start + life, 0],
          ])
      })
      // 星の雨
      range(RAIN).forEach(i => {
        const start = 3.5 + rand() * 4.5
        const life = 1.8 + rand() * 1.0
        const x0 = 20 + rand() * (W - 40)
        t.keys(`rain${i}`, 'x', [
          [start, x0, 'linear'],
          [start + life, x0 + 60],
        ])
          .keys(`rain${i}`, 'y', [
            [start, -40, EASE.in],
            [start + life, H + 60],
          ])
          .keys(`rain${i}`, 'rotation', [
            [start, 0, 'linear'],
            [start + life, 1.2],
          ])
          .keys(`rain${i}`, 'opacity', [
            [start, 0, EASE.out],
            [start + 0.3, 1, 'linear'],
            [start + life - 0.3, 1, EASE.in],
            [start + life, 0],
          ])
      })
      // 四隅のフレアはピークで
      range(FLARES).forEach(i => {
        const at = 7.2 + i * 0.25
        t.keys(`flare${i}`, 'opacity', [
          [0, 0, 'hold'],
          [at, 0, EASE.out],
          [at + 0.4, 1, EASE.softIn],
          [at + 1.8, 0],
        ]).keys(`flare${i}`, 'rotation', [
          [at, -0.5, 'linear'],
          [at + 1.8, 0.5],
        ])
      })
      return t.build()
    })(),
  },
}
