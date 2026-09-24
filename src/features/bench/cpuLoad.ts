/**
 * Emulates a slower main thread: burns `ms` of CPU inside every animation frame, so the budget
 * left for the runtimes shrinks the way it does on a low-end phone. It is not a substitute for
 * real CPU throttling (DevTools → Performance → CPU 4× / 6×, or `BENCH_CPU` in the e2e), which
 * also slows Rive's WASM and lottie-web's own work; use both to bracket a device.
 */
let rafId: number | null = null
let burnMs = 0

const spin = () => {
  const until = performance.now() + burnMs
  while (performance.now() < until) {
    // busy wait
  }
  rafId = requestAnimationFrame(spin)
}

export const setCpuLoad = (ms: number): void => {
  burnMs = ms
  if (ms > 0 && rafId === null) rafId = requestAnimationFrame(spin)
  if (ms <= 0 && rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}
