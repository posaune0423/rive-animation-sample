import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { devices, expect, test, type Page } from '@playwright/test'
import { ENGINES, type Engine } from '../src/features/bench/engines'
import type { FrameMeterStats } from '../src/features/bench/frameMeter'
import type { BenchRun } from '../src/features/bench/RunsTable'
import type { StageState } from '../src/features/bench/stage'

/**
 * /perf under a gift pile-up on the phone-size live screen, for each engine, with the frame meter
 * read while the stage is full. Writes reports/bench.md (rows accumulate across runs).
 *
 * Scenario and device come from the environment:
 *   BENCH_SCENARIO  all-x3 (default: every gift three times, 80 ms apart) | storm
 *   BENCH_RATE / BENCH_SECONDS   storm: random T2+ gifts per second, for how long (20 / 10)
 *   BENCH_OVERLAP / BENCH_POLICY effects per lane (3) and per-lane | strict
 *   BENCH_OVERFLOW / BENCH_QMAX  queue / drop-oldest / drop-newest (storms default to drop-oldest 5)
 *   BENCH_CPU       CPU throttling factor via DevTools protocol (1 = none; 4–6 ≈ low-end phone)
 *   BENCH_DPR       render resolution for Rive / Lottie canvas (display's when unset; 3 ≈ phone)
 *
 * Headless Chromium rasterizes WebGL and canvas with SwiftShader (CPU), so run headed for a real
 * GPU: `BENCH_SCENARIO=storm BENCH_RATE=50 BENCH_OVERLAP=10 BENCH_CPU=4 BENCH_DPR=3 bunx playwright test e2e/bench.spec.ts --headed`
 */
const SCENARIO_KIND = process.env.BENCH_SCENARIO === 'storm' ? 'storm' : 'all-x3'
const RATE = Number(process.env.BENCH_RATE ?? 20)
const SECONDS = Number(process.env.BENCH_SECONDS ?? 10)
const OVERLAP = Number(process.env.BENCH_OVERLAP ?? 3)
const POLICY = process.env.BENCH_POLICY ?? 'per-lane'
const OVERFLOW = process.env.BENCH_OVERFLOW ?? (SCENARIO_KIND === 'storm' ? 'drop-oldest' : 'queue')
const QMAX = Number(process.env.BENCH_QMAX ?? 5)
const CPU = Number(process.env.BENCH_CPU ?? 1)
const DPR = process.env.BENCH_DPR ? Number(process.env.BENCH_DPR) : null
const SCENARIO = SCENARIO_KIND === 'storm' ? `嵐 ${RATE}/s × ${SECONDS}s` : '全12種 ×3'
/** Read the meter once every lane has filled: after the burst, or mid-storm. */
const SETTLE_MS = SCENARIO_KIND === 'storm' ? Math.min(SECONDS * 1000 - 500, 8_000) : 3_500
const REPORT_DIR = 'reports'

type BenchWindow = Window & {
  __benchMetrics?: FrameMeterStats
  __benchStage?: StageState
  __benchRuns?: readonly BenchRun[]
}

/** A row carries the machine it was measured on: the report mixes headless and headed runs. */
type BenchRunRow = BenchRun & { readonly cpuThrottle?: number; readonly renderer?: string }
type Report = { readonly runs: readonly BenchRunRow[] }

const isSoftware = (renderer: string): boolean => /swiftshader|llvmpipe|software/i.test(renderer)

/** Short label for the WebGL renderer, so the table stays readable; the legend has the full name. */
const gpuLabel = (renderer: string): string => {
  if (isSoftware(renderer)) return 'software'
  return /Apple (M\d\w*)/.exec(renderer)?.[1] ?? renderer.slice(0, 24)
}

/** A row is replaced when the whole setup, the engine included, is measured again. */
const setup = (r: BenchRunRow): string =>
  JSON.stringify([
    r.engine,
    r.scenario,
    r.config,
    r.render,
    r.cpuThrottle ?? 1,
    r.renderer ?? 'unknown',
  ])

/**
 * Each test writes its own row: Playwright restarts the worker after a failure, so module state
 * would lose the rows recorded before it.
 */
