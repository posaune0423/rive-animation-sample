import { describe, expect, it } from 'vitest'
import { loadHeadlessRive } from './headless'
import { image, scene, type ImageAsset } from './scene'
import { timeline } from './timeline'
import { toRiv } from './toRiv'
import { toSvg } from './toSvg'

// 2×2 opaque red PNG
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP4z8DwHwyBGAgAAF+/B/fXwm8AAAAASUVORK5CYII=',
    'base64',
  ),
)

const asset: ImageAsset = { name: 'dot', bytes: PNG, mime: 'image/png', width: 2, height: 2 }

describe('embedded images', () => {
  it('writes an ImageAsset + contents and an Image drawable the runtime loads', async () => {
    const s = scene('Img', 200, 200, [image('pic', { x: 100, y: 100 }, asset, 120)])
    const bytes = toRiv(
      s,
      timeline('play', 1).key('pic', 'rotation', 0, 0).key('pic', 'rotation', 1, 1).build(),
    )
    expect(bytes.byteLength).toBeGreaterThan(PNG.byteLength)
    const rive = await loadHeadlessRive()
    // Node has no Image element to decode with; claim the asset so the runtime skips decoding.
    let sawAsset = false
    const loader = new rive.CustomFileAssetLoader({
      loadContents: (a: { name: string; isImage: boolean }) => {
        sawAsset = a.isImage && a.name === 'dot'
        return true
      },
    })
    const file = await rive.load(bytes, loader)
    expect(sawAsset).toBe(true)
    const artboard = file.artboardByIndex(0)
    expect(artboard.name).toBe('Img')
    const node = artboard.node('pic')
    expect(node.scaleX).toBeCloseTo(60)
    const sm = new rive.StateMachineInstance(artboard.stateMachineByIndex(0), artboard)
    sm.advance(0.016)
    artboard.advance(0.016)
    expect(sm.inputCount()).toBe(1)
  })

  it('inlines the image as a data URI in the SVG icon', () => {
    const s = scene('Img', 200, 200, [image('pic', { x: 100, y: 100 }, asset, 120)])
    const svg = toSvg(s)
    expect(svg).toContain(
      '<image x="-60" y="-60" width="120" height="120" href="data:image/png;base64,',
    )
  })
})
