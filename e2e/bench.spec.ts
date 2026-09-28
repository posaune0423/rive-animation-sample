import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { devices as playwrightDevices, expect, test, type Page } from '@playwright/test'
import {
  DEVICES,
  deviceById,
  PHONES,
  type DeviceId,
  type DeviceProfile,
} from '../src/features/bench/devices'
import { ENGINE_LABEL, ENGINES, isEngine, type Engine } from '../src/features/bench/engines'
import type { FrameMeterStats } from '../src/features/bench/frameMeter'
import { LOADS, isLoadId, loadById, onScreen, type LoadId } from '../src/features/bench/loads'
import type { BenchRun } from '../src/features/bench/RunsTable'
import type { StageState } from '../src/features/bench/stage'
import type { StartupStats } from '../src/features/bench/startup'
import { smoothness } from '../src/features/bench/verdict'

/**
 * /perf on emulated phones: for each device × load level × engine, run the load and read the
 * frame meter while the screen is full; for each device × runtime, time a cold page load on a
 * congested 4G line. Writes reports/bench.md (rows accumulate across runs, keyed by setup).
 *
 *   BENCH_DEVICES  comma list of devices.ts ids (default: every phone)
 *   BENCH_LOADS    comma list of loads.ts ids (default: all)
 *   BENCH_ENGINES  comma list of engines (default: all)
 *
 * Headless Chromium rasterizes WebGL and canvas on the CPU (SwiftShader); run headed so the GPU
 * draws: `bunx playwright test e2e/bench.spec.ts --headed`
 */
const list = <T extends string>(
  raw: string | undefined,
  valid: (v: string) => v is T,
  all: readonly T[],
) => (raw ? raw.split(',').filter(valid) : [...all])

const BENCH_DEVICES = list(
  process.env.BENCH_DEVICES,
  (v): v is DeviceId => DEVICES.some(d => d.id === v),
  PHONES.map(d => d.id),
).map(deviceById)
const BENCH_LOADS = list(
  process.env.BENCH_LOADS,
  (v): v is LoadId => isLoadId(v),
  LOADS.map(l => l.id),
).map(loadById)
const BENCH_ENGINES = list(process.env.BENCH_ENGINES, (v): v is Engine => isEngine(v), ENGINES)

/**
 * The control for what Rive's drawing path costs: BENCH_PLS=1 launches Chromium with WebGL draft
 * extensions, which offers WEBGL_shader_pixel_local_storage (Rive's fast path; off by default in
 * Chrome), and keeps it visible on every profile.
 */
const PLS = process.env.BENCH_PLS === '1'
const WEBGL = PLS ? 'default' : null

/** Lanes fill within ~2 s at every level; the meter's 2 s window is then read at 4–6 s. */
const SETTLE_MS = 6_000
/** Lighthouse's mobile throttling ("slow 4G"): 150 ms RTT, 1.6 Mbps down, 750 kbps up. */
const SLOW_4G = {
  offline: false,
  latency: 150,
  downloadThroughput: 200_000,
  uploadThroughput: 93_750,
}
const REPORT_DIR = 'reports'

type BenchWindow = Window & {
  __benchMetrics?: FrameMeterStats
  __benchStage?: StageState
  __benchRuns?: readonly BenchRun[]
  __benchStartup?: StartupStats
}

type LoadRow = BenchRun & {
  readonly cpuThrottle: number
  readonly renderer: string
  readonly pls: boolean
}
type StartupRow = {
  readonly device: DeviceId
  readonly runtime: 'rive' | 'lottie'
  readonly network: string
  readonly cpuThrottle: number
  readonly startup: StartupStats
}
type Report = { readonly runs: readonly LoadRow[]; readonly startups: readonly StartupRow[] }

const deviceOrder = (id: DeviceId) => DEVICES.findIndex(d => d.id === id)
const loadOrder = (id: LoadId | null) => LOADS.findIndex(l => l.id === id)
const gpuLabel = (renderer: string): string =>
  /swiftshader|llvmpipe|software/i.test(renderer)
    ? 'software'
    : (/Apple (M\d\w*)/.exec(renderer)?.[1] ?? renderer.slice(0, 24))

