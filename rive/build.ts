/**
 * Generates every gift asset:
 *   public/gifts/<id>.svg   list icons
 *   public/rive/<id>.riv    effects (T2–T5)
 *   public/rive/rive-<v>.wasm  self-hosted runtime (same version @rive-app/react-webgl2 pins)
 *   rive/manifest.json      sizes + wasm file name for the app and the tests
 *
 * Deterministic: re-running must not change any byte.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TIER_SHAPE_BUDGET } from './contract'
import { GIFT_DEFINITIONS } from './gifts'
import { checkFaceSafe, shapeCount } from './writer/lint'
import { toRiv } from './writer/toRiv'
import { toSvg } from './writer/toSvg'

export type Manifest = {
  readonly wasm: { readonly file: string; readonly version: string; readonly bytes: number }
  readonly gifts: ReadonlyArray<{
    readonly id: string
    readonly tier: number
    readonly riv: { readonly file: string; readonly bytes: number; readonly shapes: number } | null
    readonly icon: string
  }>
}

const here = dirname(fileURLToPath(import.meta.url))
const rootDir = join(here, '..')
const publicRive = join(rootDir, 'public', 'rive')
const publicGifts = join(rootDir, 'public', 'gifts')

export const buildAll = (): Manifest => {
  mkdirSync(publicRive, { recursive: true })
  mkdirSync(publicGifts, { recursive: true })

  const require = createRequire(import.meta.url)
  const webgl2Pkg = require('@rive-app/webgl2/package.json') as { version: string }
  const wasmFile = `rive-${webgl2Pkg.version}.wasm`
  const wasmSrc = require.resolve('@rive-app/webgl2/rive.wasm')
  copyFileSync(wasmSrc, join(publicRive, wasmFile))

  const errors: string[] = []
  const gifts: Manifest['gifts'][number][] = []

  for (const gift of GIFT_DEFINITIONS) {
    const icon = `/gifts/${gift.id}.svg`
    writeFileSync(join(publicGifts, `${gift.id}.svg`), toSvg(gift.icon, { width: 64, height: 64 }))

    if (!gift.effect) {
      gifts.push({ id: gift.id, tier: gift.tier, riv: null, icon })
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
    writeFileSync(join(publicRive, `${gift.id}.riv`), bytes)
    gifts.push({
      id: gift.id,
      tier: gift.tier,
      riv: { file: `/rive/${gift.id}.riv`, bytes: bytes.byteLength, shapes },
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
      `${g.id.padEnd(10)} T${g.tier}  ${g.riv ? `${String(g.riv.bytes).padStart(6)} B  ${String(g.riv.shapes).padStart(3)} shapes` : '   (svg only)'}`,
  )
  console.log(rows.join('\n'))
  console.log(`wasm ${manifest.wasm.file} ${manifest.wasm.bytes} B`)
}
