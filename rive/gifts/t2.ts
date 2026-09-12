import { TIER_ARTBOARD, TIER_DURATION_SEC } from '../contract'
import { palette } from '../palette'
import { withAlpha } from '../writer/binary'
import { ellipse, group, radial, rect, scene, shape, solid, type SceneNode } from '../writer/scene'
import { EASE, timeline, type TimelineBuilder } from '../writer/timeline'
import { range, type GiftDefinition } from './shared'

const { width: W, height: H } = TIER_ARTBOARD[2]
const DUR = TIER_DURATION_SEC[2]
const CX = W / 2
const CY = H / 2

/**
 * T2 template: 0.0–0.3 appear, 0.3–2.2 one short motion, 2.2–3.0 settle back to the rest pose.
 * The last frame equals the static icon so the chat row can swap to the SVG seamlessly.
 */
const appear = (t: TimelineBuilder, root: string): TimelineBuilder =>
  t
    .keys(root, 'opacity', [
      [0, 0, EASE.softOut],
      [0.3, 1],
    ])
    .keys(root, 'scaleX', [
      [0, 0.6, EASE.overshoot],
      [0.3, 1],
    ])
    .keys(root, 'scaleY', [
      [0, 0.6, EASE.overshoot],
      [0.3, 1],
    ])

// ---- お菓子 100 -------------------------------------------------------------

const candyParts = (): SceneNode[] => [
  shape('box', { x: 0, y: 10 }, rect(56, 40, 6), solid(palette.cream)),
  shape('band', { x: 0, y: 10 }, rect(8, 40), solid(palette.gold)),
  group('lid', { x: 0, y: -12 }, [
    shape('lidBody', { x: 0, y: 0 }, rect(62, 14, 5), solid(palette.champagneLight)),
    shape('lidBand', { x: 0, y: 0 }, rect(8, 14), solid(palette.gold)),
    shape('bowL', { x: -9, y: -9 }, ellipse(16, 11), solid(palette.gold)),
    shape('bowR', { x: 9, y: -9 }, ellipse(16, 11), solid(palette.gold)),
    shape('knot', { x: 0, y: -9 }, ellipse(7), solid(palette.goldDeep)),
  ]),
]

export const candy: GiftDefinition = {
  id: 'candy',
  tier: 2,
  icon: scene('candy', W, H, [group('gift', { x: CX, y: CY + 4 }, candyParts())]),
  effect: {
    scene: scene('candy', W, H, [
      shape(
        'glow',
        { x: CX, y: CY - 14, opacity: 0 },
        ellipse(70, 40),
        radial(
          [0, 0],
          [35, 0],
          [
            { position: 0, color: withAlpha(palette.champagneLight, 0.9) },
            { position: 1, color: withAlpha(palette.champagneLight, 0) },
          ],
        ),
      ),
      group('gift', { x: CX, y: CY + 4 }, candyParts()),
    ]),
    play: appear(timeline('play', DUR), 'gift')
      // 蓋がわずかに開いて光る（0.6秒）。箱は跳ねない
      .keys('lid', 'rotation', [
        [0.3, 0, EASE.out],
        [0.9, -0.22, EASE.inOut],
        [1.6, -0.22, EASE.inOut],
        [2.6, 0],
      ])
      .keys('lid', 'y', [
        [0.3, -12, EASE.out],
        [0.9, -18, EASE.inOut],
        [1.6, -18, EASE.inOut],
        [2.6, -12],
      ])
      .keys('glow', 'opacity', [
        [0.3, 0, EASE.softOut],
        [0.9, 0.9, EASE.softIn],
        [2.2, 0],
      ])
      .build(),
  },
}

// ---- シャンパン 300 -------------------------------------------------------------

const bottleParts = (): SceneNode[] => [
  shape('body', { x: 0, y: 16 }, rect(26, 52, 8), solid(palette.bottleGreen)),
  shape('neck', { x: 0, y: -22 }, rect(11, 26, 3), solid(palette.bottleGreen)),
  shape('label', { x: 0, y: 20 }, rect(18, 14, 2), solid(palette.champagne)),
  shape('foil', { x: 0, y: -30 }, rect(13, 12, 3), solid(palette.gold)),
]

