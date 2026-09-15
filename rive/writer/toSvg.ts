import { alphaOf, rgbHexOf } from './binary'
import type { Geometry, Paint, Scene, SceneNode, Transform, Vertex } from './scene'

/**
 * Renders the static (frame 0, un-animated) scene as an SVG string.
 * Used for the gift list icons so the icon and the effect share one drawing.
 */
export const toSvg = (scene: Scene, size?: { width: number; height: number }): string => {
  const defs: string[] = []
  let gradientSeq = 0

  const paintAttrs = (paint: Paint | undefined, attr: 'fill' | 'stroke'): string => {
    if (!paint) return `${attr}="none"`
    if (paint.kind === 'solid') {
      return `${attr}="${rgbHexOf(paint.color)}" ${attr}-opacity="${fmt(alphaOf(paint.color))}"`
    }
    const id = `g${gradientSeq++}`
    const stops = paint.stops
      .map(
        s =>
          `<stop offset="${fmt(s.position)}" stop-color="${rgbHexOf(s.color)}" stop-opacity="${fmt(alphaOf(s.color))}"/>`,
      )
      .join('')
    if (paint.kind === 'linear') {
      defs.push(
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fmt(paint.start[0])}" y1="${fmt(paint.start[1])}" x2="${fmt(paint.end[0])}" y2="${fmt(paint.end[1])}">${stops}</linearGradient>`,
      )
    } else {
      const r = Math.hypot(paint.end[0] - paint.start[0], paint.end[1] - paint.start[1])
      defs.push(
        `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${fmt(paint.start[0])}" cy="${fmt(paint.start[1])}" r="${fmt(r)}">${stops}</radialGradient>`,
      )
    }
    const opacity = paint.opacity === undefined ? '' : ` ${attr}-opacity="${fmt(paint.opacity)}"`
    return `${attr}="url(#${id})"${opacity}`
  }

  const render = (node: SceneNode): string => {
    const t = transformAttr(node)
    if (node.kind === 'group') {
      return `<g${t}>${node.children.map(render).join('')}</g>`
    }
    if (node.kind === 'image') {
      const w = node.width
      const h = (node.asset.height / node.asset.width) * w
      const href = `data:${node.asset.mime};base64,${Buffer.from(node.asset.bytes).toString('base64')}`
      return `<g${t}><image x="${fmt(-w / 2)}" y="${fmt(-h / 2)}" width="${fmt(w)}" height="${fmt(h)}" href="${href}"/></g>`
    }
    const strokeAttrs = node.stroke
      ? `${paintAttrs(node.stroke.paint, 'stroke')} stroke-width="${fmt(node.stroke.thickness)}"`
      : 'stroke="none"'
    return `<g${t}>${geometrySvg(node.geometry, `${paintAttrs(node.fill, 'fill')} ${strokeAttrs}`)}</g>`
  }

  const body = render(scene.root)
  const w = size?.width ?? scene.width
  const h = size?.height ?? scene.height
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${scene.width} ${scene.height}">${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body}</svg>`
}

const fmt = (n: number): string => (Math.round(n * 1000) / 1000).toString()

const transformAttr = (t: Transform): string => {
  const parts: string[] = []
  if (t.x || t.y) parts.push(`translate(${fmt(t.x ?? 0)} ${fmt(t.y ?? 0)})`)
  if (t.rotation) parts.push(`rotate(${fmt((t.rotation * 180) / Math.PI)})`)
  if ((t.scaleX ?? 1) !== 1 || (t.scaleY ?? 1) !== 1) {
    parts.push(`scale(${fmt(t.scaleX ?? 1)} ${fmt(t.scaleY ?? 1)})`)
  }
  const transform = parts.length ? ` transform="${parts.join(' ')}"` : ''
  const opacity = t.opacity !== undefined && t.opacity !== 1 ? ` opacity="${fmt(t.opacity)}"` : ''
  return `${transform}${opacity}`
}

const geometrySvg = (g: Geometry, paint: string): string => {
  switch (g.kind) {
    case 'ellipse':
      return `<ellipse cx="0" cy="0" rx="${fmt(g.width / 2)}" ry="${fmt(g.height / 2)}" ${paint}/>`
    case 'rect':
      return `<rect x="${fmt(-g.width / 2)}" y="${fmt(-g.height / 2)}" width="${fmt(g.width)}" height="${fmt(g.height)}" rx="${fmt(g.cornerRadius ?? 0)}" ${paint}/>`
    case 'polygon':
      return `<polygon points="${polygonPoints(g.width, g.height, g.points)}" ${paint}/>`
    case 'star':
      return `<polygon points="${starPoints(g.width, g.height, g.points, g.innerRadius)}" ${paint}/>`
    case 'path':
      return `<path d="${pathD(g.vertices, g.closed)}" ${paint}/>`
  }
}

/** Rive polygons start at the top (-90°) and go clockwise. */
const polygonPoints = (w: number, h: number, n: number): string => {
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    pts.push(`${fmt((Math.cos(a) * w) / 2)},${fmt((Math.sin(a) * h) / 2)}`)
  }
  return pts.join(' ')
}

const starPoints = (w: number, h: number, n: number, inner: number): string => {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n
    const r = i % 2 === 0 ? 1 : inner
    pts.push(`${fmt((Math.cos(a) * w * r) / 2)},${fmt((Math.sin(a) * h * r) / 2)}`)
  }
  return pts.join(' ')
}

const handle = (v: Vertex, which: 'in' | 'out'): readonly [number, number] => {
  if (!('inRotation' in v)) return [v.x, v.y]
  const rot = which === 'in' ? v.inRotation : v.outRotation
  const dist = which === 'in' ? v.inDistance : v.outDistance
  return [v.x + Math.cos(rot) * dist, v.y + Math.sin(rot) * dist]
}

const pathD = (vertices: readonly Vertex[], closed: boolean): string => {
  if (vertices.length === 0) return ''
  const first = vertices[0] as Vertex
  const parts = [`M${fmt(first.x)} ${fmt(first.y)}`]
  const count = closed ? vertices.length : vertices.length - 1
  for (let i = 0; i < count; i++) {
    const a = vertices[i] as Vertex
    const b = vertices[(i + 1) % vertices.length] as Vertex
    const straight = !('inRotation' in a) && !('inRotation' in b)
    if (straight) {
      parts.push(`L${fmt(b.x)} ${fmt(b.y)}`)
    } else {
      const [c1x, c1y] = handle(a, 'out')
      const [c2x, c2y] = handle(b, 'in')
      parts.push(`C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(b.x)} ${fmt(b.y)}`)
    }
  }
  if (closed) parts.push('Z')
  return parts.join('')
}
