import { RIVE_CONTRACT } from '../contract'
import { ByteWriter } from './binary'
import {
  FIELD_INDEX,
  FIRE_OCCURS,
  INTERPOLATION,
  LOOP,
  PROP,
  TRANSITION_FLAG,
  TYPE,
  type FieldType,
} from './keys'
import { assertUniqueIds, ROOT_ID, walk, type Paint, type Scene, type SceneNode } from './scene'
import { easeKey, isCubic, type AnimProp, type Ease, type Timeline } from './timeline'

type PropDef = { readonly key: number; readonly type: FieldType }
type Value = number | string | boolean
type RivObject = { readonly type: number; readonly props: ReadonlyArray<readonly [PropDef, Value]> }

/**
 * Compiles a scene + one "play" timeline into a .riv file that follows `RIVE_CONTRACT`:
 * state machine "Main" with trigger "play", event "finished" fired when the play timeline ends,
 * and a one-frame "idle" timeline that hides the root while nothing plays.
 *
 * Object ordering and ownership follow rive-runtime `src/file.cpp` / `src/importers/*`.
 */
export const toRiv = (scene: Scene, play: Timeline): Uint8Array => {
  assertUniqueIds(scene)
  const objects: RivObject[] = []
  const emit = (type: number, props: ReadonlyArray<readonly [PropDef, Value]>): void => {
    objects.push({ type, props })
  }

  // ---- backboard + artboard (component index 0) ---------------------------
  emit(TYPE.backboard, [])
  emit(TYPE.artboard, [
    [PROP.name, scene.artboard],
    [PROP.artboardWidth, scene.width],
    [PROP.artboardHeight, scene.height],
  ])
  let componentCount = 1
  const nextComponent = (): number => componentCount++

  const nodeIndex = new Map<string, number>()
  const fillColorIndex = new Map<string, number>()
  const geometryIndex = new Map<string, number>()
  const gradientIndex = new Map<string, number>()

  const transformProps = (node: SceneNode): Array<readonly [PropDef, Value]> => {
    const props: Array<readonly [PropDef, Value]> = []
    if (node.x !== undefined) props.push([PROP.x, node.x])
    if (node.y !== undefined) props.push([PROP.y, node.y])
    if (node.rotation !== undefined) props.push([PROP.rotation, node.rotation])
    if (node.scaleX !== undefined) props.push([PROP.scaleX, node.scaleX])
    if (node.scaleY !== undefined) props.push([PROP.scaleY, node.scaleY])
    if (node.opacity !== undefined) props.push([PROP.opacity, node.opacity])
    return props
  }

  const emitPaint = (ownerId: string, parent: number, paint: Paint, isFill: boolean): void => {
    if (paint.kind === 'solid') {
      const idx = nextComponent()
      if (isFill) fillColorIndex.set(ownerId, idx)
      emit(TYPE.solidColor, [
        [PROP.parentId, parent],
        [PROP.solidColor, paint.color],
      ])
      return
    }
    const idx = nextComponent()
    if (isFill) gradientIndex.set(ownerId, idx)
    const props: Array<readonly [PropDef, Value]> = [
      [PROP.parentId, parent],
      [PROP.gradientStartX, paint.start[0]],
      [PROP.gradientStartY, paint.start[1]],
      [PROP.gradientEndX, paint.end[0]],
      [PROP.gradientEndY, paint.end[1]],
    ]
    if (paint.opacity !== undefined) props.push([PROP.gradientOpacity, paint.opacity])
    emit(paint.kind === 'linear' ? TYPE.linearGradient : TYPE.radialGradient, props)
    for (const stop of paint.stops) {
      nextComponent()
      emit(TYPE.gradientStop, [
        [PROP.parentId, idx],
        [PROP.stopColor, stop.color],
        [PROP.stopPosition, stop.position],
      ])
    }
  }

  // ---- scene graph ---------------------------------------------------------
  for (const { node, parent } of walk(scene.root)) {
    const parentIdx = parent ? (nodeIndex.get(parent.id) as number) : 0
    const idx = nextComponent()
    nodeIndex.set(node.id, idx)
    const base: Array<readonly [PropDef, Value]> = [
      [PROP.name, node.id],
      [PROP.parentId, parentIdx],
      ...transformProps(node),
    ]
    if (node.kind === 'group') {
      emit(TYPE.node, base)
      continue
    }
    emit(TYPE.shape, base)

    const g = node.geometry
    const geoIdx = nextComponent()
    geometryIndex.set(node.id, geoIdx)
    switch (g.kind) {
      case 'ellipse':
        emit(TYPE.ellipse, [
          [PROP.parentId, idx],
          [PROP.pathWidth, g.width],
          [PROP.pathHeight, g.height],
        ])
        break
      case 'rect':
        emit(TYPE.rectangle, [
          [PROP.parentId, idx],
          [PROP.pathWidth, g.width],
          [PROP.pathHeight, g.height],
          [PROP.linkCornerRadius, true],
          [PROP.cornerRadiusTL, g.cornerRadius ?? 0],
        ])
        break
      case 'star':
        emit(TYPE.star, [
          [PROP.parentId, idx],
          [PROP.pathWidth, g.width],
          [PROP.pathHeight, g.height],
          [PROP.polygonPoints, g.points],
          [PROP.starInnerRadius, g.innerRadius],
          [PROP.polygonCornerRadius, g.cornerRadius ?? 0],
        ])
        break
      case 'polygon':
        emit(TYPE.polygon, [
          [PROP.parentId, idx],
          [PROP.pathWidth, g.width],
          [PROP.pathHeight, g.height],
          [PROP.polygonPoints, g.points],
          [PROP.polygonCornerRadius, g.cornerRadius ?? 0],
        ])
        break
      case 'path':
        emit(TYPE.pointsPath, [
          [PROP.parentId, idx],
          [PROP.isClosed, g.closed],
        ])
        for (const v of g.vertices) {
          nextComponent()
          if ('inRotation' in v) {
            emit(TYPE.cubicDetachedVertex, [
              [PROP.parentId, geoIdx],
              [PROP.vertexX, v.x],
              [PROP.vertexY, v.y],
              [PROP.inRotation, v.inRotation],
              [PROP.inDistance, v.inDistance],
              [PROP.outRotation, v.outRotation],
              [PROP.outDistance, v.outDistance],
            ])
          } else {
            emit(TYPE.straightVertex, [
              [PROP.parentId, geoIdx],
              [PROP.vertexX, v.x],
              [PROP.vertexY, v.y],
              [PROP.vertexRadius, v.radius ?? 0],
            ])
          }
        }
        break
    }

    if (node.fill) {
      const fillIdx = nextComponent()
      emit(TYPE.fill, [[PROP.parentId, idx]])
      emitPaint(node.id, fillIdx, node.fill, true)
    }
    if (node.stroke) {
      const strokeIdx = nextComponent()
      emit(TYPE.stroke, [
        [PROP.parentId, idx],
        [PROP.strokeThickness, node.stroke.thickness],
      ])
      emitPaint(node.id, strokeIdx, node.stroke.paint, false)
    }
  }

  // ---- interpolators (artboard components, referenced by index) -----------
  const interpolatorIndex = new Map<string, number>()
  for (const track of play.tracks) {
    for (const k of track.keys) {
      if (!isCubic(k.ease)) continue
      const id = easeKey(k.ease)
      if (interpolatorIndex.has(id)) continue
      interpolatorIndex.set(id, nextComponent())
      emit(TYPE.cubicEaseInterpolator, [
        [PROP.cubicX1, k.ease[0]],
        [PROP.cubicY1, k.ease[1]],
        [PROP.cubicX2, k.ease[2]],
        [PROP.cubicY2, k.ease[3]],
      ])
    }
  }

  // ---- finished event (artboard component) --------------------------------
  const eventIdx = nextComponent()
  emit(TYPE.event, [
    [PROP.name, RIVE_CONTRACT.finishedEvent],
    [PROP.parentId, 0],
  ])

  // ---- animations: 0 = idle, 1 = play --------------------------------------
  const rootIdx = nodeIndex.get(ROOT_ID) as number
  emit(TYPE.linearAnimation, [
    [PROP.animationName, RIVE_CONTRACT.idleAnimation],
    [PROP.fps, RIVE_CONTRACT.fps],
    [PROP.duration, 1],
    [PROP.loop, LOOP.oneShot],
  ])
  emit(TYPE.keyedObject, [[PROP.keyedObjectId, rootIdx]])
  emit(TYPE.keyedProperty, [[PROP.keyedPropertyKey, PROP.opacity.key]])
  emit(TYPE.keyFrameDouble, [
    [PROP.frame, 0],
    [PROP.interpolationType, INTERPOLATION.hold],
    [PROP.keyFrameDoubleValue, 0],
  ])

  const resolveTarget = (target: string, prop: AnimProp): { objectId: number; key: number } => {
    switch (prop) {
      case 'fillColor': {
        const objectId = fillColorIndex.get(target)
        if (objectId === undefined) throw new Error(`${target} has no solid fill to animate`)
        return { objectId, key: PROP.solidColor.key }
      }
      case 'width':
      case 'height': {
        const objectId = geometryIndex.get(target)
        if (objectId === undefined) throw new Error(`${target} has no geometry to animate`)
        return { objectId, key: prop === 'width' ? PROP.pathWidth.key : PROP.pathHeight.key }
      }
      case 'gradientOpacity': {
        const objectId = gradientIndex.get(target)
        if (objectId === undefined) throw new Error(`${target} has no gradient fill to animate`)
        return { objectId, key: PROP.gradientOpacity.key }
      }
      default: {
        const objectId = nodeIndex.get(target)
        if (objectId === undefined) throw new Error(`unknown animation target: ${target}`)
        return { objectId, key: PROP[prop].key }
      }
    }
  }

  const interpolationProps = (ease: Ease): Array<readonly [PropDef, Value]> => {
    if (ease === 'hold') return [[PROP.interpolationType, INTERPOLATION.hold]]
    if (ease === 'linear') return [[PROP.interpolationType, INTERPOLATION.linear]]
    return [
      [PROP.interpolationType, INTERPOLATION.cubic],
      [PROP.interpolatorId, interpolatorIndex.get(easeKey(ease)) as number],
    ]
  }

  emit(TYPE.linearAnimation, [
    [PROP.animationName, RIVE_CONTRACT.playAnimation],
    [PROP.fps, play.fps],
    [PROP.duration, Math.round(play.duration * play.fps)],
    [PROP.loop, LOOP.oneShot],
  ])
  const byObject = new Map<number, Array<{ key: number; track: Timeline['tracks'][number] }>>()
  for (const track of play.tracks) {
    const { objectId, key } = resolveTarget(track.target, track.prop)
    const list = byObject.get(objectId) ?? []
    list.push({ key, track })
    byObject.set(objectId, list)
  }
  for (const [objectId, list] of byObject) {
    emit(TYPE.keyedObject, [[PROP.keyedObjectId, objectId]])
    for (const { key, track } of list) {
      emit(TYPE.keyedProperty, [[PROP.keyedPropertyKey, key]])
      for (const k of track.keys) {
        const frame = Math.round(k.time * play.fps)
        if (track.prop === 'fillColor') {
          emit(TYPE.keyFrameColor, [
            [PROP.frame, frame],
            ...interpolationProps(k.ease),
            [PROP.keyFrameColorValue, k.value],
          ])
        } else {
          emit(TYPE.keyFrameDouble, [
            [PROP.frame, frame],
            ...interpolationProps(k.ease),
            [PROP.keyFrameDoubleValue, k.value],
          ])
        }
      }
    }
  }

  // ---- state machine -------------------------------------------------------
  // states: 0 Any, 1 Entry, 2 Exit, 3 idle, 4 play
  emit(TYPE.stateMachine, [[PROP.animationName, RIVE_CONTRACT.stateMachine]])
  emit(TYPE.stateMachineTrigger, [[PROP.stateMachineComponentName, RIVE_CONTRACT.playTrigger]])
  emit(TYPE.stateMachineLayer, [[PROP.stateMachineComponentName, 'Layer 1']])
  emit(TYPE.anyState, [])
  emit(TYPE.stateTransition, [
    [PROP.stateToId, 4],
    [PROP.transitionFlags, TRANSITION_FLAG.none],
    [PROP.transitionDuration, 0],
  ])
  emit(TYPE.transitionTriggerCondition, [[PROP.inputId, 0]])
  emit(TYPE.entryState, [])
  emit(TYPE.stateTransition, [
    [PROP.stateToId, 3],
    [PROP.transitionFlags, TRANSITION_FLAG.none],
    [PROP.transitionDuration, 0],
  ])
  emit(TYPE.exitState, [])
  emit(TYPE.animationState, [[PROP.animationId, 0]])
  emit(TYPE.animationState, [[PROP.animationId, 1]])
  emit(TYPE.stateMachineFireEvent, [
    [PROP.fireEventId, eventIdx],
    [PROP.fireOccurs, FIRE_OCCURS.atEnd],
  ])
  emit(TYPE.stateTransition, [
    [PROP.stateToId, 3],
    [PROP.transitionFlags, TRANSITION_FLAG.enableExitTime | TRANSITION_FLAG.exitTimeIsPercentage],
    [PROP.exitTime, 100],
    [PROP.transitionDuration, 0],
  ])

  return serialize(objects)
}