const readReport = (): Report => {
  const path = `${REPORT_DIR}/bench.json`
  if (!existsSync(path)) return { runs: [], startups: [] }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<Report>
  // rows from before device profiles have no `device`; they describe another setup
  return { runs: (parsed.runs ?? []).filter(r => r.device), startups: parsed.startups ?? [] }
}

const sec = (ms: number | null) => (ms === null ? '-' : (ms / 1000).toFixed(1))

/** Rows measured the way the browsers ship; the rest are the BENCH_PLS control. */
const onOwnPath = (r: LoadRow) => !r.pls

const render = ({ runs: allRuns, startups }: Report): string => {
  const runs = allRuns.filter(onOwnPath)
  const controls = allRuns.filter(r => !onOwnPath(r))
  const devices = DEVICES.filter(
    d => runs.some(r => r.device === d.id) || startups.some(s => s.device === d.id),
  )
  const engines = ENGINES.filter(e => runs.some(r => r.engine === e))
  const byDevice = (d: DeviceProfile) => {
    const rows = LOADS.filter(l => runs.some(r => r.device === d.id && r.load === l.id)).map(l => {
      const cells = engines.map(e => {
        const r = runs.find(x => x.device === d.id && x.load === l.id && x.engine === e)
        if (!r) return '-'
        const short = r.active < onScreen(l) ? `（同時 ${r.active} 本までしか積めず）` : ''
        return `${r.stats.fps} fps ${smoothness(r.stats.fps).label}${short}`
      })
      return `| ${l.label}（同時 ${onScreen(l)} 本・毎秒 ${l.perSecond} 件） | ${cells.join(' | ')} |`
    })
    return [
      `### ${d.label} — ${d.spec}`,
      '',
      `CPU ${d.cpuThrottle}× / DPR ${d.dpr ?? '-'} / ${d.fpsCap ?? '-'} fps 上限 / Rive 描画経路 ${d.webgl === 'safari' ? 'Safari 相当' : 'ブラウザ既定'}`,
      '',
      `| 混み具合 | ${engines.map(e => ENGINE_LABEL[e]).join(' | ')} |`,
      `|---|${engines.map(() => '---').join('|')}|`,
      ...rows,
      '',
    ]
  }
  const detailCols = [
    'device',
    'load',
    'engine',
    'active',
    'fps',
    'p95 ms',
    'long',
    'main %',
    'off-main %',
    'judge',
    'heap MB',
    'DOM',
    'instances',
    'gpu',
    'PLS',
  ]
  const controlRows = controls.map(c => {
    const own = runs.find(r => r.device === c.device && r.load === c.load && r.engine === c.engine)
    return `| ${deviceById(c.device).label} | ${loadById(c.load ?? 'normal').label} | ${ENGINE_LABEL[c.engine]} | ${own ? `${own.stats.fps} fps（${own.pls ? 'あり' : 'なし'}）` : '-'} | ${c.stats.fps} fps（${c.pls ? 'あり' : 'なし'}） |`
  })
  const detail = allRuns.map(r =>
    [
      r.device,
      r.load ?? '-',
      r.engine,
      r.active,
      r.stats.fps,
      r.stats.frameP95Ms,
      r.stats.longFrames,
      r.stats.mainBusyPct,
      r.stats.offMainPct,
      r.stats.bottleneck,
      r.stats.heapMB ?? '-',
      r.stats.domNodes,
      r.instances,
      gpuLabel(r.renderer),
      r.pls ? 'yes' : 'no',
    ].join(' | '),
  )
  const startupRows = startups.map(s =>
    [
      deviceById(s.device).label,
      s.runtime,
      s.network,
      sec(s.startup.assetsReadyMs),
      sec(s.startup.firstEffectMs),
      s.startup.transferKB.runtime,
      s.startup.transferKB.effects,
      s.startup.transferKB.total,
    ].join(' | '),
  )
  return [
    '# Rive vs Lottie — gift effects on emulated phones',
    '',
    `Generated ${new Date().toISOString()} by \`bunx playwright test e2e/bench.spec.ts --headed\` (devices in \`src/features/bench/devices.ts\`, load levels in \`src/features/bench/loads.ts\`). fps is read over 2 s while the screen holds the stated number of effects; phones render at most 60 fps.`,
    '',
    ...devices.flatMap(byDevice),
    ...(controlRows.length
      ? [
          '## 対照: Rive が高速経路（PLS = WEBGL_shader_pixel_local_storage）を使えた場合',
          '',
          '| 端末 | 混み具合 | エンジン | 出荷状態のブラウザ（PLS なし） | PLS を有効にした Chromium |',
          '|---|---|---|---|---|',
          ...controlRows,
          '',
        ]
      : []),
    '## 初回ロード（混雑した 4G: 1.6 Mbps / RTT 150 ms、キャッシュなし）',
    '',
    '| 端末 | ランタイム | 回線 | 全演出の準備完了 s | 最初の演出 s | 転送 ランタイム KB | 転送 演出 KB | 転送 計 KB |',
    '|---|---|---|---|---|---|---|---|',
    ...startupRows.map(r => `| ${r} |`),
    '',
    '## 詳細',
    '',
    `| ${detailCols.join(' | ')} |`,
    `|${detailCols.map(() => '---').join('|')}|`,
    ...detail.map(r => `| ${r} |`),
    '',
    '`main %` is the share of wall time the main thread spent producing frames; `off-main %` is time on missed frames beyond it (GPU / compositor). `PLS` = whether Rive had WEBGL_shader_pixel_local_storage (hidden for the Safari-like profiles).',
    '',
  ].join('\n')
}

