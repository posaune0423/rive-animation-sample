/**
 * Generates every gift asset:
 *   public/gifts/<id>.webp  list icons (copied renders, or rasterized vector fallback)
 *   public/rive/<id>.riv    effects (T2–T5)
 *   public/lottie/<id>.json the same effects compiled to Lottie (for the /perf comparison)
 *   public/rive/rive-<v>.wasm  self-hosted runtime (same version @rive-app/react-webgl2 pins)
 *   rive/manifest.json      sizes + wasm file name for the app and the tests
 *
 * Deterministic: re-running must not change any byte.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TIER_FILE_BUDGET_KB, TIER_SHAPE_BUDGET } from './contract'
import { GIFT_DEFINITIONS } from './gifts'
import { checkFaceSafe, shapeCount } from './writer/lint'
import { toLottie } from './writer/toLottie'
import { toRiv } from './writer/toRiv'
import { toSvg } from './writer/toSvg'

export type Manifest = {
  readonly wasm: { readonly file: string; readonly version: string; readonly bytes: number }
  readonly gifts: ReadonlyArray<{
    readonly id: string
    readonly tier: number
    readonly riv: { readonly file: string; readonly bytes: number; readonly shapes: number } | null
    readonly lottie: {
      readonly file: string
      readonly bytes: number
      readonly layers: number
    } | null
    readonly icon: string
  }>
}

const here = dirname(fileURLToPath(import.meta.url))
const rootDir = join(here, '..')
const publicRive = join(rootDir, 'public', 'rive')
const publicGifts = join(rootDir, 'public', 'gifts')
const publicLottie = join(rootDir, 'public', 'lottie')
const rendersDir = join(rootDir, 'art', 'renders')

/** Every layer, precomp contents included (one per scene node). */
const countLottieLayers = (anim: ReturnType<typeof toLottie>): number =>
  anim.layers.length + anim.assets.reduce((n, a) => n + ('layers' in a ? a.layers.length : 0), 0)

export const buildAll = (): Manifest => {
  mkdirSync(publicRive, { recursive: true })
  mkdirSync(publicGifts, { recursive: true })
  mkdirSync(publicLottie, { recursive: true })

  const require = createRequire(import.meta.url)
  const webgl2Pkg = require('@rive-app/webgl2/package.json') as { version: string }
  const wasmFile = `rive-${webgl2Pkg.version}.wasm`
  const wasmSrc = require.resolve('@rive-app/webgl2/rive.wasm')
  copyFileSync(wasmSrc, join(publicRive, wasmFile))

  const errors: string[] = []
  const gifts: Manifest['gifts'][number][] = []

  for (const gift of GIFT_DEFINITIONS) {
    const icon = `/gifts/${gift.id}.webp`
    const iconOut = join(publicGifts, `${gift.id}.webp`)
    if (gift.iconRender) {
      copyFileSync(join(rendersDir, `${gift.iconRender}.webp`), iconOut)
    } else if (!gift.icon) {
      throw new Error(`${gift.id}: needs icon or iconRender`)
    } else {
      // vector fallback until a render exists: rasterize the SVG icon with ImageMagick
      const svg = join(publicGifts, `${gift.id}.svg`)
      writeFileSync(svg, toSvg(gift.icon, { width: 128, height: 128 }))
      execFileSync('magick', [
        '-background',
        'none',
        '-density',
        '192',
        svg,
        '-resize',
        '128x128',
        iconOut,
      ])
      rmSync(svg)
    }

    if (!gift.effect) {
      gifts.push({ id: gift.id, tier: gift.tier, riv: null, lottie: null, icon })
      continue
    }
    const { scene, play } = gift.effect
    const shapes = shapeCount(scene)
    const budget = gift.tier === 1 ? 0 : TIER_SHAPE_BUDGET[gift.tier]
    if (shapes > budget)
      errors.push(`${gift.id}: ${shapes} shapes exceeds the T${gift.tier} budget (${budget})`)
    if (gift.tier >= 4) {
      for (const v of checkFaceSafe(scene)) errors.push(`${gift.id}: ${v}`)
    }
    const bytes = toRiv(scene, play)
    const kb = bytes.byteLength / 1024
    if (gift.tier !== 1 && kb > TIER_FILE_BUDGET_KB[gift.tier]) {
      errors.push(`${gift.id}: ${kb.toFixed(0)} KB exceeds the T${gift.tier} file budget`)
    }
    writeFileSync(join(publicRive, `${gift.id}.riv`), bytes)
    const lottie = toLottie(scene, play)
    const lottieJson = JSON.stringify(lottie)
    writeFileSync(join(publicLottie, `${gift.id}.json`), lottieJson)
    gifts.push({
      id: gift.id,
      tier: gift.tier,
      riv: { file: `/rive/${gift.id}.riv`, bytes: bytes.byteLength, shapes },
      lottie: {
        file: `/lottie/${gift.id}.json`,
        bytes: Buffer.byteLength(lottieJson),
        layers: countLottieLayers(lottie),
      },
      icon,
    })
  }

  if (errors.length > 0) {
    throw new Error(`riv:build failed:\n${errors.map(e => `  - ${e}`).join('\n')}`)
  }

  const manifest: Manifest = {
    wasm: {
      file: `/rive/${wasmFile}`,
      version: webgl2Pkg.version,
      bytes: readFileSync(wasmSrc).byteLength,
    },
    gifts,
  }
  writeFileSync(join(here, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const manifest = buildAll()
  const rows = manifest.gifts.map(
    g =>
      `${g.id.padEnd(10)} T${g.tier}  ${g.riv ? `${String(g.riv.bytes).padStart(6)} B  ${String(g.riv.shapes).padStart(3)} shapes` : '   (svg only)'}${g.lottie ? `  lottie ${String(g.lottie.bytes).padStart(7)} B  ${String(g.lottie.layers).padStart(3)} layers` : ''}`,
  )
  console.log(rows.join('\n'))
  console.log(`wasm ${manifest.wasm.file} ${manifest.wasm.bytes} B`)
}
