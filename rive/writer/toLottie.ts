import { alphaOf } from './binary'
import {
  imageScale,
  walk,
  type Geometry,
  type Paint,
  type Scene,
  type SceneNode,
  type Vertex,
} from './scene'
import { isCubic, type AnimProp, type Ease, type KeyFrame, type Timeline } from './timeline'

/**
 * Compiles the scene + timeline that `toRiv` consumes into a Lottie (Bodymovin) animation, so the
 * perf bench can compare the two runtimes on identical artwork and motion.
 *
 * Mapping (Rive → Lottie):
 *   node tree      one layer per node — group → null layer (ty 3), shape → shape layer (ty 4),
 *                  image → image layer (ty 2) — linked with `parent`. Scenes are authored in
 *                  painter's order and Lottie draws `layers[0]` on top, so the list is reversed.
 *   node opacity   Rive multiplies a node's opacity into each descendant; Lottie parenting does not
 *                  inherit opacity. A static group opacity is folded into every descendant's layer;
 *                  a group whose opacity animates becomes a precomp (ty 0) — the way After Effects
 *                  users fade a group — so the keys stay as authored instead of being baked.
 *   keyframes      `s` per keyframe; cubic ease → o/i tangents, hold → h:1. Two-dimensional Lottie
 *                  properties (scale, size) are merged from the separate Rive tracks and baked per
 *                  frame when the tracks' keys disagree. Position uses Lottie's split x/y.
 *   images         embedded as base64 data URIs in `assets` (one file, like the .riv).
 */

// ---- Lottie JSON shapes (the subset we emit) --------------------------------

type Tangent = { readonly x: readonly number[]; readonly y: readonly number[] }

export type LottieKeyframe = {
  readonly t: number
  readonly s: readonly number[]
  readonly h?: 1
  readonly o?: Tangent
  readonly i?: Tangent
}

export type LottieProp =
  | { readonly a: 0; readonly k: number | readonly number[] }
  | { readonly a: 1; readonly k: readonly LottieKeyframe[] }

type Static<T> = { readonly a: 0; readonly k: T }

type SplitPosition = { readonly s: true; readonly x: LottieProp; readonly y: LottieProp }

export type LottieTransform = {
  readonly o: LottieProp
  readonly r: LottieProp
  readonly p: LottieProp | SplitPosition
  readonly a: Static<readonly number[]>
  readonly s: LottieProp
}

type ShapeItem = Record<string, unknown> & { readonly ty: string }

export type LottieLayer = {
  readonly ddd: 0
  readonly ind: number
  readonly ty: 0 | 2 | 3 | 4
  readonly nm: string
  readonly parent?: number
  readonly sr: 1
  readonly ks: LottieTransform
  readonly ao: 0
  readonly ip: number
  readonly op: number
  readonly st: 0
  readonly bm: 0
  readonly shapes?: readonly ShapeItem[]
  readonly refId?: string
  /** Precomp viewport (ty 0); the renderers clip to it. */
  readonly w?: number
  readonly h?: number
}

export type LottieImageAsset = {
  readonly id: string
  readonly w: number
  readonly h: number
  readonly u: ''
  readonly p: string
  readonly e: 1
}

export type LottieCompAsset = { readonly id: string; readonly layers: readonly LottieLayer[] }

export type LottieAsset = LottieImageAsset | LottieCompAsset

export type LottieAnimation = {
  readonly v: string
  readonly fr: number
  readonly ip: number
  readonly op: number
  readonly w: number
  readonly h: number
  readonly nm: string
  readonly ddd: 0
  readonly assets: readonly LottieAsset[]
  readonly layers: readonly LottieLayer[]
  readonly markers: readonly never[]
}

// ---- channels: a static number or a sorted keyframe list ---------------------

type Channel = number | readonly KeyFrame[]

const isKeys = (c: Channel): c is readonly KeyFrame[] => typeof c !== 'number'