const writeReport = (run: BenchRunRow): void => {
  mkdirSync(REPORT_DIR, { recursive: true })
  const jsonPath = `${REPORT_DIR}/bench.json`
  const previous: Report = existsSync(jsonPath)
    ? (JSON.parse(readFileSync(jsonPath, 'utf8')) as Report)
    : { runs: [] }
  const runs = [...previous.runs.filter(r => setup(r) !== setup(run)), run].toSorted(
    (a, b) =>
      (a.renderer ?? '').localeCompare(b.renderer ?? '') ||
      (a.cpuThrottle ?? 1) - (b.cpuThrottle ?? 1) ||
      (a.render.dpr ?? 0) - (b.render.dpr ?? 0) ||
      a.config.policy.localeCompare(b.config.policy) ||
      a.config.overlap - b.config.overlap ||
      a.scenario.localeCompare(b.scenario) ||
      ENGINES.indexOf(a.engine) - ENGINES.indexOf(b.engine),
  )
  const cols = [
    'gpu',
    'cpu ×',
    'dpr',
    'policy',
    'overlap',
    'overflow',
    'scenario',
    'engine',
    'active',
    'instances',
    'fps',
    'frame avg ms',
    'p95 ms',
    'long (>33ms)',
    'dropped frames',
    'main busy %',
    'off-main %',
    'judge',
    'heap MB',
    'DOM nodes',
    'init avg / max ms',
  ]
  const rows = runs.map(r =>
    [
      gpuLabel(r.renderer ?? 'unknown'),
      r.cpuThrottle ?? 1,
      r.render.dpr ?? 'display',
      r.config.policy,
      r.config.overlap,
      r.config.overflow === 'queue' ? 'queue' : `${r.config.overflow} ${r.config.queueMax}`,
      r.scenario,
      r.engine,
      r.active,
      r.instances,
      r.stats.fps,
      r.stats.frameAvgMs,
      r.stats.frameP95Ms,
      r.stats.longFrames,
      r.stats.droppedFrames,
      r.stats.mainBusyPct,
      r.stats.offMainPct,
      r.stats.bottleneck,
      r.stats.heapMB ?? '-',
      r.stats.domNodes,
      `${r.initAvgMs ?? '-'} / ${r.initMaxMs ?? '-'}`,
    ].join(' | '),
  )
  const report = [
    '# Rive vs Lottie bench — gift pile-up on the live screen',
    '',
    `Generated ${new Date().toISOString()} by \`bunx playwright test e2e/bench.spec.ts\`.`,
    '',
    'Gifts pile into the 390×844 stream screen; `overlap` effects may play at once per lane (1 = production). Scenarios: **全12種 ×3** = every gift three times 80 ms apart (36 sends); **嵐 R/s × S s** = random T2+ gifts at R per second for S seconds. The meter is read over its 2 s window while every lane is full. `cpu ×` is DevTools CPU throttling (≈ 4–6 for a low-end phone), `dpr` the render resolution asked of Rive / Lottie canvas. Rows accumulate across runs (see the `BENCH_*` variables in `e2e/bench.spec.ts`); delete `reports/bench.json` to start over.',
    '',
    ...[...new Set(runs.map(r => r.renderer ?? 'unknown'))].map(
      name =>
        `- \`${gpuLabel(name)}\` = \`${name}\`${isSoftware(name) ? ' — **software rasterizer**: WebGL2 (Rive) and 2D canvas (Lottie canvas) run on the CPU here, so those rows rank main-thread cost, not GPU cost. Run headed on a real GPU for the decision.' : ''}`,
    ),
    '',
    `| ${cols.join(' | ')} |`,
    `|${cols.map(() => '---').join('|')}|`,
    ...rows.map(r => `| ${r} |`),
    '',
    '`active` = effects playing when recorded, `instances` = pooled runtime instances mounted. `main busy %` is the share of wall time the main thread spent producing frames; `off-main %` is time on missed-vsync frames beyond the main thread (GPU / compositor). `judge` classifies the bottleneck from those two.',
    '',
  ].join('\n')
  writeFileSync(`${REPORT_DIR}/bench.md`, report)
  writeFileSync(jsonPath, JSON.stringify({ runs }, null, 2))
}

test.use({
  ...devices['Desktop Chrome'],
  viewport: { width: 1440, height: 1000 },
  hasTouch: false,
  isMobile: false,
})

const openStage = async (page: Page, engine: Engine) => {
  const query = new URLSearchParams({
    engine,
    policy: POLICY,
    overlap: String(OVERLAP),
    overflow: OVERFLOW,
    qmax: String(QMAX),
    rate: String(RATE),
    seconds: String(SECONDS),
    ...(DPR === null ? {} : { dpr: String(DPR) }),
  })
  await page.goto(`/perf?${query}`)
  await expect(page.getByTestId('bench-assets')).toContainText('10/10', { timeout: 60_000 })
  if (CPU > 1) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  }
}

