import { expect, type Page } from '@playwright/test'
import { GIFTS, type GiftCatalogEntry, type GiftId } from '../rive/catalog'
import type { GiftMetrics } from '../src/features/gift/metrics'

export const gift = (id: GiftId): GiftCatalogEntry => {
  const found = GIFTS.find(g => g.id === id)
  if (!found) throw new Error(id)
  return found
}

/** Waits until every .riv has been parsed and the WASM runtime is ready. */
export const openReady = async (page: Page): Promise<void> => {
  await page.goto('/')
  await expect(page.getByTestId('gift-button')).toBeVisible()
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const m = (window as Window & { __giftMetrics?: GiftMetrics }).__giftMetrics
          return m?.wasm !== null && m?.wasm !== undefined && Object.keys(m.files).length
        }),
      { timeout: 30_000 },
    )
    .toBe(10)
}

export const openSheet = async (page: Page): Promise<void> => {
  await page.getByTestId('gift-button').click()
  await expect(page.getByTestId('gift-sheet')).toBeVisible()
}

/** Sends one gift through the real UI (tap tile, confirm for T2+). Leaves the sheet closed. */
export const sendViaSheet = async (page: Page, id: GiftId): Promise<void> => {
  await openSheet(page)
  await page.getByTestId(`gift-tile-${id}`).click()
  if (gift(id).tier >= 2) {
    await page.getByTestId('gift-confirm-send').click()
  } else {
    await page.keyboard.press('Escape')
  }
  await expect(page.getByTestId('gift-sheet')).toBeHidden()
}

export const metrics = (page: Page): Promise<GiftMetrics> =>
  page.evaluate(() => {
    const m = (window as Window & { __giftMetrics?: GiftMetrics }).__giftMetrics
    if (!m) throw new Error('metrics missing')
    return m
  })

export const activeEffect = (page: Page, id: GiftId) =>
  page.locator(`[data-gift="${id}"][data-active="true"]`)

/** Fraction (0–1) of non-transparent pixels on the Rive canvas inside `selector`. */
export const paintedRatio = (page: Page, selector: string): Promise<number> =>
  page.evaluate(sel => {
    const canvas = document.querySelector<HTMLCanvasElement>(`${sel} canvas`)
    if (!canvas || canvas.width === 0) return 0
    const probe = document.createElement('canvas')
    probe.width = canvas.width
    probe.height = canvas.height
    const ctx = probe.getContext('2d')
    if (!ctx) return 0
    ctx.drawImage(canvas, 0, 0)
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height)
    let painted = 0
    for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 8) painted++
    return painted / (probe.width * probe.height)
  }, selector)