const round = (n: number, digits = 4): number => {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

const bezierPoint = (a: number, b: number, t: number): number => {
  const mt = 1 - t
  return 3 * mt * mt * t * a + 3 * mt * t * t * b + t * t * t
}

/** y of the CSS-style cubic-bezier(x1, y1, x2, y2) at horizontal position `x` (bisection). */
const easeY = ([x1, y1, x2, y2]: readonly [number, number, number, number], x: number): number => {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (bezierPoint(x1, x2, mid) < x) lo = mid
    else hi = mid
  }
  return bezierPoint(y1, y2, (lo + hi) / 2)
}

const progress = (ease: Ease, u: number): number => {
  if (ease === 'hold') return 0
  if (ease === 'linear') return u
  return easeY(ease, u)
}

/** Value of a keyframed channel at `time`, with Rive's semantics (first / last key held). */
export const sampleKeys = (keys: readonly KeyFrame[], time: number): number => {
  const first = keys[0] as KeyFrame
  const last = keys[keys.length - 1] as KeyFrame
  if (time <= first.time) return first.value
  if (time >= last.time) return last.value
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i] as KeyFrame
    const b = keys[i + 1] as KeyFrame
    if (time < a.time || time > b.time) continue
    if (time === b.time) return b.value
    const u = (time - a.time) / (b.time - a.time)
    return a.value + (b.value - a.value) * progress(a.ease, u)
  }
  return last.value
}

const sameEase = (a: Ease, b: Ease): boolean =>
  a === b || (isCubic(a) && isCubic(b) && a.every((v, i) => v === b[i]))

const compatible = (tracks: readonly (readonly KeyFrame[])[]): boolean => {
  const ref = tracks[0] as readonly KeyFrame[]
  return tracks.every(
    t =>
      t.length === ref.length &&
      t.every((k, i) => k.time === ref[i]?.time && sameEase(k.ease, (ref[i] as KeyFrame).ease)),
  )
}

const tangents = (ease: Exclude<Ease, 'hold'>): { readonly o: Tangent; readonly i: Tangent } => {
  const [x1, y1, x2, y2] = ease === 'linear' ? [0, 0, 1, 1] : ease
  return { o: { x: [x1], y: [y1] }, i: { x: [x2], y: [y2] } }
}

type MergedKey = { readonly time: number; readonly value: readonly number[]; readonly ease: Ease }

const toKeyframes = (keys: readonly MergedKey[], fps: number): LottieKeyframe[] =>
  keys.map(k => {
    const t = round(k.time * fps)
    const s = k.value.map(v => round(v))
    return k.ease === 'hold' ? { t, s, h: 1 } : { t, s, ...tangents(k.ease) }
  })

/**
 * Turns one or more channels into a Lottie property through `map` (affine in each channel, so a
 * single animated channel keeps its easing). Several animated channels merge directly when their
 * keys line up and are baked per frame otherwise.
 */
export const compileProp = (
  channels: readonly Channel[],
  map: (values: readonly number[]) => readonly number[],
  fps: number,
): LottieProp => {
  const animated = channels.filter(isKeys)
  const valuesAt = (time: number) => map(channels.map(c => (isKeys(c) ? sampleKeys(c, time) : c)))
  if (animated.length === 0) {
    const k = map(channels as readonly number[]).map(v => round(v))
    return { a: 0, k: k.length === 1 ? (k[0] as number) : k }
  }
  let keys: MergedKey[]
  if (animated.length === 1 || compatible(animated)) {
    keys = (animated[0] as readonly KeyFrame[]).map(k => ({
      time: k.time,
      value: valuesAt(k.time),
      ease: k.ease,
    }))
  } else {
    const from = Math.floor(Math.min(...animated.map(t => (t[0] as KeyFrame).time)) * fps)
    const to = Math.ceil(Math.max(...animated.map(t => (t[t.length - 1] as KeyFrame).time)) * fps)
    keys = []
    for (let f = from; f <= to; f++) {
      keys.push({ time: f / fps, value: valuesAt(f / fps), ease: 'linear' })
    }
  }
  return { a: 1, k: toKeyframes(keys, fps) }
}

const staticProp = <T>(k: T): Static<T> => ({ a: 0, k })

// ---- paints ------------------------------------------------------------------

