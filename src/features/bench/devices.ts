/**
 * The phones /perf emulates on a desktop Chromium, from the newest iPhone down to the oldest one
 * the current iOS still supports, plus a budget Android.
 *
 *   dpr          render resolution of the screen
 *   cpuThrottle  DevTools CPU throttling that brings an Apple M4 Pro down to the phone's
 *                single-core speed (Geekbench 6 single-core ratio, rounded up). The page cannot
 *                slow its own CPU: the e2e applies it through the DevTools protocol, by hand it is
 *                DevTools → Performance → CPU.
 *   fpsCap       iOS Safari renders pages at 60 Hz even on a 120 Hz screen
 *   webgl        'safari' hides WEBGL_shader_pixel_local_storage, which Safari does not have, so
 *                Rive takes the fallback path it takes on an iPhone; 'default' leaves the browser
 *                as it is. Chrome only offers the extension as a WebGL draft extension (off unless
 *                launched with --enable-webgl-draft-extensions; Chrome 154 stable on macOS has it
 *                off), so a stock Chrome takes the same fallback.
 *
 * The GPU is not emulated: a phone GPU is slower than this laptop's, so real devices do worse
 * than these profiles on GPU-bound work.
 */
export type DeviceId = 'pc' | 'iphone-17-pro' | 'iphone-13' | 'iphone-11' | 'android-low'

export type DeviceProfile = {
  readonly id: DeviceId
  readonly label: string
  /** model, year, chip, memory — what the business side recognises */
  readonly spec: string
  readonly dpr: number | null
  readonly cpuThrottle: number
  readonly fpsCap: number | null
  readonly webgl: 'default' | 'safari'
}

export const DEVICES: readonly DeviceProfile[] = [
  {
    id: 'pc',
    label: 'この PC（模擬なし）',
    spec: '開いている端末そのまま',
    dpr: null,
    cpuThrottle: 1,
    fpsCap: null,
    webgl: 'default',
  },
  {
    id: 'iphone-17-pro',
    label: '最新 iPhone',
    spec: 'iPhone 17 Pro 相当（2025, A19 Pro, 12GB）',
    dpr: 3,
    cpuThrottle: 1,
    fpsCap: 60,
    webgl: 'safari',
  },
  {
    id: 'iphone-13',
    label: '数年前の iPhone',
    spec: 'iPhone 13 相当（2021, A15, 4GB）',
    dpr: 3,
    cpuThrottle: 2,
    fpsCap: 60,
    webgl: 'safari',
  },
  {
    id: 'iphone-11',
    label: '旧型 iPhone',
    spec: 'iPhone 11 / SE 第2世代 相当（2019, A13, 3〜4GB）— iOS 27 の最低対応機種',
    dpr: 2,
    cpuThrottle: 3,
    fpsCap: 60,
    webgl: 'safari',
  },
  {
    id: 'android-low',
    label: '低価格 Android',
    spec: '2〜3 万円台の Android（Chrome, 4GB）',
    dpr: 2,
    cpuThrottle: 5,
    fpsCap: 60,
    webgl: 'default',
  },
]

export const PHONES: readonly DeviceProfile[] = DEVICES.filter(d => d.id !== 'pc')

export const deviceById = (id: DeviceId): DeviceProfile => {
  const found = DEVICES.find(d => d.id === id)
  if (!found) throw new Error(`unknown device: ${id}`)
  return found
}

export const isDeviceId = (value: string | null): value is DeviceId =>
  DEVICES.some(d => d.id === value)