const BUBBLES = 6

export const sparkling: GiftDefinition = {
  id: 'sparkling',
  tier: 2,
  icon: scene('sparkling', W, H, [group('gift', { x: CX, y: CY + 2 }, bottleParts())]),
  effect: {
    scene: scene('sparkling', W, H, [
      group('gift', { x: CX, y: CY + 2 }, [
        ...bottleParts(),
        shape('cork', { x: 0, y: -40 }, rect(12, 9, 3), solid(palette.goldDeep)),
        ...range(BUBBLES).map(i =>
          shape(
            `bubble${i}`,
            { x: (i % 3) * 6 - 6, y: -42, opacity: 0 },
            ellipse(4 + (i % 3) * 2),
            solid(withAlpha(palette.champagneLight, 0.9)),
          ),
        ),
      ]),
    ]),
    play: (() => {
      const t = appear(timeline('play', DUR), 'gift')
      // 短い開栓: コルクが跳ねて戻る
      t.keys('cork', 'y', [
        [0.3, -40, EASE.out],
        [0.6, -52, EASE.in],
        [0.9, -40],
      ]).keys('cork', 'rotation', [
        [0.3, 0, EASE.out],
        [0.6, 0.35, EASE.in],
        [0.9, 0],
      ])
      // 泡が枠の中を上がって消える
      range(BUBBLES).forEach(i => {
        const start = 0.45 + i * 0.22
        const end = Math.min(start + 1.1, 2.2)
        const x0 = (i % 3) * 6 - 6
        t.keys(`bubble${i}`, 'opacity', [
          [start, 0, EASE.softOut],
          [start + 0.15, 0.9, EASE.softIn],
          [end, 0],
        ])
          .keys(`bubble${i}`, 'y', [
            [start, -42, EASE.softOut],
            [end, -46 - 22 - (i % 2) * 6],
          ])
          .keys(`bubble${i}`, 'x', [
            [start, x0, EASE.inOut],
            [end, x0 + (i % 2 === 0 ? 6 : -6)],
          ])
      })
      return t.build()
    })(),
  },
}

// ---- ぬいぐるみ 500 -------------------------------------------------------------

const plushParts = (): SceneNode[] => [
  shape('earL', { x: -14, y: -26 }, ellipse(14, 16), solid(palette.furDeep)),
  shape('earR', { x: 14, y: -26 }, ellipse(14, 16), solid(palette.furDeep)),
  shape('bodyPlush', { x: 0, y: 14 }, ellipse(44, 40), solid(palette.fur)),
  shape('head', { x: 0, y: -12 }, ellipse(38, 34), solid(palette.fur)),
  shape('muzzle', { x: 0, y: -6 }, ellipse(16, 11), solid(palette.cream)),
  shape('eyeL', { x: -8, y: -14 }, ellipse(4), solid(palette.wrap)),
  shape('eyeR', { x: 8, y: -14 }, ellipse(4), solid(palette.wrap)),
  shape('nose', { x: 0, y: -8 }, ellipse(4, 3), solid(palette.wrap)),
]

export const plush: GiftDefinition = {
  id: 'plush',
  tier: 2,
  icon: scene('plush', W, H, [group('gift', { x: CX, y: CY + 6 }, plushParts())]),
  effect: {
    scene: scene('plush', W, H, [
      // 回転軸を足元に置くため、原点を下にずらしたグループで揺らす
      group('gift', { x: CX, y: CY + 6 }, [
        group('sway', { x: 0, y: 30 }, [group('body', { x: 0, y: -30 }, plushParts())]),
      ]),
    ]),
    // 軽く一度揺れる（お辞儀程度）
    play: appear(timeline('play', DUR), 'gift')
      .keys('sway', 'rotation', [
        [0.3, 0, EASE.inOut],
        [0.8, 0.14, EASE.inOut],
        [1.5, -0.1, EASE.inOut],
        [2.2, 0],
      ])
      .build(),
  },
}
