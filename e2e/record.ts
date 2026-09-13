/**
 * Records every gift being sent through the real UI into one video.
 *
 *   bun run e2e/record.ts http://localhost:3100 reports/gift-effects.webm
 *
 * Sends T1 (hearts ×n, kiss) and then each T2–T5 gift one at a time, waiting for the effect to
 * finish so nothing queues. Playwright writes WebM; nothing here is committed. Encode it and put
 * it in the pull request, where GitHub renders an attached video as a player:
 *
 *   ffmpeg -i reports/gift-effects.webm -c:v h264_videotoolbox -b:v 700k -pix_fmt yuv420p \
 *     -movflags +faststart reports/gift-effects.mp4
 *   gh pr edit <n> --attach reports/gift-effects.mp4      # needs gh 2.99.0+
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { chromium, devices } from '@playwright/test'
import { GIFTS } from '../rive/catalog'

const [base = 'http://localhost:3100', out = 'reports/gift-effects.webm'] = process.argv.slice(2)
mkdirSync(dirname(out), { recursive: true })

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const iphone = devices['iPhone 14']
const context = await browser.newContext({
  ...iphone,
  deviceScaleFactor: 2,
  recordVideo: { dir: dirname(out), size: iphone.viewport },
})
const page = await context.newPage()
await page.goto(base)
// the debug HUD is not part of the effect
await page.addStyleTag({ content: '[data-testid="hud"]{display:none}' })
await page.getByTestId('gift-button').waitFor()
// let the wasm + every .riv finish loading so the first plays are not slowed by parsing
await page.waitForFunction(() => {
  const m = (window as Window & { __giftMetrics?: { wasm: unknown; files: object } }).__giftMetrics
  return m?.wasm && Object.keys(m.files).length === 10
})
await page.waitForTimeout(800)

const send = async (id: string, tier: number) => {
  await page.getByTestId('gift-button').click()
  await page.getByTestId('gift-sheet').waitFor()
  await page.getByTestId(`gift-tile-${id}`).click()
  if (tier >= 2) await page.getByTestId('gift-confirm-send').click()
  else await page.keyboard.press('Escape')
  await page.getByTestId('gift-sheet').waitFor({ state: 'hidden' })
}

for (let i = 0; i < 4; i++) await send('heart', 1)
await page.waitForTimeout(900)
await send('kiss', 1)
await page.waitForTimeout(900)
for (const g of GIFTS.filter(entry => entry.tier >= 2)) {
  await send(g.id, g.tier)
  await page
    .locator(`[data-gift="${g.id}"][data-active="true"]`)
    .waitFor({ state: 'hidden', timeout: 30_000 })
  await page.waitForTimeout(600)
}
await page.waitForTimeout(1200)

const video = page.video()
await context.close()
const recorded = await video?.path()
if (!recorded) throw new Error('no video recorded')
copyFileSync(recorded, out)
await browser.close()
console.log(`wrote ${out}`)