/** Each test writes its own row: Playwright restarts the worker after a failure. */
const save = (update: (r: Report) => Report) => {
  mkdirSync(REPORT_DIR, { recursive: true })
  const next = update(readReport())
  const report: Report = {
    runs: next.runs.toSorted(
      (a, b) =>
        deviceOrder(a.device) - deviceOrder(b.device) ||
        loadOrder(a.load) - loadOrder(b.load) ||
        ENGINES.indexOf(a.engine) - ENGINES.indexOf(b.engine),
    ),
    startups: next.startups.toSorted(
      (a, b) => deviceOrder(a.device) - deviceOrder(b.device) || a.runtime.localeCompare(b.runtime),
    ),
  }
  writeFileSync(`${REPORT_DIR}/bench.json`, JSON.stringify(report, null, 2))
  writeFileSync(`${REPORT_DIR}/bench.md`, render(report))
}

test.use({
  ...playwrightDevices['Desktop Chrome'],
  ...(PLS
    ? {
        launchOptions: {
          args: [
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            '--enable-webgl-draft-extensions',
          ],
        },
      }
    : {}),
  viewport: { width: 1440, height: 1000 },
  hasTouch: false,
  isMobile: false,
})

const throttle = async (page: Page, device: DeviceProfile, network?: typeof SLOW_4G) => {
  const cdp = await page.context().newCDPSession(page)
  if (device.cpuThrottle > 1)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: device.cpuThrottle })
  if (network) await cdp.send('Network.emulateNetworkConditions', network)
}

const openStage = async (page: Page, device: DeviceProfile, engine: Engine) => {
  await page.goto(
    `/perf?${new URLSearchParams({ device: device.id, engine, ...(WEBGL ? { webgl: WEBGL } : {}) })}`,
  )
  await expect(page.getByTestId('bench-assets')).toContainText('10/10', { timeout: 90_000 })
}

const stage = (page: Page) =>
  page.evaluate(() => {
    const s = (window as BenchWindow).__benchStage
    if (!s) throw new Error('stage missing')
    return s
  })

const activeCount = (s: StageState) =>
  Object.values(s.lanes).reduce((n, q) => n + (q ? q.slots.filter(Boolean).length : 0), 0)

