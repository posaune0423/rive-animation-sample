import { expect, test } from '@playwright/test'
import { openReady } from './helpers'

test.describe('queue policies', () => {
  test('per-lane: chatTop / center / full each run one effect, the rest wait', async ({ page }) => {
    await openReady(page)
    await page.getByTestId('hud-send-all').click()
    // 12 gifts at 150ms intervals: T1×2 (no lane), then 3 + 3 + 4 across three lanes.
    await expect(page.getByTestId('hud-active')).toHaveText('3 / 7', { timeout: 10_000 })
    await expect(page.locator('[data-lane="chatTop"][data-active="true"]')).toHaveCount(1)
    await expect(page.locator('[data-lane="center"][data-active="true"]')).toHaveCount(1)
    await expect(page.locator('[data-lane="full"][data-active="true"]')).toHaveCount(1)
    // full-screen effects never overlap: one active at a time, T5 jumps ahead of T4
    await expect(page.locator('[data-lane="full"][data-active="true"]')).toHaveCount(1)
  })

  test('strict: T2+ are serialized into a single queue', async ({ page }) => {
    await openReady(page)
    await page.getByTestId('hud-policy').click()
    await expect(page.getByTestId('hud-policy')).toHaveText('strict')
    await page.getByTestId('hud-send-all').click()
    await expect(page.getByTestId('hud-active')).toHaveText('1 / 9', { timeout: 10_000 })
    await expect(page.locator('[data-active="true"][data-gift]')).toHaveCount(1)
  })

  test('20 rapid hearts collapse into one ×20 row', async ({ page }) => {
    await openReady(page)
    await page.getByTestId('hud-spam-hearts').click()
    await expect(page.getByTestId('combo')).toHaveText('×20', { timeout: 10_000 })
    await expect(
      page.locator('[data-testid="chat-row"][data-kind="gift"][data-tier="1"]'),
    ).toHaveCount(1)
  })

  test('purge clears every lane and pin', async ({ page }) => {
    await openReady(page)
    await page.getByTestId('hud-send-all').click()
    await expect(page.getByTestId('hud-active')).toHaveText('3 / 7', { timeout: 10_000 })
    await page.getByTestId('hud-purge').click()
    await expect(page.getByTestId('hud-active')).toHaveText('0 / 0')
    await expect(page.locator('[data-active="true"][data-gift]')).toHaveCount(0)
    await expect(page.getByTestId('pin')).toHaveCount(0)
  })
})