const stage = (page: Page) =>
  page.evaluate(() => {
    const s = (window as BenchWindow).__benchStage
    if (!s) throw new Error('stage missing')
    return s
  })

const totals = (s: StageState) => {
  const lanes = Object.values(s.lanes).flatMap(q => (q ? [q] : []))
  return {
    active: lanes.reduce((n, q) => n + q.slots.filter(Boolean).length, 0),
    waiting: lanes.reduce((n, q) => n + q.waiting.length, 0),
    finished: lanes.reduce((n, q) => n + q.finished, 0),
    dropped: lanes.reduce((n, q) => n + q.dropped, 0),
  }
}

test.describe('perf bench', () => {
  for (const engine of ENGINES) {
    test(`${engine}: ${SCENARIO}, ${POLICY}, overlap ${OVERLAP}, cpu ×${CPU}, dpr ${DPR ?? 'display'}`, async ({
      page,
    }) => {
      // With overlap 1 the full lane alone plays 3 × (8 + 8 + 12 + 12) s = 120 s before it drains.
      test.setTimeout(240_000 + SECONDS * 1000)
      await openStage(page, engine)
      const renderer = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2')
        const info = gl?.getExtension('WEBGL_debug_renderer_info')
        return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown'
      })

      await page
        .getByTestId(SCENARIO_KIND === 'storm' ? 'bench-storm' : 'bench-send-all-x3')
        .click()
      await page.waitForTimeout(SETTLE_MS)
      const mid = totals(await stage(page))
      // every lane is saturated: 3 lanes × overlap (per-lane) or one lane × overlap (strict);
      // a storm's random mix may leave a lane short, so only the burst asserts the exact count
      const laneCount = POLICY === 'strict' ? 1 : 3
      if (SCENARIO_KIND === 'all-x3') expect(mid.active).toBe(laneCount * OVERLAP)
      expect(mid.active).toBeGreaterThan(0)
      expect(mid.waiting).toBeGreaterThan(0)

      await page.getByTestId('bench-record').click()
      const run = (await page.evaluate(() => (window as BenchWindow).__benchRuns ?? [])).at(-1)
      expect(run).toBeDefined()
      if (!run) return
      writeReport({ ...run, cpuThrottle: CPU, renderer })
      expect(run.stats.samples).toBeGreaterThan(10)

      // The queue drains: everything that started reports its end (dropped gifts never start).
      if (SCENARIO_KIND === 'storm')
        await page.waitForTimeout(Math.max(0, SECONDS * 1000 - SETTLE_MS))
      await expect
        .poll(
          async () => {
            const s = await stage(page)
            const t = totals(s)
            return t.active === 0 && t.waiting === 0 ? t.finished : -1
          },
          { timeout: 200_000 },
        )
        .toBeGreaterThan(0)
      const end = totals(await stage(page))
      if (SCENARIO_KIND === 'all-x3') expect(end.finished).toBe(30)
    })
  }

  test('overflow: rapid taps drop the oldest waiting gifts per lane', async ({ page }) => {
    // full lane, 1 at a time, keep 3 waiting; 10 diamonds 100 ms apart
    await page.goto('/perf?engine=rive&policy=per-lane&overlap=1&overflow=drop-oldest&qmax=3')
    await expect(page.getByTestId('bench-assets')).toContainText('10/10', { timeout: 60_000 })
    await page.getByTestId('bench-spam-diamond').click()
    await expect.poll(async () => (await stage(page)).sent).toBe(10)
    const s = await stage(page)
    expect(s.lanes.full?.slots.filter(Boolean)).toHaveLength(1)
    expect(s.lanes.full?.waiting.map(j => j.seq)).toEqual([8, 9, 10])
    expect(totals(s).dropped).toBe(6)
    await expect(page.getByTestId('bench-dropped')).toHaveText('6')
  })

  test('strict policy serialises every tier into one lane', async ({ page }) => {
    await page.goto('/perf?engine=rive&policy=strict&overlap=1')
    await expect(page.getByTestId('bench-assets')).toContainText('10/10', { timeout: 60_000 })
    await page.getByTestId('bench-send-all').click()
    await expect.poll(async () => (await stage(page)).sent).toBe(12)
    const s = await stage(page)
    expect(Object.keys(s.lanes)).toEqual(['stage'])
    expect(s.lanes.stage?.slots[0]?.giftId).toBe('candy')
    expect(s.lanes.stage?.waiting).toHaveLength(9)
    // the effect still draws where its tier says: a T2 in the chat column
    await expect(page.locator('[data-lane-slot="chatTop"] [data-active="true"]')).toHaveCount(1)
  })
})