const serialize = (objects: readonly RivObject[]): Uint8Array => {
  const w = new ByteWriter()
  // header: "RIVE", major 7, minor 0, fileId 0
  w.byte(0x52).byte(0x49).byte(0x56).byte(0x45)
  w.varuint(7).varuint(0).varuint(0)

  // table of contents: property keys used, then 0, then field-type bits (4 keys per u32)
  const keyTypes = new Map<number, FieldType>()
  for (const o of objects) for (const [def] of o.props) keyTypes.set(def.key, def.type)
  const keys = [...keyTypes.keys()].toSorted((a, b) => a - b)
  for (const k of keys) w.varuint(k)
  w.varuint(0)
  for (let i = 0; i < keys.length; i += 4) {
    let packed = 0
    keys.slice(i, i + 4).forEach((k, j) => {
      packed |= FIELD_INDEX[keyTypes.get(k) as FieldType] << (j * 2)
    })
    w.u32(packed)
  }

  for (const o of objects) {
    w.varuint(o.type)
    for (const [def, value] of o.props) {
      w.varuint(def.key)
      switch (def.type) {
        case 'uint':
          w.varuint(value as number)
          break
        case 'bool':
          w.bool(value as boolean)
          break
        case 'string':
          w.string(value as string)
          break
        case 'double':
          w.f32(value as number)
          break
        case 'color':
          w.color(value as number)
          break
      }
    }
    w.varuint(0)
  }
  return w.toUint8Array()
}