const rgb = (argb: number): readonly [number, number, number] => [
  ((argb >>> 16) & 0xff) / 255,
  ((argb >>> 8) & 0xff) / 255,
  (argb & 0xff) / 255,
]

const gradientStops = (paint: Extract<Paint, { kind: 'linear' | 'radial' }>) => ({
  p: paint.stops.length,
  k: staticProp([
    ...paint.stops.flatMap(s => [s.position, ...rgb(s.color)]),
    ...paint.stops.flatMap(s => [s.position, alphaOf(s.color)]),
  ]),
})

type PaintChannels = {
  readonly fillColor: Channel | null
  readonly gradientOpacity: Channel | null
}

const paintItem = (
  kind: 'fill' | 'stroke',
  paint: Paint,
  channels: PaintChannels,
  fps: number,
  stroke?: { readonly thickness: number },
): ShapeItem => {
  const strokeProps = stroke ? { w: staticProp(stroke.thickness), lc: 1, lj: 1, ml: 4 } : {}
  if (paint.kind === 'solid') {
    const color = channels.fillColor ?? paint.color
    return {
      ty: kind === 'fill' ? 'fl' : 'st',
      nm: kind,
      c: compileProp([color], ([c]) => [...rgb(c as number), 1], fps),
      o: compileProp([color], ([c]) => [alphaOf(c as number) * 100], fps),
      r: 1,
      ...strokeProps,
    }
  }
  const opacity = channels.gradientOpacity ?? paint.opacity ?? 1
  return {
    ty: kind === 'fill' ? 'gf' : 'gs',
    nm: kind,
    o: compileProp([opacity], ([o]) => [(o as number) * 100], fps),
    r: 1,
    t: paint.kind === 'linear' ? 1 : 2,
    s: staticProp([...paint.start]),
    e: staticProp([...paint.end]),
    g: gradientStops(paint),
    h: staticProp(0),
    a: staticProp(0),
    ...strokeProps,
  }
}

// ---- geometry -----------------------------------------------------------------

const handle = (v: Vertex, which: 'in' | 'out'): readonly [number, number] => {
  if (!('inRotation' in v)) return [0, 0]
  const rot = which === 'in' ? v.inRotation : v.outRotation
  const dist = which === 'in' ? v.inDistance : v.outDistance
  return [round(Math.cos(rot) * dist), round(Math.sin(rot) * dist)]
}

const IDENTITY_TR: ShapeItem = {
  ty: 'tr',
  p: staticProp([0, 0]),
  a: staticProp([0, 0]),
  s: staticProp([100, 100]),
  r: staticProp(0),
  o: staticProp(100),
  sk: staticProp(0),
  sa: staticProp(0),
}

type SizeChannels = { readonly width: Channel | null; readonly height: Channel | null }

const geometryItems = (
  id: string,
  g: Geometry,
  size: SizeChannels,
  fps: number,
): readonly ShapeItem[] => {
  const animatedSize = size.width !== null || size.height !== null
  switch (g.kind) {
    case 'ellipse':
    case 'rect': {
      const s = compileProp(
        [size.width ?? g.width, size.height ?? g.height],
        ([w, h]) => [w as number, h as number],
        fps,
      )
      return g.kind === 'ellipse'
        ? [{ ty: 'el', nm: id, d: 1, p: staticProp([0, 0]), s }]
        : [{ ty: 'rc', nm: id, d: 1, p: staticProp([0, 0]), s, r: staticProp(g.cornerRadius ?? 0) }]
    }
    case 'star':
    case 'polygon': {
      if (animatedSize) throw new Error(`${id}: Lottie polystars cannot animate width/height`)
      const outer = g.width / 2
      const star: ShapeItem = {
        ty: 'sr',
        nm: id,
        d: 1,
        sy: g.kind === 'star' ? 1 : 2,
        pt: staticProp(g.points),
        p: staticProp([0, 0]),
        r: staticProp(0),
        or: staticProp(outer),
        os: staticProp(0),
        ...(g.kind === 'star' ? { ir: staticProp(g.innerRadius * outer), is: staticProp(0) } : {}),
      }
      if (g.height === g.width) return [star]
      // Lottie polystars are circular; a non-square Rive star is squashed by a nested group.
      return [
        {
          ty: 'gr',
          nm: `${id} squash`,
          it: [star, { ...IDENTITY_TR, s: staticProp([100, (100 * g.height) / g.width]) }],
        },
      ]
    }
    case 'path': {
      if (animatedSize) throw new Error(`${id}: Lottie paths cannot animate width/height`)
      const vertices = g.vertices
      return [
        {
          ty: 'sh',
          nm: id,
          d: 1,
          ks: staticProp({
            c: g.closed,
            v: vertices.map(v => [round(v.x), round(v.y)]),
            i: vertices.map(v => handle(v, 'in')),
            o: vertices.map(v => handle(v, 'out')),
          }),
        },
      ]
    }
  }
}

