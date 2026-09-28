/**
 * What a cold page load cost before gifts could play: how long until every effect file and the
 * runtime were ready, until the first effect drew, and how many bytes came over the network.
 * Times are from navigation start (`performance.now()`). Read by the panel and by Playwright
 * (`window.__benchStartup`).
 */
export type StartupStats = {
  readonly assetsReadyMs: number | null
  readonly firstEffectMs: number | null
  /** bytes over the wire (compressed), by what they were */
  readonly transferKB: {
    readonly runtime: number
    readonly effects: number
    readonly page: number
    readonly total: number
  }
}

const runtimeUrls = new Set<string>()

const scriptUrls = (): string[] =>
  performance
    .getEntriesByType('resource')
    .map(e => e.name)
    .filter(name => name.endsWith('.js'))

/**
 * Loads a runtime and remembers which files it pulled in (a hashed Next chunk for lottie-web),
 * so they are counted as runtime rather than page.
 */
export const trackRuntime = async <T>(load: () => Promise<T>): Promise<T> => {
  const before = new Set(scriptUrls())
  const result = await load()
  for (const url of scriptUrls()) if (!before.has(url)) runtimeUrls.add(url)
  return result
}

const kind = (url: string): Exclude<keyof StartupStats['transferKB'], 'total'> => {
  if (url.endsWith('.wasm') || runtimeUrls.has(url)) return 'runtime'
  if (url.endsWith('.riv') || /\/lottie\/[^/]+\.json$/.test(url)) return 'effects'
  return 'page'
}

const kb = (n: number) => Math.round(n / 1024)

export const measureTransfer = (): StartupStats['transferKB'] => {
  const bytes = { runtime: 0, effects: 0, page: 0, total: 0 }
  const entries = [
    ...performance.getEntriesByType('navigation'),
    ...performance.getEntriesByType('resource'),
  ] as PerformanceResourceTiming[]
  for (const e of entries) {
    bytes[kind(e.name)] += e.transferSize
    bytes.total += e.transferSize
  }
  return {
    runtime: kb(bytes.runtime),
    effects: kb(bytes.effects),
    page: kb(bytes.page),
    total: kb(bytes.total),
  }
}

// ---- store ------------------------------------------------------------------------------------

const EMPTY: StartupStats = {
  assetsReadyMs: null,
  firstEffectMs: null,
  transferKB: { runtime: 0, effects: 0, page: 0, total: 0 },
}

let startup: StartupStats = EMPTY
const listeners = new Set<() => void>()

const publish = (next: StartupStats) => {
  startup = next
  ;(window as Window & { __benchStartup?: StartupStats }).__benchStartup = startup
  for (const l of listeners) l()
}

/** Only the first time counts: later ones are warm (cached files, compiled runtime). */
export const markAssetsReady = (): void => {
  if (startup.assetsReadyMs !== null) return
  publish({
    ...startup,
    assetsReadyMs: Math.round(performance.now()),
    transferKB: measureTransfer(),
  })
}

export const markFirstEffect = (): void => {
  if (startup.firstEffectMs !== null) return
  publish({
    ...startup,
    firstEffectMs: Math.round(performance.now()),
    transferKB: measureTransfer(),
  })
}

export const startupStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: (): StartupStats => startup,
}
