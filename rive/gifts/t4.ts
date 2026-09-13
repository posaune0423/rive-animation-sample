import { renderAsset, renderFrames } from '../assets'
import { TIER_ARTBOARD, TIER_DURATION_SEC } from '../contract'
import { palette } from '../palette'
import { withAlpha } from '../writer/binary'
import { group, image, linear, rect, scene, shape, solid, type SceneNode } from '../writer/scene'
import { EASE, timeline, type TimelineBuilder } from '../writer/timeline'
import { flipbook, playFlipbook } from './flipbook'
import { range, seeded, sparkle, type GiftDefinition } from './shared'

const { width: W, height: H } = TIER_ARTBOARD[4]
const DUR = TIER_DURATION_SEC[4]

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

const DIAMOND_FRAMES = 24
const TRAIL = 8
const GEM_Y = 330

/** Rendered brilliant-cut stone (24-frame turntable) crossing the frame left → right. */
export const diamond: GiftDefinition = {
  id: 'diamond',
  tier: 4,
  iconRender: 'diamond_f02',
  effect: {
    scene: scene('diamond', W, H, [
      ...edgeLights(),
      ...range(TRAIL).map(i =>
        sparkle(`trail${i}`, -100, GEM_Y, 18 + (i % 3) * 6, solid(withAlpha(palette.ice, 0.85))),
      ),
      group('gift', { x: -140, y: GEM_Y }, [
        flipbook('gem', renderFrames('diamond', DIAMOND_FRAMES), {}, 190),
        sparkle('gemFlash', -30, -34, 44, solid(withAlpha(palette.white, 0.95))),
      ]),
    ]),
    play: (() => {
      const t = edgeLightKeys(timeline('play', DUR))
      // 映像枠の外から、中央を透かして横切り、反対側へ抜ける（2回転しながら）
      t.keys('gift', 'x', [
        [0.8, -140, 'linear'],
        [5.5, W + 140],
      ]).keys('gift', 'y', [
        [0.8, GEM_Y, EASE.inOut],
        [3.15, GEM_Y - 60, EASE.inOut],
        [5.5, GEM_Y],
      ])
      playFlipbook(t, 'gem', DIAMOND_FRAMES, { start: 0.8, end: 5.5, turns: 2 })
      // a facet catches the light every so often
      const flashKeys: Array<readonly [number, number, 'hold' | typeof EASE.out | typeof EASE.in]> =
        [[0, 0, 'hold']]
      for (const at of [1.5, 2.6, 3.7, 4.8]) {
        flashKeys.push([at, 0, EASE.out], [at + 0.15, 1, EASE.in], [at + 0.45, 0, 'hold'])
      }
      t.keys('gemFlash', 'opacity', flashKeys).keys('gemFlash', 'rotation', [
        [0.8, -0.3, 'linear'],
        [5.5, 0.9],
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

/** How far each curtain slides; leaves a fold visible inside the pillars. */
const CURTAIN_TRAVEL = 95

/**
 * Three full-frame renders: night skyline (bottom band + moon), the room frame (rail, pillars,
 * sill) and one velvet curtain panel mirrored for the right side. The curtains part to reveal
 * the window, then close again.
 */
export const suite: GiftDefinition = {
  id: 'suite',
  tier: 4,
  iconRender: 'suite_icon',
  effect: {
    scene: scene('suite', W, H, [
      image('skyline', { x: W / 2, y: H / 2, opacity: 0 }, renderAsset('suite_skyline'), W, {
        transparentCenter: true,
      }),
      image('frame', { x: W / 2, y: H / 2, opacity: 0 }, renderAsset('suite_frame'), W, {
        transparentCenter: true,
      }),
      // curtains cover the center for ~1.8 s at most, then open; excluded from the rest check
      image('curtainL', { x: W / 2, y: H / 2 }, renderAsset('suite_curtain'), W, {
        transparentCenter: true,
      }),
      image('curtainR', { x: W / 2, y: H / 2, scaleX: -1 }, renderAsset('suite_curtain'), W, {
        transparentCenter: true,
      }),
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
        [0.8, W / 2, EASE.inOut],
        [2.6, W / 2 - CURTAIN_TRAVEL, 'hold'],
        [5.5, W / 2 - CURTAIN_TRAVEL, EASE.inOut],
        [7.4, W / 2],
      ]).keys('curtainR', 'x', [
        [0.8, W / 2, EASE.inOut],
        [2.6, W / 2 + CURTAIN_TRAVEL, 'hold'],
        [5.5, W / 2 + CURTAIN_TRAVEL, EASE.inOut],
        [7.4, W / 2],
      ])
      for (const id of ['skyline', 'frame']) {
        t.keys(id, 'opacity', [
          [0.6, 0, EASE.softOut],
          [2.0, 1, 'linear'],
          [6.2, 1, EASE.softIn],
          [7.4, 0],
        ])
      }
      return t.build()
    })(),
  },
}
