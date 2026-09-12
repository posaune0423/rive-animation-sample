/**
 * Declarative scene graph that both `toRiv` and `toSvg` consume.
 * Coordinates are Rive's: origin top-left of the artboard, y down, rotation in radians.
 * Parametric shapes (ellipse / rect / star / polygon) are centered on the shape's (x, y).
 */
export type Vec2 = readonly [number, number]

export type GradientStop = { readonly position: number; readonly color: number }

export type Paint =
  | { readonly kind: 'solid'; readonly color: number }
  | {
      readonly kind: 'linear' | 'radial'
      readonly start: Vec2
      readonly end: Vec2
      readonly stops: readonly GradientStop[]
      readonly opacity?: number
    }

export type StraightVertex = { readonly x: number; readonly y: number; readonly radius?: number }
export type CubicVertex = {
  readonly x: number
  readonly y: number
  readonly inRotation: number
  readonly inDistance: number
  readonly outRotation: number
  readonly outDistance: number
}
export type Vertex = StraightVertex | CubicVertex

export type Geometry =
  | { readonly kind: 'ellipse'; readonly width: number; readonly height: number }
  | {
      readonly kind: 'rect'
      readonly width: number
      readonly height: number
      readonly cornerRadius?: number
    }
  | {
      readonly kind: 'star'
      readonly width: number
      readonly height: number
      readonly points: number
      readonly innerRadius: number
      readonly cornerRadius?: number
    }
  | {
      readonly kind: 'polygon'
      readonly width: number
      readonly height: number
      readonly points: number
      readonly cornerRadius?: number
    }
  | { readonly kind: 'path'; readonly closed: boolean; readonly vertices: readonly Vertex[] }

export type Transform = {
  readonly x?: number
  readonly y?: number
  readonly rotation?: number
  readonly scaleX?: number
  readonly scaleY?: number
  readonly opacity?: number
}

export type ShapeNode = Transform & {
  readonly kind: 'shape'
  readonly id: string
  readonly geometry: Geometry
  readonly fill?: Paint
  readonly stroke?: { readonly paint: Paint; readonly thickness: number }
}

export type GroupNode = Transform & {
  readonly kind: 'group'
  readonly id: string
  readonly children: readonly SceneNode[]
}

export type SceneNode = ShapeNode | GroupNode

export type Scene = {
  readonly artboard: string
  readonly width: number
  readonly height: number
  readonly root: GroupNode
}

export const ROOT_ID = 'root'

// ---- builders -------------------------------------------------------------

export const group = (
  id: string,
  transform: Transform,
  children: readonly SceneNode[],
): GroupNode => ({ kind: 'group', id, ...transform, children })

export const shape = (
  id: string,
  transform: Transform,
  geometry: Geometry,
  fill?: Paint,
  stroke?: ShapeNode['stroke'],
): ShapeNode => ({ kind: 'shape', id, ...transform, geometry, fill, stroke })

export const ellipse = (width: number, height = width): Geometry => ({
  kind: 'ellipse',
  width,
  height,
})

export const rect = (width: number, height: number, cornerRadius = 0): Geometry => ({
  kind: 'rect',
  width,
  height,
  cornerRadius,
})

export const star = (
  width: number,
  height: number,
  points: number,
  innerRadius: number,
  cornerRadius = 0,
): Geometry => ({ kind: 'star', width, height, points, innerRadius, cornerRadius })

export const polygon = (
  width: number,
  height: number,
  points: number,
  cornerRadius = 0,
): Geometry => ({ kind: 'polygon', width, height, points, cornerRadius })

export const path = (vertices: readonly Vertex[], closed = true): Geometry => ({
  kind: 'path',
  closed,
  vertices,
})

export const solid = (color: number): Paint => ({ kind: 'solid', color })

export const linear = (
  start: Vec2,
  end: Vec2,
  stops: readonly GradientStop[],
  opacity?: number,
): Paint => ({ kind: 'linear', start, end, stops, opacity })

export const radial = (
  center: Vec2,
  edge: Vec2,
  stops: readonly GradientStop[],
  opacity?: number,
): Paint => ({ kind: 'radial', start: center, end: edge, stops, opacity })

export const scene = (
  artboard: string,
  width: number,
  height: number,
  children: readonly SceneNode[],
): Scene => ({ artboard, width, height, root: group(ROOT_ID, {}, children) })

// ---- traversal ------------------------------------------------------------

export function* walk(
  node: SceneNode,
  parent: GroupNode | null = null,
): Generator<{ node: SceneNode; parent: GroupNode | null }> {
  yield { node, parent }
  if (node.kind === 'group') {
    for (const child of node.children) yield* walk(child, node)
  }
}

export const countShapes = (target: Scene): number => {
  let n = 0
  for (const { node } of walk(target.root)) if (node.kind === 'shape') n++
  return n
}

export const findNode = (target: Scene, id: string): SceneNode | undefined => {
  for (const { node } of walk(target.root)) if (node.id === id) return node
  return undefined
}

export const assertUniqueIds = (target: Scene): void => {
  const seen = new Set<string>()
  for (const { node } of walk(target.root)) {
    if (seen.has(node.id)) throw new Error(`duplicate node id: ${node.id}`)
    seen.add(node.id)
  }
}