test.describe('perf bench', () => {
  for (const device of BENCH_DEVICES) {
    test.describe(device.label, () => {
      // the page's own devicePixelRatio, so Lottie SVG rasterizes at the phone's resolution too
      test.use({ deviceScaleFactor: device.dpr ?? 1 })

      for (const load of BENCH_LOADS) {
        for (const engine of BENCH_ENGINES) {
          test(`${device.id} · ${load.id} · ${engine}`, async ({ page }) => {
            test.setTimeout(120_000)
            await throttle(page, device)
            await openStage(page, device, engine)
            const env = await page.evaluate(() => {
              const gl = document.createElement('canvas').getContext('webgl2')
              const info = gl?.getExtension('WEBGL_debug_renderer_info')
              return {
                renderer:
                  gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown',
                pls: Boolean(gl?.getExtension('WEBGL_shader_pixel_local_storage')),
              }
            })
            // Safari-like profiles never have the fast path; the control always does
            if (PLS) expect(env.pls).toBe(true)
            else if (device.webgl === 'safari') expect(env.pls).toBe(false)

            await page.getByTestId(`bench-load-${load.id}`).click()
            await page.waitForTimeout(SETTLE_MS)
            // the screen fills to what the level says; a phone too slow to even process the
            // sends in time falls short, which the report shows next to its fps
            const active = activeCount(await stage(page))
            expect(active).toBeGreaterThan(0)
            expect(active).toBeLessThanOrEqual(onScreen(load))

            await page.getByTestId('bench-record').click()
            const run = (await page.evaluate(() => (window as BenchWindow).__benchRuns ?? [])).at(
              -1,
            )
            expect(run?.load).toBe(load.id)
            if (!run) return
            expect(run.stats.samples).toBeGreaterThan(10)
            const row: LoadRow = { ...run, cpuThrottle: device.cpuThrottle, ...env }
            save(r => ({
              ...r,
              runs: [
                ...r.runs.filter(
                  x =>
                    !(
                      x.device === row.device &&
                      x.load === row.load &&
                      x.engine === row.engine &&
                      x.pls === row.pls
                    ),
                ),
                row,
              ],
            }))
          })
        }
      }

      for (const runtime of ['rive', 'lottie'] as const) {
        test(`${device.id} · cold load on slow 4G · ${runtime}`, async ({ page }) => {
          test.setTimeout(150_000)
          await throttle(page, device, SLOW_4G)
          await openStage(page, device, runtime === 'rive' ? 'rive' : 'lottie-canvas')
          await page.getByTestId('bench-load-normal').click()
          await expect
            .poll(
              () =>
                page.evaluate(() => (window as BenchWindow).__benchStartup?.firstEffectMs ?? null),
              {
                timeout: 30_000,
              },
            )
            .not.toBeNull()
          const startup = await page.evaluate(() => (window as BenchWindow).__benchStartup)
          if (!startup) throw new Error('startup missing')
          const row: StartupRow = {
            device: device.id,
            runtime,
            network: 'slow 4G',
            cpuThrottle: device.cpuThrottle,
            startup,
          }
          save(r => ({
            ...r,
            startups: [
              ...r.startups.filter(x => !(x.device === row.device && x.runtime === row.runtime)),
              row,
            ],
          }))
        })
      }
    })
  }

  test('overflow: rapid taps drop the oldest waiting gifts per lane', async ({ page }) => {
    // full lane, 1 at a time, keep 3 waiting; 10 diamonds 100 ms apart
    await page.goto('/perf?engine=rive&policy=per-lane&overlap=1&overflow=drop-oldest&qmax=3')
    await expect(page.getByTestId('bench-assets')).toContainText('10/10', { timeout: 60_000 })
    await page.getByText('詳細設定').click()
    await page.getByTestId('bench-spam-diamond').click()
    await expect.poll(async () => (await stage(page)).sent).toBe(10)
    const s = await stage(page)
    expect(s.lanes.full?.slots.filter(Boolean)).toHaveLength(1)
    expect(s.lanes.full?.waiting.map(j => j.seq)).toEqual([8, 9, 10])
    await expect(page.getByTestId('bench-dropped')).toHaveText('6')
  })

  test('strict policy serialises every tier into one lane', async ({ page }) => {
    await page.goto('/perf?engine=rive&policy=strict&overlap=1')
    await expect(page.getByTestId('bench-assets')).toContainText('10/10', { timeout: 60_000 })
    await page.getByText('詳細設定').click()
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
