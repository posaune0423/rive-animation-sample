import { describe, expect, it } from 'vitest'
import { hex } from './binary'
import { ellipse, group, image, rect, scene, shape, solid, type ImageAsset } from './scene'
import { EASE, timeline } from './timeline'
import { compileProp, sampleKeys, toLottie, type LottieProp } from './toLottie'

const keyed = (prop: LottieProp) => {
  if (prop.a !== 1) throw new Error('expected an animated property')
  return prop.k
}

const ball = () =>
  scene('Gift', 500, 500, [
    shape('ball', { x: 250, y: 250, rotation: Math.PI / 2 }, ellipse(200), solid(hex('#ff3366'))),
  ])

describe('toLottie', () => {
  it('writes one layer per node, drawn in painter order, sized to the timeline', () => {
    const play = timeline('play', 2).build()
    const anim = toLottie(
      scene('Gift', 500, 300, [
        shape('under', { x: 10 }, rect(10, 10), solid(hex('#000000'))),
        shape('over', { x: 20 }, rect(10, 10), solid(hex('#ffffff'))),
      ]),
      play,
    )
    expect(anim).toMatchObject({ w: 500, h: 300, fr: 60, ip: 0, op: 120, nm: 'Gift' })
    // Lottie draws layers[0] on top: the later sibling comes first, the root null layer last.
    expect(anim.layers.map(l => l.nm)).toEqual(['over', 'under', 'root'])
    const root = anim.layers.find(l => l.nm === 'root')
    expect(root?.ty).toBe(3)
    for (const l of anim.layers.filter(x => x.nm !== 'root')) {
      expect(l.ty).toBe(4)
      expect(l.parent).toBe(root?.ind)
      expect(l.op).toBe(120)
    }
  })

  it('converts rotation to degrees, opacity to percent and eases to bezier tangents', () => {
    const play = timeline('play', 1)
      .keys('ball', 'opacity', [
        [0, 0, 'hold'],
        [0.5, 1, EASE.out],
        [1, 0.25],
      ])
      .keys('ball', 'rotation', [
        [0, 0, 'linear'],
        [1, Math.PI],
      ])
      .build()
    const layer = toLottie(ball(), play).layers.find(l => l.nm === 'ball')
    if (!layer) throw new Error('missing layer')
    expect(keyed(layer.ks.o)).toEqual([
      { t: 0, s: [0], h: 1 },
      { t: 30, s: [100], o: { x: [0.16], y: [1] }, i: { x: [0.3], y: [1] } },
      { t: 60, s: [25], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
    ])
    expect(keyed(layer.ks.r).map(k => k.s)).toEqual([[0], [180]])
    // static properties stay static
    expect(layer.ks.p).toEqual({ a: 0, k: [250, 250, 0] })
    expect(layer.ks.s).toEqual({ a: 0, k: [100, 100, 100] })
  })

  it('splits an animated position into x and y so the tracks keep their own keys', () => {
    const play = timeline('play', 1)
      .keys('ball', 'x', [
        [0, 0],
        [1, 100],
      ])
      .build()
    const layer = toLottie(ball(), play).layers.find(l => l.nm === 'ball')
    const p = layer?.ks.p
    if (!p || !('s' in p) || p.s !== true) throw new Error('expected split position')
    expect(keyed(p.x).map(k => [k.t, k.s])).toEqual([
      [0, [0]],
      [60, [100]],
    ])
    expect(p.y).toEqual({ a: 0, k: 250 })
  })

  it('folds ancestor opacity into each drawable', () => {
    const tree = scene('Gift', 100, 100, [
      group('g', { opacity: 0.5 }, [
        shape('a', {}, ellipse(10), solid(hex('#ffffff'))),
        group('inner', { opacity: 0.5 }, [shape('b', {}, ellipse(10), solid(hex('#ffffff')))]),
      ]),
    ])
    const play = timeline('play', 1)
      .keys('a', 'opacity', [
        [0, 0],
        [1, 1],
      ])
      .build()
    const anim = toLottie(tree, play)
    const a = anim.layers.find(l => l.nm === 'a')
    const b = anim.layers.find(l => l.nm === 'b')
    expect(keyed(a?.ks.o as LottieProp).map(k => k.s)).toEqual([[0], [50]])
    expect(b?.ks.o).toEqual({ a: 0, k: 25 })
  })

  it('turns a group with animated opacity into a precomp whose children keep their keys', () => {
    const tree = scene('Gift', 100, 200, [
      group('g', { x: 10 }, [shape('a', { x: -30 }, ellipse(10), solid(hex('#ffffff')))]),
    ])
    const play = timeline('play', 1)
      .keys('g', 'opacity', [
        [0, 1],
        [1, 0],
      ])
      .keys('a', 'opacity', [
        [0.5, 0, EASE.inOut],
        [1, 1],
      ])
      .build()
    const anim = toLottie(tree, play)
    const comp = anim.layers.find(l => l.nm === 'g')
    expect(comp).toMatchObject({ ty: 0, refId: 'comp_g', w: 300, h: 600 })
    expect(comp?.ks.a).toEqual({ a: 0, k: [100, 200, 0] })
    expect(comp?.ks.p).toEqual({ a: 0, k: [10, 0, 0] })
    expect(keyed(comp?.ks.o as LottieProp).map(k => k.s)).toEqual([[100], [0]])
    const asset = anim.assets.find(x => x.id === 'comp_g')
    if (!asset || !('layers' in asset)) throw new Error('missing comp asset')
    // the child sits at its own local position, hung from the origin null at the comp centre
    const a = asset.layers.find(l => l.nm === 'a')
    const origin = asset.layers.find(l => l.nm === 'g origin')
    expect(origin?.ks.p).toEqual({ a: 0, k: [100, 200, 0] })
    expect(a?.parent).toBe(origin?.ind)
    expect(a?.ind).not.toBe(origin?.ind)
    expect(a?.ks.p).toEqual({ a: 0, k: [-30, 0, 0] })
    expect(keyed(a?.ks.o as LottieProp)).toHaveLength(2)
  })

  it('bakes a 2-D property per frame when its tracks disagree', () => {
    const play = timeline('play', 1)
      .keys('ball', 'scaleX', [
        [0, 1],
        [1, 2],
      ])
      .keys('ball', 'scaleY', [
        [0.5, 1, EASE.inOut],
        [1, 3],
      ])
      .build()
    const layer = toLottie(ball(), play).layers.find(l => l.nm === 'ball')
    const keys = keyed(layer?.ks.s as LottieProp)
    expect(keys).toHaveLength(61)
    const at45 = keys.find(k => k.t === 45)
    // x: 1 → 2 linear = 1.75 at 0.75 s; y: inOut from 1 at 0.5 s to 3 at 1 s, halfway = 2
    expect(at45?.s[0]).toBeCloseTo(175, 1)
    expect(at45?.s[1]).toBeCloseTo(200, 1)
  })

  it('embeds images as data URIs drawn from their centre at the requested width', () => {
    const asset: ImageAsset = {
      name: 'ring_f00',
      bytes: Uint8Array.from([1, 2, 3]),
      mime: 'image/webp',
      width: 200,
      height: 100,
    }
    const tree = scene('Gift', 400, 400, [image('img', { x: 200, y: 200 }, asset, 100)])
    const anim = toLottie(tree, timeline('play', 1).build())
    expect(anim.assets).toEqual([
      { id: 'ring_f00', w: 200, h: 100, u: '', p: 'data:image/webp;base64,AQID', e: 1 },
    ])
    const layer = anim.layers.find(l => l.nm === 'img')
    expect(layer).toMatchObject({
      ty: 2,
      refId: 'ring_f00',
      ks: {
        a: { a: 0, k: [100, 50, 0] },
        p: { a: 0, k: [200, 200, 0] },
        s: { a: 0, k: [50, 50, 100] },
      },
    })
  })

  it('rejects tracks that point at nothing', () => {
    const play = timeline('play', 1).key('ghost', 'x', 0, 0).build()
    expect(() => toLottie(ball(), play)).toThrow(/unknown animation target: ghost/)
  })
})

describe('compileProp', () => {
  it('samples keyframes with Rive semantics: held outside, eased inside', () => {
    const keys = [
      { time: 1, value: 0, ease: 'linear' as const },
      { time: 2, value: 10, ease: 'hold' as const },
      { time: 3, value: 20, ease: 'linear' as const },
    ]
    expect(sampleKeys(keys, 0)).toBe(0)
    expect(sampleKeys(keys, 1.5)).toBe(5)
    expect(sampleKeys(keys, 2.5)).toBe(10)
    expect(sampleKeys(keys, 9)).toBe(20)
  })

  it('merges channels with identical keys without baking', () => {
    const sx = [
      { time: 0, value: 1, ease: EASE.out },
      { time: 1, value: 2, ease: 'linear' as const },
    ]
    const sy = [
      { time: 0, value: 1, ease: EASE.out },
      { time: 1, value: 3, ease: 'linear' as const },
    ]
    const prop = compileProp([sx, sy], ([x, y]) => [(x as number) * 100, (y as number) * 100], 60)
    expect(keyed(prop).map(k => k.s)).toEqual([
      [100, 100],
      [200, 300],
    ])
  })
})
