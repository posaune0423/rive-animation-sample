/**
 * Real-time frame meter for /perf. Samples every animation frame while running:
 *
 *   delta   ms from this `requestAnimationFrame` timestamp to the next one (what the viewer feels)
 *   mainMs  ms from the frame's start until a MessageChannel task posted from inside the rAF
 *           callback runs — i.e. after every rAF callback and the style/layout/paint work of
 *           that frame, so it is the main-thread cost of the frame (Rive's and Lottie's own
 *           render loops included) without the Long Animation Frames >50 ms threshold.
 *           A frame's main-thread work is what delays the next frame, so both refer to the same
 *           frame and mainMs ≤ delta.
 *
 * GPU time is not exposed to web pages. What we can say is where the time goes: when frames are
 * long but the main thread is mostly idle, the frame is waiting on the GPU / compositor.
 * `bottleneck` is that classification. The window is the last `WINDOW_MS`.
 *
 * Read by the HUD (useSyncExternalStore) and by Playwright (`window.__benchMetrics`).
 */
export type Bottleneck = 'idle' | 'main' | 'gpu' | 'mixed'

export type FrameMeterStats = {
  readonly running: boolean
  readonly samples: number
  readonly fps: number
  readonly frameAvgMs: number
  readonly frameP95Ms: number
  readonly frameMaxMs: number
  /** frames longer than 33 ms in the window */
  readonly longFrames: number
  /** estimated vsync interval: the 5th-percentile delta, never slower than 60 Hz */
  readonly vsyncMs: number
  /** frames the display refreshed without a new frame from us, relative to `vsyncMs` */
  readonly droppedFrames: number
  readonly mainAvgMs: number
  /** share of wall time the main thread spent producing frames */
  readonly mainBusyPct: number
  /** share of wall time spent beyond the main thread (GPU / compositor / waiting) on long frames */
  readonly offMainPct: number
  readonly bottleneck: Bottleneck
  /** Long Animation Frames (>50 ms) seen in the window, if the API exists */
  readonly loafCount: number | null
  readonly heapMB: number | null
  readonly domNodes: number
  /** last frame deltas for the sparkline, oldest first */
  readonly history: readonly number[]
}

const WINDOW_MS = 2_000
const HISTORY = 120
const LONG_FRAME_MS = 33

type Sample = { readonly at: number; delta: number; mainMs: number }

const EMPTY: FrameMeterStats = {
  running: false,
  samples: 0,
  fps: 0,
  frameAvgMs: 0,
  frameP95Ms: 0,
  frameMaxMs: 0,
  longFrames: 0,
  vsyncMs: 0,
  droppedFrames: 0,
  mainAvgMs: 0,
  mainBusyPct: 0,
  offMainPct: 0,
  bottleneck: 'idle',
  loafCount: null,
  heapMB: null,
  domNodes: 0,
  history: [],
}

let stats: FrameMeterStats = EMPTY
const listeners = new Set<() => void>()

const publish = (next: FrameMeterStats) => {
  stats = next
  for (const l of listeners) l()
  if (typeof window !== 'undefined') {
    ;(window as Window & { __benchMetrics?: FrameMeterStats }).__benchMetrics = stats
  }
}

export const frameMeterStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => stats,
}

// ---- sampling -------------------------------------------------------------------

let samples: Sample[] = []
let rafId: number | null = null
let flushId: number | null = null
let channel: MessageChannel | null = null
let pending: Sample | null = null
let open: Sample | null = null
let loafTimes: number[] = []
let loafObserver: PerformanceObserver | null = null

const onFrame = (now: number) => {
  if (open) {
    open.delta = now - open.at
    // The flush task never got to run inside that frame: the main thread was busy for all of it.
    open.mainMs = pending === open ? open.delta : Math.min(open.mainMs, open.delta)
    samples.push(open)
  }
  open = { at: now, delta: 0, mainMs: 0 }
  pending = open
  channel?.port2.postMessage(0)
  rafId = requestAnimationFrame(onFrame)
}

