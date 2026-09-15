# .riv binary format (as used by `rive/writer`)

This repository generates `.riv` files without the Rive editor. Everything below was derived from
the MIT-licensed runtime sources in
[rive-app/rive-runtime](https://github.com/rive-app/rive-runtime) and verified by loading the
output with `@rive-app/canvas-advanced` 2.42.1 (see `rive/writer/toRiv.test.ts`).

## Sources of truth

| What                             | Where in rive-runtime                                               |
| -------------------------------- | ------------------------------------------------------------------- |
| Object type keys / property keys | `include/rive/generated/**/*_base.hpp` (`typeKey`, `*PropertyKey`)  |
| Header + table of contents       | `include/rive/runtime_header.hpp`                                   |
| Object stream, ownership rules   | `src/file.cpp`, `src/importers/*.cpp`                               |
| Field encodings                  | `include/rive/core/binary_reader.hpp`, `src/core/field_types/*.cpp` |
| Transition flags                 | `include/rive/animation/state_transition_flags.hpp`                 |
| Fire-event timing                | `include/rive/animation/state_machine_fire_action.hpp`              |
| Blend modes                      | `include/rive/shapes/paint/blend_mode.hpp`                          |

## Layout

```
"RIVE"                       4 bytes
major = 7, minor = 0         varuint each
fileId                       varuint (0)
ToC: propertyKey*, 0         varuint each, terminated by 0
ToC field types              one u32 per 4 keys; 2 bits per key in the LOW byte only
                             (0 uint/bool, 1 string, 2 double, 3 color)
objects*                     typeKey varuint, (propertyKey varuint, value)*, 0
```

Value encodings: `uint` LEB128 varuint · `bool` 1 byte · `double` float32 LE · `color` ARGB u32 LE ·
`string` varuint length + UTF-8. Known property keys are decoded from the runtime's registry; the
ToC types only matter for keys the runtime does not know.

## Ownership (which object belongs to what)

Objects are streamed in a flat list; ownership is positional:

- `Backboard` first, then `Artboard`. The artboard is component **index 0** of itself.
- Every component that follows belongs to the last artboard and gets the next index. `parentId`,
  `objectId` (keyed objects), `interpolatorId` and `eventId` are component indices.
- `LinearAnimation` → `KeyedObject` → `KeyedProperty` → `KeyFrame*` nest by order.
- `StateMachine` → inputs / `StateMachineLayer` → states. States are referenced by their index in
  the layer (`stateToId`). A `StateTransition`, `TransitionTriggerCondition` (`inputId` = input
  index in the state machine) or `StateMachineFireEvent` attaches to the state emitted just before.
- `CubicEaseInterpolator` is a plain artboard component (no `parentId`).
- **Embedded images**: `ImageAsset` (105: name 203, assetId 204, width 208, height 207) followed
  by `FileAssetContents` (106: bytes 212, varuint length + WebP/PNG bytes) are written between the
  `Backboard` and the `Artboard`. An `Image` drawable (100) references its asset with
  `assetId` (206). **That value is the 0-based position of the asset in the file's asset list**
  (`file.cpp` resolves referencers with `fileAssets[assetId]`), not a lookup of the
  `ImageAsset.assetId` property; the writer sets both to the same index. Images draw at their
  pixel size around `originX/Y` (380/381, default 0.5), so the writer folds the requested width
  into `scaleX/scaleY` — including keyed scale values.

## The contract this writer emits (`rive/contract.ts`)

```
inputs:   trigger "play"
layer:    Any ─[play]→ Play(anim 1) ─exit 100%→ Idle(anim 0) ; Entry → Idle
actions:  Play.end → fire Event "finished"
anims:    0 = idle (1 frame, root.opacity = 0, one-shot)  1 = play (N frames, one-shot)
```

Because the layer returns to a one-shot Idle instead of an Exit state, the same instance can be
replayed by firing `play` again, and the runtime self-pauses while idle.

## Verified empirically

- `interpolationType`: 0 hold, 1 linear, 2 cubic (`toRiv.test.ts` samples a node's `x` mid-way).
- `exitTime` with `ExitTimeIsPercentage` is 0–100; without the flag it is milliseconds.
- `StateMachineFireEvent.occurs`: 0 at start, 1 at end.
- **Draw order**: among siblings, the object written _first_ is drawn _on top_ (the editor's
  layer list order). Scenes here are authored in painter's order (later on top, like SVG), so
  `toRiv` emits siblings reversed while `toSvg` keeps them as written.
- **Keyed values persist across state changes.** The idle timeline parks `root.opacity` at 0;
  a play timeline that never keys `root.opacity` would therefore stay invisible. `toRiv` adds a
  `root.opacity = 1` hold keyframe at frame 0 to every play timeline that does not key it.
  Found with the `/lab` page: a `.riv` with only a shape's `scaleX` keyed rendered nothing.
- **Image asset ids are indices.** Numbering assets from 1 made every image show the _next_
  asset's pixels and the last one nothing (a candy box drawn with the lid's image, a bottle drawn
  as its cork). Found by screenshotting every effect in `/lab` after the switch to rendered art.
- Negative `scaleX` on an `Image` mirrors it (used for the second curtain in `suite`).

## Not covered

Data Binding (View Models), text, out-of-band/referenced assets, bones/skins, listeners, audio,
scripting. A
designer-made `.riv` will normally expose View Model triggers instead of a trigger input + Rive
Event; `src/features/gift/RiveGiftEffect.tsx` is the only place that has to change.
