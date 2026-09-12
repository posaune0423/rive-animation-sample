import { expect, test } from '@playwright/test'
import { GIFTS } from '../rive/catalog'
import { activeEffect, metrics, openReady, paintedRatio, sendViaSheet } from './helpers'

test.describe('gift flow', () => {
  test('sheet shows 12 gifts cheapest-first with the heart preselected', async ({ page }) => {
    await openReady(page)
    await page.getByTestId('gift-button').click()
    const tiles = page.locator('[data-testid^="gift-tile-"]')
    await expect(tiles).toHaveCount(12)
    const ids = await tiles.evaluateAll(els => els.map(el => el.getAttribute('data-testid')))
    expect(ids).toEqual(GIFTS.map(g => `gift-tile-${g.id}`))
    await expect(page.getByTestId('gift-tile-heart')).toHaveAttribute('aria-pressed', 'true')
  })

  test('T1 pops in the chat row without confirmation and collapses repeats into ×n', async ({
    page,
  }) => {
    await openReady(page)
    await page.getByTestId('gift-button').click()
    for (let i = 0; i < 3; i++) await page.getByTestId('gift-tile-heart').click()
    await page.keyboard.press('Escape')
    const row = page.locator('[data-testid="chat-row"][data-kind="gift"][data-tier="1"]')
    await expect(row).toHaveCount(1)
    await expect(row).toHaveAttribute('data-count', '3')
    await expect(page.getByTestId('combo')).toHaveText('×3')
    await expect(page.getByTestId('gift-stage').locator('[data-active="true"]')).toHaveCount(0)
  })

  for (const g of GIFTS.filter(x => x.tier >= 2)) {
    test(`${g.id} (T${g.tier}) plays in the ${g.lane} lane for ~${g.durationMs}ms`, async ({
      page,
    }) => {
      await openReady(page)
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      page.on('console', m => {
        if (m.type() === 'error') errors.push(m.text())
      })

      await sendViaSheet(page, g.id)
      const effect = activeEffect(page, g.id)
      await expect(effect).toHaveCount(1)
      await expect(effect).toHaveAttribute('data-lane', g.lane)
      // something is actually drawn during the main phase
      await page.waitForTimeout(Math.round(g.durationMs * 0.4))
      expect(await paintedRatio(page, `[data-gift="${g.id}"]`)).toBeGreaterThan(0.005)
      await expect(effect).toHaveCount(0, { timeout: g.durationMs + 3_000 })
      // trigger → "finished" Rive Event, measured inside the page
      const play = (await metrics(page)).plays.findLast(p => p.giftId === g.id)
      expect(play?.finishedMs ?? Infinity).toBeGreaterThan(g.durationMs - 150)
      expect(play?.finishedMs ?? Infinity).toBeLessThan(g.durationMs + 400)

      if (g.pinSec > 0) {
        await expect(page.getByTestId('pin').first()).toContainText(g.name)
      }
      expect(errors).toEqual([])
    })
  }
})
