import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GIFTS } from '../catalog'
import {
  RIVE_CONTRACT,
  TIER_DURATION_SEC,
  TIER_FILE_BUDGET_KB,
  TIER_SHAPE_BUDGET,
} from '../contract'
import { GIFT_DEFINITIONS } from './index'
import { loadHeadlessRive } from '../writer/headless'
import { checkFaceSafe, shapeCount } from '../writer/lint'
import { collectAssets } from '../writer/scene'
import { toRiv } from '../writer/toRiv'

const publicDir = join(import.meta.dirname, '..', '..', 'public')

const effects = GIFT_DEFINITIONS.flatMap(g => (g.effect ? [{ ...g, effect: g.effect }] : []))

describe('gift definitions', () => {
  it('cover the 12 catalog entries, T1 icon-only and T2+ with an effect', () => {
    expect(GIFT_DEFINITIONS.map(g => g.id)).toEqual(GIFTS.map(g => g.id))
    for (const g of GIFT_DEFINITIONS) {
      expect(g.effect === undefined).toBe(g.tier === 1)
    }
  })

  it.each(effects)('$id stays within the shape budget and the tier duration', gift => {
    expect(shapeCount(gift.effect.scene)).toBeLessThanOrEqual(
      TIER_SHAPE_BUDGET[gift.tier as 2 | 3 | 4 | 5],
    )
    expect(gift.effect.play.duration).toBe(TIER_DURATION_SEC[gift.tier])
  })

  it.each(effects.filter(g => g.tier >= 4))('$id keeps the face-safe area clear at rest', gift => {
    expect(checkFaceSafe(gift.effect.scene)).toEqual([])
  })

  it.each(effects)(
    '$id: committed public/rive file matches a fresh build (deterministic)',
    gift => {
      const committed = readFileSync(join(publicDir, 'rive', `${gift.id}.riv`))
      const fresh = toRiv(gift.effect.scene, gift.effect.play)
      expect(Buffer.from(fresh).equals(committed)).toBe(true)
      expect(fresh.byteLength / 1024).toBeLessThanOrEqual(
        TIER_FILE_BUDGET_KB[gift.tier as 2 | 3 | 4 | 5],
      )
    },
  )

  it.each(effects)(
    '$id: loads, exposes the contract and reports "finished" on time',
    async gift => {
      const rive = await loadHeadlessRive()
      // Node cannot decode images (no `Image`); claim every embedded asset instead and check
      // that the file carries exactly the renders the scene references.
      const seenAssets: string[] = []
      const loader = new rive.CustomFileAssetLoader({
        loadContents: (asset: { name: string; isImage: boolean }) => {
          if (asset.isImage) seenAssets.push(asset.name)
          return true
        },
      })
      const file = await rive.load(
        new Uint8Array(readFileSync(join(publicDir, 'rive', `${gift.id}.riv`))),
        loader,
      )
      expect(seenAssets).toEqual(collectAssets(gift.effect.scene).map(a => a.name))
      const artboard = file.artboardByIndex(0)
      expect(artboard.name).toBe(gift.id)
      const sm = new rive.StateMachineInstance(artboard.stateMachineByIndex(0), artboard)
      expect(sm.input(0).name).toBe(RIVE_CONTRACT.playTrigger)

      const step = 1 / 60
      const duration = TIER_DURATION_SEC[gift.tier]
      const finished: number[] = []
      const tick = (t: number) => {
        sm.advance(step)
        artboard.advance(step)
        for (let i = 0; i < sm.reportedEventCount(); i++) {
          if (sm.reportedEventAt(i)?.name === RIVE_CONTRACT.finishedEvent) finished.push(t)
        }
      }
      for (let t = 0; t < 0.2; t += step) tick(t)
      sm.input(0).asTrigger().fire()
      for (let t = 0; t < duration + 0.5; t += step) tick(t + step)
      expect(finished).toHaveLength(1)
      expect(finished[0]).toBeGreaterThan(duration - 0.05)
      expect(finished[0]).toBeLessThan(duration + 0.2)
    },
  )
})