const onAfterFrame = () => {
  if (!pending) return
  // performance.now() is on the same clock as the rAF timestamp (frame start).
  pending.mainMs = Math.max(0, performance.now() - pending.at)
  pending = null
}

const percentile = (sorted: readonly number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0

const classify = (frameAvg: number, mainAvg: number, vsync: number): Bottleneck => {
  if (frameAvg <= vsync * 1.15) return 'idle'
  const mainShare = mainAvg / frameAvg
  if (mainShare >= 0.7) return 'main'
  if (mainShare <= 0.4) return 'gpu'
  return 'mixed'
}

const summarize = (): FrameMeterStats => {
  const cutoff = performance.now() - WINDOW_MS
  samples = samples.filter(s => s.at >= cutoff)
  loafTimes = loafTimes.filter(t => t >= cutoff)
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number } }
  const heapMB = perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : null
  const domNodes = document.getElementsByTagName('*').length
  const loafCount = loafObserver ? loafTimes.length : null
  if (samples.length < 2) {
    return { ...EMPTY, running: true, heapMB, domNodes, loafCount }
  }
  const deltas = samples.map(s => s.delta)
  const sorted = deltas.toSorted((a, b) => a - b)
  const wall = deltas.reduce((a, b) => a + b, 0)
  const frameAvg = wall / deltas.length
  const main = samples.reduce((a, s) => a + s.mainMs, 0)
  const mainAvg = main / samples.length
  // Under heavy load even the fastest frames miss vsync, so the estimate is capped at 60 Hz:
  // anything slower is missed frames, not a slow display.
  const vsync = Math.min(1000 / 60, Math.max(1, percentile(sorted, 0.05)))
  const dropped = deltas.reduce((n, d) => n + Math.max(0, Math.round(d / vsync) - 1), 0)
  // time beyond the main thread on frames that missed vsync
  const offMain = samples.reduce(
    (a, s) => (s.delta > vsync * 1.15 ? a + Math.max(0, s.delta - s.mainMs) : a),
    0,
  )
  return {
    running: true,
    samples: deltas.length,
    fps: Math.round((1000 / frameAvg) * 10) / 10,
    frameAvgMs: Math.round(frameAvg * 10) / 10,
    frameP95Ms: Math.round(percentile(sorted, 0.95) * 10) / 10,
    frameMaxMs: Math.round((sorted.at(-1) ?? 0) * 10) / 10,
    longFrames: deltas.filter(d => d > LONG_FRAME_MS).length,
    vsyncMs: Math.round(vsync * 10) / 10,
    droppedFrames: dropped,
    mainAvgMs: Math.round(mainAvg * 10) / 10,
    mainBusyPct: Math.round((main / wall) * 100),
    offMainPct: Math.round((offMain / wall) * 100),
    bottleneck: classify(frameAvg, mainAvg, vsync),
    loafCount,
    heapMB,
    domNodes,
    history: deltas.slice(-HISTORY),
  }
}

export const startFrameMeter = (): void => {
  if (rafId !== null || typeof window === 'undefined') return
  channel = new MessageChannel()
  channel.port1.addEventListener('message', onAfterFrame)
  channel.port1.start()
  samples = []
  open = null
  if (
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')
  ) {
    loafObserver = new PerformanceObserver(list => {
      for (const e of list.getEntries()) loafTimes.push(e.startTime + e.duration)
    })
    loafObserver.observe({ type: 'long-animation-frame' })
  }
  rafId = requestAnimationFrame(onFrame)
  flushId = window.setInterval(() => publish(summarize()), 250)
  publish({ ...EMPTY, running: true })
}

export const stopFrameMeter = (): void => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  if (flushId !== null) window.clearInterval(flushId)
  rafId = null
  flushId = null
  channel?.port1.close()
  channel?.port2.close()
  channel = null
  loafObserver?.disconnect()
  loafObserver = null
  publish({ ...stats, running: false })
}

/** Forget the window (e.g. right after a burst starts) so the next stats describe only the run. */
export const resetFrameMeter = (): void => {
  samples = []
  loafTimes = []
  open = null
  publish({ ...EMPTY, running: rafId !== null })
}
