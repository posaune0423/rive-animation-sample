import { renderAsset } from '../assets'
import { TIER_ARTBOARD, TIER_DURATION_SEC } from '../contract'
import { palette } from '../palette'
import { withAlpha } from '../writer/binary'
import { ellipse, group, image, radial, scene, shape, solid } from '../writer/scene'
import { EASE, timeline } from '../writer/timeline'
import { range, seeded, sparkle, type GiftDefinition } from './shared'

const { width: W, height: H } = TIER_ARTBOARD[5]
const DUR = TIER_DURATION_SEC[5]

/**
 * T5: 0.0–1.5 only light, things still small. 1.5–8.0 the subject; the center stays see-through.
 * 8.0–12.0 slow fade, the lingering is part of the price.
 */

// ---- 夜の宮殿 100,000 -------------------------------------------------------------

const PALACE_DUST = 28
/** The render is 13:18; drawn at full width its sky half is transparent and the towers stay below 58 %. */
const PALACE_W = W
const PALACE_H = (PALACE_W * 720) / 520
const PALACE_TOP = H - PALACE_H

/** Rendered night palace (emissive windows baked in) rising from the bottom, gold dust around. */
export const palace: GiftDefinition = {
  id: 'palace',
  tier: 5,
  iconRender: 'palace',
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
      ...range(PALACE_DUST).map(i =>
        shape(
          `dust${i}`,
          { x: 0, y: 900, opacity: 0 },
          ellipse(3 + (i % 3) * 2),
          solid(withAlpha(palette.champagne, 0.85)),
        ),
      ),
      // starts fully below the frame, rises until its roofline touches the face-safe line
      group('palace', { x: 0, y: H - PALACE_TOP }, [
        image(
          'palaceImg',
          { x: W / 2, y: PALACE_TOP + PALACE_H / 2 },
          renderAsset('palace'),
          PALACE_W,
          {
            transparentCenter: true,
          },
        ),
      ]),
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
      // 下から宮殿がせり上がる
      t.keys('palace', 'y', [
        [1.5, H - PALACE_TOP, EASE.out],
        [4.6, 0],
      ])
      // 星や光の粒子が周囲を舞う
      const rand = seeded(100_000)
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

/**
 * A rendered gold medallion turns slowly behind the streamer as a translucent halo (never more
 * than 30 % opaque over the face), while vector light rings expand and gold dust streams across.
 */
export const myth: GiftDefinition = {
  id: 'myth',
  tier: 5,
  iconRender: 'myth_medallion',
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
      group('medallion', { x: W / 2, y: CENTER_Y, opacity: 0, scaleX: 0.6, scaleY: 0.6 }, [
        image('medallionImg', {}, renderAsset('myth_medallion'), 560),
      ]),
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
      // 金のメダリオンが奥でゆっくり回り、透けたまま大きくなる
      t.keys('medallion', 'opacity', [
        [0.8, 0, EASE.softOut],
        [2.5, 0.25, 'linear'],
        [8.0, 0.3, EASE.softIn],
        [11.5, 0],
      ])
        .keys('medallion', 'rotation', [
          [0, 0, 'linear'],
          [12, 0.9],
        ])
        .keys('medallion', 'scaleX', [
          [0.8, 0.6, EASE.softOut],
          [8.0, 1.15],
        ])
        .keys('medallion', 'scaleY', [
          [0.8, 0.6, EASE.softOut],
          [8.0, 1.15],
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
