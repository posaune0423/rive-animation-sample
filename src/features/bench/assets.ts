'use client'

import { EventType, RiveFile } from '@rive-app/react-webgl2'
import { GIFTS, giftById, type GiftId } from '@rive/catalog'
import { useEffect, useState } from 'react'
import { preloadRiveRuntime } from '../gift/rive/runtime'
import { isRive, type Engine } from './engines'

/** A parsed animation file, loaded once per (engine family, gift) and shared by every tile. */
export type BenchAsset =
  | {
      readonly kind: 'rive'
      readonly file: RiveFile
      readonly bytes: number
      readonly loadMs: number
    }
  | {
      readonly kind: 'lottie'
      readonly data: object
      readonly bytes: number
      readonly loadMs: number
    }

const cache = new Map<string, Promise<BenchAsset>>()

const loadRive = async (giftId: GiftId): Promise<BenchAsset> => {
  const src = giftById(giftId).rivSrc
  if (!src) throw new Error(`${giftId} has no .riv`)
  const t0 = performance.now()
  const [buffer] = await Promise.all([
    fetch(src).then(res => res.arrayBuffer()),
    preloadRiveRuntime(),
  ])
  const file = new RiveFile({ buffer })
  await new Promise<void>((resolve, reject) => {
    file.on(EventType.Load, () => resolve())
    file.on(EventType.LoadError, () => reject(new Error(`${src}: RiveFile failed to load`)))
    void file.init()
  })
  return { kind: 'rive', file, bytes: buffer.byteLength, loadMs: performance.now() - t0 }
}

const loadLottie = async (giftId: GiftId): Promise<BenchAsset> => {
  const src = giftById(giftId).lottieSrc
  if (!src) throw new Error(`${giftId} has no Lottie file`)
  const t0 = performance.now()
  const res = await fetch(src)
  const text = await res.text()
  const data = JSON.parse(text) as object
  return {
    kind: 'lottie',
    data,
    bytes: new TextEncoder().encode(text).byteLength,
    loadMs: performance.now() - t0,
  }
}

export const loadBenchAsset = (engine: Engine, giftId: GiftId): Promise<BenchAsset> => {
  const family = isRive(engine) ? 'rive' : 'lottie'
  const key = `${family}:${giftId}`
  let promise = cache.get(key)
  if (!promise) {
    promise = family === 'rive' ? loadRive(giftId) : loadLottie(giftId)
    cache.set(key, promise)
    promise.catch(() => cache.delete(key))
  }
  return promise
}

export type AssetsState = {
  readonly assets: Readonly<Partial<Record<GiftId, BenchAsset>>>
  readonly total: number
  readonly errors: readonly string[]
}

const BENCH_GIFTS = GIFTS.filter(g => g.rivSrc && g.lottieSrc).map(g => g.id)

/** Every T2+ gift for one engine, loaded up front like the production GiftProvider does. */
export const useBenchAssets = (engine: Engine): AssetsState => {
  const family = isRive(engine) ? 'rive' : 'lottie'
  const [loaded, setLoaded] = useState<{ readonly family: string; readonly state: AssetsState }>({
    family: '',
    state: { assets: {}, total: BENCH_GIFTS.length, errors: [] },
  })
  useEffect(() => {
    let cancelled = false
    for (const giftId of BENCH_GIFTS) {
      loadBenchAsset(engine, giftId)
        .then(asset => {
          if (cancelled) return
          setLoaded(prev => {
            const base =
              prev.family === family
                ? prev.state
                : { assets: {}, total: BENCH_GIFTS.length, errors: [] }
            return { family, state: { ...base, assets: { ...base.assets, [giftId]: asset } } }
          })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setLoaded(prev => {
            const base =
              prev.family === family
                ? prev.state
                : { assets: {}, total: BENCH_GIFTS.length, errors: [] }
            return {
              family,
              state: { ...base, errors: [...base.errors, `${giftId}: ${String(err)}`] },
            }
          })
        })
    }
    return () => {
      cancelled = true
    }
  }, [engine, family])
  return loaded.family === family
    ? loaded.state
    : { assets: {}, total: BENCH_GIFTS.length, errors: [] }
}
