/**
 * Caps `requestAnimationFrame` at a refresh rate, the way iOS Safari holds pages to 60 Hz on a
 * 120 Hz ProMotion screen (Settings → Safari → Feature Flags → "Prefer Page Rendering Updates
 * near 60fps", on by default). Without it a run on a 120 Hz laptop does twice the work of a phone
 * and its fps cannot be compared with one measured on a 60 Hz monitor.
 *
 * Rive's and lottie-web's render loops and the frame meter all call the global
 * `requestAnimationFrame` when they schedule, so wrapping it caps every one of them.
 */

/** Deliver a frame at `t` if a whole cap interval (less jitter slack) has passed since `last`. */
export const shouldDeliver = (t: number, last: number, capHz: number | null): boolean =>
  capHz === null || t - last >= 1000 / capHz - 2

let capHz: number | null = null
let installed = false

const install = () => {
  const nativeRaf = window.requestAnimationFrame.bind(window)
  let pending = new Map<number, FrameRequestCallback>()
  let nextId = 1
  let scheduled = false
  let last = Number.NEGATIVE_INFINITY

  const pump = (t: number) => {
    scheduled = false
    if (!shouldDeliver(t, last, capHz)) {
      scheduled = true
      nativeRaf(pump)
      return
    }
    last = t
    const batch = pending
    pending = new Map()
    // like the native one, a throwing callback must not starve the others (the meter among them)
    for (const cb of batch.values()) {
      try {
        cb(t)
      } catch (error) {
        reportError(error)
      }
    }
  }

  window.requestAnimationFrame = cb => {
    const id = nextId++
    pending.set(id, cb)
    if (!scheduled) {
      scheduled = true
      nativeRaf(pump)
    }
    return id
  }
  window.cancelAnimationFrame = id => {
    pending.delete(id)
  }
  installed = true
}

/** `null` lifts the cap. Call before the runtimes start their loops. */
export const setFrameCap = (hz: number | null): void => {
  if (typeof window === 'undefined') return
  capHz = hz
  if (!installed && hz !== null) install()
}
