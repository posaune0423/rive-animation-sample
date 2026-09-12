import type { GiftId } from '@rive/catalog'

/**
 * Runtime measurements, read by the debug HUD (via `useSyncExternalStore`) and by Playwright
 * (via `window.__giftMetrics`). All timings are ms from `performance.now()`.
 */
export type FileMetric = { readonly bytes: number; readonly loadMs: number }

export type PlayMetric = {
  readonly giftId: GiftId
  readonly lane: string
  readonly firedAt: number
  /** ms from trigger until the runtime advanced the state machine for the first time. */
  readonly firstAdvanceMs: number | null
  readonly finishedMs: number | null
}

export type FrameStats = {
  readonly samples: number
  readonly fpsAvg: number
  readonly p95Ms: number
  readonly longFrames: number
}

export type WasmMetric = {
  readonly url: string
  readonly loadMs: number
  readonly encodedBytes: number | null
  readonly decodedBytes: number | null
  readonly firstInstanceMs: number | null
}

export type GiftMetrics = {
  readonly wasm: WasmMetric | null
  readonly files: Readonly<Partial<Record<GiftId, FileMetric>>>
  readonly plays: readonly PlayMetric[]
  readonly frames: FrameStats
  readonly activeInstances: number
  readonly heapMB: number | null
}

const EMPTY_FRAMES: FrameStats = { samples: 0, fpsAvg: 0, p95Ms: 0, longFrames: 0 }

let state: GiftMetrics = {
  wasm: null,
  files: {},
  plays: [],
  frames: EMPTY_FRAMES,
  activeInstances: 0,
  heapMB: null,
}

const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
  if (typeof window !== 'undefined') {
    ;(window as Window & { __giftMetrics?: GiftMetrics }).__giftMetrics = state
  }
}
const update = (patch: Partial<GiftMetrics>) => {
  state = { ...state, ...patch }
  emit()
}

export const metricsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => state,
}

export const recordWasm = (metric: WasmMetric) => update({ wasm: metric })

export const recordFirstInstance = (ms: number) => {
  if (state.wasm && state.wasm.firstInstanceMs === null) {
    update({ wasm: { ...state.wasm, firstInstanceMs: ms } })
  }
}

export const recordFile = (giftId: GiftId, metric: FileMetric) =>
  update({ files: { ...state.files, [giftId]: metric } })

export const recordPlayFired = (giftId: GiftId, lane: string, firedAt: number) =>
  update({
    plays: [
      ...state.plays,
      { giftId, lane, firedAt, firstAdvanceMs: null, finishedMs: null },
    ].slice(-200),
  })

const patchPlay = (giftId: GiftId, lane: string, patch: Partial<PlayMetric>) => {
  const idx = state.plays.findLastIndex(p => p.giftId === giftId && p.lane === lane)
  if (idx === -1) return
  const plays = state.plays.with(idx, { ...(state.plays[idx] as PlayMetric), ...patch })
  update({ plays })
}

export const recordFirstAdvance = (giftId: GiftId, lane: string, now: number) => {
  const play = state.plays.findLast(p => p.giftId === giftId && p.lane === lane)
  if (!play || play.firstAdvanceMs !== null) return
  patchPlay(giftId, lane, { firstAdvanceMs: now - play.firedAt })
}

export const recordFinished = (giftId: GiftId, lane: string, now: number) => {
  const play = state.plays.findLast(p => p.giftId === giftId && p.lane === lane)
  if (!play || play.finishedMs !== null) return
  patchPlay(giftId, lane, { finishedMs: now - play.firedAt })
}

export const setActiveInstances = (n: number) => {
  if (n !== state.activeInstances) update({ activeInstances: n })
}

// ---- frame sampler --------------------------------------------------------

const WINDOW = 300
const LONG_FRAME_MS = 33
let deltas: number[] = []
let rafId: number | null = null
let last = 0

const sample = (now: number) => {
  if (last > 0) {
    deltas.push(now - last)
    if (deltas.length > WINDOW) deltas = deltas.slice(-WINDOW)
  }
  last = now
  rafId = requestAnimationFrame(sample)
}

const summarize = (): FrameStats => {
  if (deltas.length === 0) return EMPTY_FRAMES
  const sorted = deltas.toSorted((a, b) => a - b)
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length
  return {
    samples: deltas.length,
    fpsAvg: Math.round((1000 / avg) * 10) / 10,
    p95Ms: Math.round((sorted[Math.floor(sorted.length * 0.95)] ?? 0) * 10) / 10,
    longFrames: deltas.filter(d => d > LONG_FRAME_MS).length,
  }
}

/** Runs while at least one effect is active; the HUD polls `flushFrames` at a slow cadence. */
export const setFrameSampling = (on: boolean) => {
  if (on && rafId === null) {
    last = 0
    rafId = requestAnimationFrame(sample)
  } else if (!on && rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

export const flushFrames = () => {
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number } }
  update({
    frames: summarize(),
    heapMB: perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : null,
  })
}

export const resetFrames = () => {
  deltas = []
  update({ frames: EMPTY_FRAMES })
}
