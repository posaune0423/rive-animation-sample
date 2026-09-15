/**
 * Object type keys and property keys of the .riv format.
 * Source of truth: rive-runtime `include/rive/generated/**\/*_base.hpp`
 * (`typeKey` and `*PropertyKey` constants). Only the subset this writer emits is listed.
 */
export const TYPE = {
  backboard: 23,
  artboard: 1,
  node: 2,
  shape: 3,
  ellipse: 4,
  rectangle: 7,
  polygon: 51,
  star: 52,
  pointsPath: 16,
  straightVertex: 5,
  cubicDetachedVertex: 6,
  fill: 20,
  stroke: 24,
  solidColor: 18,
  linearGradient: 22,
  radialGradient: 17,
  gradientStop: 19,
  event: 128,
  linearAnimation: 31,
  keyedObject: 25,
  keyedProperty: 26,
  keyFrameDouble: 30,
  keyFrameColor: 37,
  cubicEaseInterpolator: 28,
  stateMachine: 53,
  stateMachineTrigger: 58,
  stateMachineLayer: 57,
  anyState: 62,
  entryState: 63,
  exitState: 64,
  animationState: 61,
  stateTransition: 65,
  transitionTriggerCondition: 68,
  stateMachineFireEvent: 169,
  // assets (backboard level) + image drawable
  imageAsset: 105,
  fileAssetContents: 106,
  image: 100,
} as const

export type FieldType = 'uint' | 'bool' | 'string' | 'double' | 'color' | 'bytes'

type PropDef = { readonly key: number; readonly type: FieldType }
const p = (key: number, type: FieldType): PropDef => ({ key, type })

export const PROP = {
  // component_base / layout_component_base / node_base / transform_component_base
  name: p(4, 'string'),
  parentId: p(5, 'uint'),
  artboardWidth: p(7, 'double'),
  artboardHeight: p(8, 'double'),
  x: p(13, 'double'),
  y: p(14, 'double'),
  rotation: p(15, 'double'),
  scaleX: p(16, 'double'),
  scaleY: p(17, 'double'),
  opacity: p(18, 'double'),
  // parametric_path_base / rectangle_base / polygon_base / star_base / points_common_path_base
  pathWidth: p(20, 'double'),
  pathHeight: p(21, 'double'),
  cornerRadiusTL: p(31, 'double'),
  linkCornerRadius: p(164, 'bool'),
  polygonPoints: p(125, 'uint'),
  polygonCornerRadius: p(126, 'double'),
  starInnerRadius: p(127, 'double'),
  isClosed: p(32, 'bool'),
  // vertex_base / straight_vertex_base / cubic_detached_vertex_base
  vertexX: p(24, 'double'),
  vertexY: p(25, 'double'),
  vertexRadius: p(26, 'double'),
  inRotation: p(84, 'double'),
  inDistance: p(85, 'double'),
  outRotation: p(86, 'double'),
  outDistance: p(87, 'double'),
  // drawable_base
  blendMode: p(23, 'uint'),
  // paint
  solidColor: p(37, 'color'),
  stopColor: p(38, 'color'),
  stopPosition: p(39, 'double'),
  gradientStartX: p(42, 'double'),
  gradientStartY: p(33, 'double'),
  gradientEndX: p(34, 'double'),
  gradientEndY: p(35, 'double'),
  gradientOpacity: p(46, 'double'),
  strokeThickness: p(47, 'double'),
  // animation
  animationName: p(55, 'string'),
  fps: p(56, 'uint'),
  duration: p(57, 'uint'),
  loop: p(59, 'uint'),
  keyedObjectId: p(51, 'uint'),
  keyedPropertyKey: p(53, 'uint'),
  frame: p(67, 'uint'),
  interpolationType: p(68, 'uint'),
  interpolatorId: p(69, 'uint'),
  keyFrameDoubleValue: p(70, 'double'),
  keyFrameColorValue: p(88, 'color'),
  cubicX1: p(63, 'double'),
  cubicY1: p(64, 'double'),
  cubicX2: p(65, 'double'),
  cubicY2: p(66, 'double'),
  // state machine
  stateMachineComponentName: p(138, 'string'),
  animationId: p(149, 'uint'),
  stateToId: p(151, 'uint'),
  transitionFlags: p(152, 'uint'),
  transitionDuration: p(158, 'uint'),
  exitTime: p(160, 'uint'),
  inputId: p(155, 'uint'),
  fireEventId: p(392, 'uint'),
  fireOccurs: p(393, 'uint'),
  // assets: asset_base / file_asset_base / drawable_asset_base / file_asset_contents_base / image_base
  assetName: p(203, 'string'),
  assetId: p(204, 'uint'),
  assetHeight: p(207, 'double'),
  assetWidth: p(208, 'double'),
  assetBytes: p(212, 'bytes'),
  imageAssetId: p(206, 'uint'),
  imageOriginX: p(380, 'double'),
  imageOriginY: p(381, 'double'),
} as const satisfies Record<string, PropDef>

export type PropName = keyof typeof PROP

/** `animation/loop.hpp` */
export const LOOP = { oneShot: 0, loop: 1, pingPong: 2 } as const

/** `animation/state_transition_flags.hpp` */
export const TRANSITION_FLAG = {
  none: 0,
  disabled: 1,
  durationIsPercentage: 2,
  enableExitTime: 4,
  exitTimeIsPercentage: 8,
  pauseOnExit: 16,
} as const

/** `animation/state_machine_fire_action.hpp` StateMachineFireOccurance */
export const FIRE_OCCURS = { atStart: 0, atEnd: 1 } as const

/** KeyFrame interpolation. Verified empirically in writer tests (see interpolation probe). */
export const INTERPOLATION = { hold: 0, linear: 1, cubic: 2 } as const

/** `shapes/paint/blend_mode.hpp` */
export const BLEND_MODE = { srcOver: 3, screen: 14, lighten: 17, colorDodge: 18 } as const

/** ToC field-type indices (`runtime_header.hpp`): bool is encoded as uint, bytes as string. */
export const FIELD_INDEX: Record<FieldType, number> = {
  uint: 0,
  bool: 0,
  string: 1,
  bytes: 1,
  double: 2,
  color: 3,
}
