/**
 * Renders gift artwork with headless Blender and post-processes it into WebP.
 *
 *   bun run art/render.ts            # every job
 *   bun run art/render.ts ring candy # selected gifts
 *   PREVIEW=1 bun run art/render.ts  # low samples / low res for quick looks
 *
 * Output: art/renders/<job>.webp (and <job>_fNN.webp for turntables). Committed; `riv:build`
 * embeds them. Requires /Applications/Blender.app, ImageMagick (`magick`) and `cwebp`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const BLENDER = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender'
const OUT_DIR = join(here, 'renders')
const TMP_ROOT = join(here, '.tmp')
const preview = process.env.PREVIEW === '1'

export type RenderJob = {
  /** Output file stem: art/renders/<id>.webp */
  readonly id: string
  readonly script: string
  /** Multi-part gifts render each part alone with the same camera (`part=` arg). */
  readonly part?: string
  /** Rendered pixel size (square unless `resY`). Post-process downsizes to `outPx`×`outPy`. */
  readonly res?: number
  readonly resY?: number
  readonly outPx: number
  readonly outPy?: number
  readonly samples?: number
  readonly turntable?: number
  readonly quality?: number
}

const square = (
  id: string,
  script: string,
  outPx: number,
  extra: Partial<RenderJob> = {},
): RenderJob => ({
  id,
  script,
  outPx,
  res: Math.min(1024, outPx * 3),
  ...extra,
})

export const JOBS: readonly RenderJob[] = [
  // T1 (icons + chat pop)
  square('heart', 'heart.py', 256),
  square('kiss', 'kiss.py', 256),
  // T2 — chat-top icon, two-part where something moves (`all` doubles as the list icon)
  square('candy', 'candy.py', 256),
  square('candy_box', 'candy.py', 256, { part: 'box' }),
  square('candy_lid', 'candy.py', 256, { part: 'lid' }),
  square('sparkling', 'sparkling.py', 256),
  square('sparkling_bottle', 'sparkling.py', 256, { part: 'bottle' }),
  square('sparkling_cork', 'sparkling.py', 256, { part: 'cork' }),
  square('plush', 'plush.py', 256),
  // T3 — center of the video
  square('bouquet_closed', 'bouquet.py', 384, { part: 'closed' }),
  square('bouquet_open', 'bouquet.py', 384, { part: 'open' }),
  square('perfume', 'perfume.py', 384),
  square('perfume_bottle', 'perfume.py', 384, { part: 'bottle' }),
  square('perfume_cap', 'perfume.py', 384, { part: 'cap' }),
  square('ring', 'ring.py', 320, { res: 768, samples: 160, turntable: 24 }),
  // T4 — full frame
  square('diamond', 'diamond.py', 320, { res: 768, samples: 160, turntable: 24 }),
  {
    id: 'suite_frame',
    script: 'suite.py',
    part: 'frame',
    res: 585,
    resY: 1266,
    outPx: 390,
    outPy: 844,
  },
  {
    id: 'suite_curtain',
    script: 'suite.py',
    part: 'curtain',
    res: 585,
    resY: 1266,
    outPx: 390,
    outPy: 844,
  },
  square('suite_icon', 'suite.py', 256, { part: 'icon' }),
  // T5 — full frame, individually drawn
  { id: 'palace', script: 'palace.py', res: 780, resY: 1080, outPx: 520, outPy: 720 },
  square('myth_medallion', 'myth.py', 512),
]

const run = (job: RenderJob) => {
  mkdirSync(OUT_DIR, { recursive: true })
  // per-job scratch dir so several renders can run at once
  const TMP = join(TMP_ROOT, job.id)
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  const fullRes = job.res ?? 1024
  const res = preview ? 384 : fullRes
  const resY = preview ? Math.round(384 * ((job.resY ?? fullRes) / fullRes)) : (job.resY ?? fullRes)
  const samples = preview ? 32 : (job.samples ?? 256)
  const frames = job.turntable ?? 1
  const png = join(TMP, `${job.id}.png`)
  const t0 = Date.now()
  execFileSync(
    BLENDER,
    [
      '-b',
      '-P',
      join(here, 'blender', 'gifts', job.script),
      '--',
      `out=${png}`,
      `res=${res}`,
      `resy=${resY}`,
      `samples=${samples}`,
      `frames=${frames}`,
      `turntable=${frames > 1 ? 1 : 0}`,
      `part=${job.part ?? 'all'}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const produced = readdirSync(TMP).filter(f => f.startsWith(job.id) && f.endsWith('.png'))
  for (const f of produced) {
    const src = join(TMP, f)
    const out = join(OUT_DIR, f.replace(/\.png$/, '.webp'))
    const w = preview ? Math.round(job.outPx / 2) : job.outPx
    const h = preview ? Math.round((job.outPy ?? job.outPx) / 2) : (job.outPy ?? job.outPx)
    // Lanczos downsample (supersampling) then lossy WebP with a clean alpha channel.
    execFileSync('magick', [
      src,
      '-filter',
      'Lanczos',
      '-resize',
      `${w}x${h}`,
      '-background',
      'none',
      '-gravity',
      'center',
      '-extent',
      `${w}x${h}`,
      `${src}.resized.png`,
    ])
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      String(job.quality ?? 84),
      '-alpha_q',
      '92',
      '-m',
      '6',
      `${src}.resized.png`,
      '-o',
      out,
    ])
  }
  console.log(`${job.id}: ${produced.length} frame(s) in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  rmSync(TMP, { recursive: true, force: true })
}

const wanted = process.argv.slice(2)
const jobs = wanted.length
  ? JOBS.filter(j => wanted.includes(j.id) || wanted.includes(j.script.replace(/\.py$/, '')))
  : JOBS
if (jobs.length === 0) throw new Error(`no job matches: ${wanted.join(' ')}`)
if (!existsSync(BLENDER)) throw new Error(`Blender not found at ${BLENDER}`)
for (const job of jobs) run(job)
