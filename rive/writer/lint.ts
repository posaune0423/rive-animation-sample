import { FACE_SAFE_AREA } from '../contract'
import { alphaOf } from './binary'
import { walk, type GroupNode, type Paint, type Scene, type SceneNode } from './scene'

type Box = { minX: number; minY: number; maxX: number; maxY: number }

const paintAlpha = (paint: Paint): number =>
  paint.kind === 'solid'
    ? alphaOf(paint.color)
    : Math.max(...paint.stops.map(s => alphaOf(s.color))) * (paint.opacity ?? 1)

const geometryBox = (node: SceneNode): Box | null => {
  if (node.kind !== 'shape') return null
  const g = node.geometry
  if (g.kind === 'path') {
    const xs = g.vertices.map(v => v.x)
    const ys = g.vertices.map(v => v.y)
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    }
  }
  return { minX: -g.width / 2, minY: -g.height / 2, maxX: g.width / 2, maxY: g.height / 2 }
}

/**
 * Static check for full-frame effects: at rest, no shape with effective alpha > 0.35 and a
 * footprint larger than 2% of the artboard may cover the face-safe area. Stroke-only shapes
 * (rings) are treated as see-through. Animated motion through the center is allowed and is
 * reviewed visually instead.
 */
export const checkFaceSafe = (scene: Scene): string[] => {
  const face = {
    minX: scene.width * FACE_SAFE_AREA.left,
    maxX: scene.width * FACE_SAFE_AREA.right,
    minY: scene.height * FACE_SAFE_AREA.top,
    maxY: scene.height * FACE_SAFE_AREA.bottom,
  }
  const artboardArea = scene.width * scene.height
  const violations: string[] = []

  const visit = (
    node: SceneNode,
    offset: readonly [number, number],
    scale: readonly [number, number],
    opacity: number,
  ) => {
    const x = offset[0] + (node.x ?? 0) * scale[0]
    const y = offset[1] + (node.y ?? 0) * scale[1]
    const sx = scale[0] * (node.scaleX ?? 1)
    const sy = scale[1] * (node.scaleY ?? 1)
    const alpha = opacity * (node.opacity ?? 1)
    if (node.kind === 'group') {
      for (const child of node.children) visit(child, [x, y], [sx, sy], alpha)
      return
    }
    if (!node.fill) return
    const box = geometryBox(node)
    if (!box) return
    const world = {
      minX: x + box.minX * sx,
      maxX: x + box.maxX * sx,
      minY: y + box.minY * sy,
      maxY: y + box.maxY * sy,
    }
    const effective = alpha * paintAlpha(node.fill)
    if (effective <= 0.35) return
    const overlapW = Math.min(world.maxX, face.maxX) - Math.max(world.minX, face.minX)
    const overlapH = Math.min(world.maxY, face.maxY) - Math.max(world.minY, face.minY)
    if (overlapW <= 0 || overlapH <= 0) return
    const footprint = (world.maxX - world.minX) * (world.maxY - world.minY)
    if (footprint / artboardArea > 0.02) {
      violations.push(`${node.id}: alpha ${effective.toFixed(2)} covers the face-safe area`)
    }
  }

  visit(scene.root as GroupNode, [0, 0], [1, 1], 1)
  return violations
}

export const shapeCount = (scene: Scene): number => {
  let n = 0
  for (const { node } of walk(scene.root)) if (node.kind === 'shape') n++
  return n
}
