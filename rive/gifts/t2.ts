import { renderAsset } from '../assets'
import { TIER_ARTBOARD, TIER_DURATION_SEC } from '../contract'
import { palette } from '../palette'
import { withAlpha } from '../writer/binary'
import { ellipse, group, image, radial, scene, shape, solid } from '../writer/scene'
import { EASE, timeline, type TimelineBuilder } from '../writer/timeline'
import { range, type GiftDefinition } from './shared'

const { width: W, height: H } = TIER_ARTBOARD[2]
const DUR = TIER_DURATION_SEC[2]
const CX = W / 2
const CY = H / 2
/** Rendered parts share one camera, so every part is placed at the same point and width. */
const ART = 92

/**
 * T2 template: 0.0–0.3 appear, 0.3–2.2 one short motion, 2.2–3.0 settle back to the rest pose.
 * The last frame equals the static icon so the chat row can swap to the WebP seamlessly.
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

const glow = (id: string, y: number, w: number, h: number) =>
  shape(
    id,
    { x: CX, y, opacity: 0 },
    ellipse(w, h),
    radial(
      [0, 0],
      [w / 2, 0],
      [
        { position: 0, color: withAlpha(palette.champagneLight, 0.9) },
        { position: 1, color: withAlpha(palette.champagneLight, 0) },
      ],
    ),
  )

// ---- お菓子 100 -------------------------------------------------------------

export const candy: GiftDefinition = {
  id: 'candy',
  tier: 2,
  iconRender: 'candy',
  effect: {
    scene: scene('candy', W, H, [
      glow('glow', CY - 16, 80, 46),
      group('gift', { x: CX, y: CY }, [
        image('box', {}, renderAsset('candy_box'), ART),
        // lid pivots around its back edge: group sits at the hinge, image is offset back
        group('lid', { x: 0, y: -14 }, [
          image('lidImg', { x: 0, y: 14 }, renderAsset('candy_lid'), ART),
        ]),
      ]),
    ]),
    // 蓋がわずかに開いて光る（0.6秒）。箱は跳ねない
    play: appear(timeline('play', DUR), 'gift')
      .keys('lid', 'rotation', [
        [0.3, 0, EASE.out],
        [0.9, -0.2, EASE.inOut],
        [1.6, -0.2, EASE.inOut],
        [2.6, 0],
      ])
      .keys('lid', 'y', [
        [0.3, -14, EASE.out],
        [0.9, -22, EASE.inOut],
        [1.6, -22, EASE.inOut],
        [2.6, -14],
      ])
      .keys('glow', 'opacity', [
        [0.3, 0, EASE.softOut],
        [0.9, 1, EASE.softIn],
        [2.2, 0],
      ])
      .build(),
  },
}

// ---- シャンパン 300 -------------------------------------------------------------

const BUBBLES = 7

export const sparkling: GiftDefinition = {
  id: 'sparkling',
  tier: 2,
  iconRender: 'sparkling',
  effect: {
    scene: scene('sparkling', W, H, [
      group('gift', { x: CX, y: CY }, [
        image('bottle', {}, renderAsset('sparkling_bottle'), ART),
        image('cork', {}, renderAsset('sparkling_cork'), ART),
        ...range(BUBBLES).map(i =>
          shape(
            `bubble${i}`,
            { x: (i % 3) * 5 - 5, y: -40, opacity: 0 },
            ellipse(3 + (i % 3) * 1.5),
            solid(withAlpha(palette.champagneLight, 0.9)),
          ),
        ),
      ]),
    ]),
    play: (() => {
      const t = appear(timeline('play', DUR), 'gift')
      // 短い開栓: コルクが跳ねて戻る
      t.keys('cork', 'y', [
        [0.3, 0, EASE.out],
        [0.6, -14, EASE.in],
        [0.95, 0],
      ]).keys('cork', 'rotation', [
        [0.3, 0, EASE.out],
        [0.6, 0.3, EASE.in],
        [0.95, 0],
      ])
      // 泡が枠の中を上がって消える
      range(BUBBLES).forEach(i => {
        const start = 0.45 + i * 0.2
        const end = Math.min(start + 1.1, 2.2)
        const x0 = (i % 3) * 5 - 5
        t.keys(`bubble${i}`, 'opacity', [
          [start, 0, EASE.softOut],
          [start + 0.15, 0.9, EASE.softIn],
          [end, 0],
        ])
          .keys(`bubble${i}`, 'y', [
            [start, -40, EASE.softOut],
            [end, -40 - 26 - (i % 2) * 6],
          ])
          .keys(`bubble${i}`, 'x', [
            [start, x0, EASE.inOut],
            [end, x0 + (i % 2 === 0 ? 7 : -7)],
          ])
      })
      return t.build()
    })(),
  },
}

// ---- ぬいぐるみ 500 -------------------------------------------------------------

export const plush: GiftDefinition = {
  id: 'plush',
  tier: 2,
  iconRender: 'plush',
  effect: {
    scene: scene('plush', W, H, [
      // 回転軸を足元に置くため、原点を下にずらしたグループで揺らす
      group('gift', { x: CX, y: CY }, [
        group('sway', { x: 0, y: 40 }, [
          image('bear', { x: 0, y: -40 }, renderAsset('plush'), ART),
        ]),
      ]),
    ]),
    // 軽く一度揺れる（お辞儀程度）
    play: appear(timeline('play', DUR), 'gift')
      .keys('sway', 'rotation', [
        [0.3, 0, EASE.inOut],
        [0.8, 0.13, EASE.inOut],
        [1.5, -0.09, EASE.inOut],
        [2.2, 0],
      ])
      .build(),
  },
}
