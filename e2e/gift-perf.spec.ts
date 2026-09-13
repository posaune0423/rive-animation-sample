import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { GIFTS } from '../rive/catalog'
import { TIER_FILE_BUDGET_KB } from '../rive/contract'
import { activeEffect, metrics, openReady, sendViaSheet } from './helpers'

const REPORT_DIR = 'reports'
const ms = (v: number | null | undefined) => (v === null || v === undefined ? '-' : v.toFixed(1))

test.describe('performance', () => {
  test('load sizes/times, replay latency and frame pacing under concurrent effects', async ({
    page,
  }) => {
    await openReady(page)
    const loaded = await metrics(page)

    // Every .riv stays within its tier's file budget (embedded WebP renders included).
    for (const g of GIFTS.filter(x => x.rivSrc)) {
      const f = loaded.files[g.id]
      expect(f, g.id).toBeDefined()
      expect(f?.bytes ?? Infinity, g.id).toBeLessThanOrEqual(
        TIER_FILE_BUDGET_KB[g.tier as 2 | 3 | 4 | 5] * 1024,
      )
    }
    expect(loaded.wasm?.loadMs ?? Infinity).toBeLessThan(10_000)

    // Warm-up: first play of each full/center gift creates the pooled instance.
    await sendViaSheet(page, 'candy')
    await expect(activeEffect(page, 'candy')).toHaveCount(0, { timeout: 8_000 })

    // Replay latency: second play of the same gift must not rebuild anything.
    await sendViaSheet(page, 'candy')
    await expect(activeEffect(page, 'candy')).toHaveCount(1)
    const afterReplay = await metrics(page)
    const replay = afterReplay.plays.at(-1)
    expect(replay?.giftId).toBe('candy')
    await expect.poll(async () => (await metrics(page)).plays.at(-1)?.firstAdvanceMs).not.toBeNull()
    const replayLatency = (await metrics(page)).plays.at(-1)?.firstAdvanceMs ?? Infinity
    expect(replayLatency).toBeLessThan(50)

    // Stress: T5 full-screen + T3 center + T2 chatTop at once, sample frames for 4s.
    await page.getByTestId('hud-send-all').click()
    await expect(page.getByTestId('hud-active')).toHaveText('3 / 7', { timeout: 10_000 })
    await page.waitForTimeout(4_000)
    const stressed = await metrics(page)
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2')
      const info = gl?.getExtension('WEBGL_debug_renderer_info')
      return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown'
    })
    // Headless Chromium draws WebGL with SwiftShader (CPU). Only a real GPU is held to 50 fps;
    // the software path still has to stay interactive and is reported for reference.
    const softwareGpu = /swiftshader|llvmpipe|software/i.test(renderer)
    const fpsFloor = softwareGpu ? 25 : 50

    mkdirSync(REPORT_DIR, { recursive: true })
    const rows = GIFTS.filter(g => g.rivSrc).map(g => {
      const f = loaded.files[g.id]
      const firstPlay = stressed.plays.find(p => p.giftId === g.id)
      return `| ${g.id} | T${g.tier} | ${g.lane} | ${f ? (f.bytes / 1024).toFixed(1) : '-'} | ${f?.loadMs ?? '-'} | ${ms(firstPlay?.firstAdvanceMs)} |`
    })
    const report = [
      '# Gift effect metrics',
      '',
      `Generated ${new Date().toISOString()} by \`bun run e2e\` (Playwright, Chromium, iPhone 14 viewport).`,
      '',
      '## Runtime',
      '',
      '| item | value |',
      '|---|---|',
      `| wasm url | ${loaded.wasm?.url} |`,
      `| wasm compressed / raw | ${loaded.wasm?.encodedBytes ? `${(loaded.wasm.encodedBytes / 1024).toFixed(0)} KB` : 'n/a'} / ${loaded.wasm?.decodedBytes ? `${(loaded.wasm.decodedBytes / 1024).toFixed(0)} KB` : 'n/a'} |`,
      `| wasm fetch + compile | ${loaded.wasm?.loadMs} ms |`,
      `| first Rive instance ready | ${afterReplay.wasm?.firstInstanceMs ?? '-'} ms |`,
      `| replay latency (trigger → first advance) | ${ms(replayLatency)} ms |`,
      '',
      '## Frame pacing (T2 + T3 + T5 concurrently, 4 s window)',
      '',
      `WebGL renderer: \`${renderer}\`${softwareGpu ? ' (software rasterizer — not representative of a phone GPU)' : ''}`,
      '',
      '| samples | fps avg | p95 frame | long frames (>33 ms) |',
      '|---|---|---|---|',
      `| ${stressed.frames.samples} | ${stressed.frames.fpsAvg} | ${stressed.frames.p95Ms} ms | ${stressed.frames.longFrames} |`,
      '',
      '## Files',
      '',
      '| gift | tier | lane | .riv KB | parse ms | first play latency ms |',
      '|---|---|---|---|---|---|',
      ...rows,
      '',
    ].join('\n')
    writeFileSync(`${REPORT_DIR}/metrics.md`, report)
    writeFileSync(
      `${REPORT_DIR}/metrics.json`,
      JSON.stringify({ renderer, loaded, afterReplay, stressed }, null, 2),
    )

    expect(stressed.frames.samples).toBeGreaterThan(60)
    expect(stressed.frames.fpsAvg).toBeGreaterThanOrEqual(fpsFloor)
    if (!softwareGpu) {
      expect(stressed.frames.longFrames / stressed.frames.samples).toBeLessThanOrEqual(0.05)
    }
  })
})