// ---- the compiler ---------------------------------------------------------------

const LOTTIE_VERSION = '5.12.2'

export const toLottie = (scene: Scene, play: Timeline): LottieAnimation => {
  const fps = play.fps
  const op = round(play.duration * fps)
  const { width: W, height: H } = scene

  const tracks = new Map<string, readonly KeyFrame[]>()
  for (const track of play.tracks) {
    tracks.set(`${track.target} ${track.prop}`, track.keys)
  }
  const known = new Set<string>()
  for (const { node } of walk(scene.root)) known.add(node.id)
  for (const track of play.tracks) {
    if (!known.has(track.target)) throw new Error(`unknown animation target: ${track.target}`)
  }

  /** A track as a channel: absent → the static value, one key → that key's value. */
  const channel = (id: string, prop: AnimProp, fallback: number): Channel => {
    const keys = tracks.get(`${id} ${prop}`)
    if (!keys || keys.length === 0) return fallback
    return keys.length === 1 ? (keys[0] as KeyFrame).value : keys
  }
  const optional = (id: string, prop: AnimProp): Channel | null =>
    tracks.has(`${id} ${prop}`) ? channel(id, prop, 0) : null

  const opacityOf = (node: SceneNode): Channel => channel(node.id, 'opacity', node.opacity ?? 1)
  /** Groups whose opacity animates are compiled as precomps and start a new scope. */
  const isComp = (node: SceneNode): boolean => node.kind === 'group' && isKeys(opacityOf(node))

  const assets: LottieAsset[] = []
  const imageIds = new Set<string>()

  const transform = (
    node: SceneNode,
    opacity: readonly Channel[],
    scale: number,
    anchor: readonly number[],
  ): LottieTransform => {
    const x = channel(node.id, 'x', node.x ?? 0)
    const y = channel(node.id, 'y', node.y ?? 0)
    const p: LottieProp | SplitPosition =
      isKeys(x) || isKeys(y)
        ? {
            s: true,
            x: compileProp([x], ([v]) => [v as number], fps),
            y: compileProp([y], ([v]) => [v as number], fps),
          }
        : staticProp([round(x), round(y), 0])
    return {
      o: compileProp(opacity, values => [values.reduce((acc, v) => acc * v, 1) * 100], fps),
      r: compileProp(
        [channel(node.id, 'rotation', node.rotation ?? 0)],
        ([r]) => [((r as number) * 180) / Math.PI],
        fps,
      ),
      p,
      a: staticProp([...anchor, 0]),
      s: compileProp(
        [
          channel(node.id, 'scaleX', node.scaleX ?? 1),
          channel(node.id, 'scaleY', node.scaleY ?? 1),
        ],
        ([sx, sy]) => [(sx as number) * scale * 100, (sy as number) * scale * 100, 100],
        fps,
      ),
    }
  }

  const shapeItems = (node: Extract<SceneNode, { kind: 'shape' }>): ShapeItem[] => {
    const paintChannels: PaintChannels = {
      fillColor: optional(node.id, 'fillColor'),
      gradientOpacity: optional(node.id, 'gradientOpacity'),
    }
    if (paintChannels.fillColor !== null && node.fill?.kind !== 'solid') {
      throw new Error(`${node.id} has no solid fill to animate`)
    }
    if (paintChannels.gradientOpacity !== null && (!node.fill || node.fill.kind === 'solid')) {
      throw new Error(`${node.id} has no gradient fill to animate`)
    }
    const items: ShapeItem[] = [
      ...geometryItems(
        node.id,
        node.geometry,
        { width: optional(node.id, 'width'), height: optional(node.id, 'height') },
        fps,
      ),
    ]
    // Items listed first draw on top, so the stroke goes before the fill (as Rive draws them).
    if (node.stroke) {
      items.push(
        paintItem(
          'stroke',
          node.stroke.paint,
          { fillColor: null, gradientOpacity: null },
          fps,
          node.stroke,
        ),
      )
    }
    if (node.fill) items.push(paintItem('fill', node.fill, paintChannels, fps))
    items.push(IDENTITY_TR)
    return items
  }

  /**
   * Compiles `nodes` (painter's order) into one layer list. `inherited` holds the static
   * opacities of the ancestors inside this scope; `parent` is the layer they hang from.
   */
  const compileScope = (
    nodes: readonly SceneNode[],
    parent: number | null,
    inherited: readonly Channel[],
    layers: LottieLayer[],
  ): void => {
    const nextInd = () => layers.length + 1
    const base = (node: SceneNode, ind: number) => ({
      ddd: 0 as const,
      ind,
      nm: node.id,
      ...(parent === null ? {} : { parent }),
      sr: 1 as const,
      ao: 0 as const,
      ip: 0,
      op,
      st: 0 as const,
      bm: 0 as const,
    })
    for (const node of nodes) {
      const opacity = [...inherited, opacityOf(node)]
      if (node.kind === 'group' && isComp(node)) {
        // The comp viewport is 3× the artboard and anchored at its centre so children that sit at
        // negative local coordinates (particles entering from outside) are not clipped.
        const id = `comp_${node.id}`
        const inner: LottieLayer[] = [
          {
            ddd: 0,
            ind: 1,
            ty: 3,
            nm: `${node.id} origin`,
            sr: 1,
            ks: {
              o: staticProp(100),
              r: staticProp(0),
              p: staticProp([W, H, 0]),
              a: staticProp([0, 0, 0]),
              s: staticProp([100, 100, 100]),
            },
            ao: 0,
            ip: 0,
            op,
            st: 0,
            bm: 0,
          },
        ]
        compileScope(node.children, 1, [], inner)
        assets.push({ id, layers: inner })
        layers.push({
          ...base(node, nextInd()),
          ty: 0,
          refId: id,
          w: 3 * W,
          h: 3 * H,
          ks: transform(node, opacity, 1, [W, H]),
        })
        continue
      }
      if (node.kind === 'group') {
        const ind = nextInd()
        layers.push({ ...base(node, ind), ty: 3, ks: transform(node, opacity, 1, [0, 0]) })
        compileScope(node.children, ind, opacity, layers)
        continue
      }
      if (node.kind === 'image') {
        const { asset } = node
        if (!imageIds.has(asset.name)) {
          imageIds.add(asset.name)
          assets.push({
            id: asset.name,
            w: asset.width,
            h: asset.height,
            u: '',
            p: `data:${asset.mime};base64,${Buffer.from(asset.bytes).toString('base64')}`,
            e: 1,
          })
        }
        layers.push({
          ...base(node, nextInd()),
          ty: 2,
          refId: asset.name,
          ks: transform(node, opacity, imageScale(node), [asset.width / 2, asset.height / 2]),
        })
        continue
      }
      layers.push({
        ...base(node, nextInd()),
        ty: 4,
        ks: transform(node, opacity, 1, [0, 0]),
        shapes: [{ ty: 'gr', nm: node.id, it: shapeItems(node) }],
      })
    }
  }

  const layers: LottieLayer[] = []
  compileScope([scene.root], null, [], layers)
  // Lottie draws layers[0] on top; scenes are authored in painter's order.
  layers.reverse()
  for (const asset of assets) if ('layers' in asset) (asset.layers as LottieLayer[]).reverse()

  return {
    v: LOTTIE_VERSION,
    fr: fps,
    ip: 0,
    op,
    w: W,
    h: H,
    nm: scene.artboard,
    ddd: 0,
    assets,
    layers,
    markers: [],
  }
}
