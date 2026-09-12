import { mkdirSync } from 'node:fs'
import { test } from '@playwright/test'
import { GIFTS } from '../rive/catalog'
import { activeEffect, openReady, sendViaSheet } from './helpers'

const DIR = 'reports/screenshots'

/**
 * Captures one frame per T2+ gift while it plays (for visual review), plus the sheet.
 * Not an assertion suite; run with `bunx playwright test e2e/screenshots.spec.ts`.
 */
test.describe('screenshots', () => {
  test.skip(({ browserName }) => browserName !== 'chromium')

  test('sheet', async ({ page }) => {
    mkdirSync(DIR, { recursive: true })
    await openReady(page)
    await page.getByTestId('gift-button').click()
    await page.getByTestId('gift-sheet').waitFor()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${DIR}/sheet.png` })
  })

  for (const g of GIFTS.filter(x => x.tier >= 2)) {
    test(`${g.id}`, async ({ page }) => {
      mkdirSync(DIR, { recursive: true })
      await openReady(page)
      await sendViaSheet(page, g.id)
      await activeEffect(page, g.id).waitFor()
      // capture around the middle of the main phase
      await page.waitForTimeout(Math.round(g.durationMs * (g.tier === 5 ? 0.55 : 0.4)))
      await page.screenshot({ path: `${DIR}/${g.id}.png` })
    })
  }
})
