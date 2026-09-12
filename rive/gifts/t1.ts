import { palette } from '../palette'
import { scene, shape, solid } from '../writer/scene'
import { heartPath, lipPaths, type GiftDefinition } from './shared'

const ICON = 96

/** ハート 10 — 1色の面。演出は CSS の 0.15s pop。 */
export const heart: GiftDefinition = {
  id: 'heart',
  tier: 1,
  icon: scene('heart', ICON, ICON, [
    shape('heart', { x: ICON / 2, y: ICON / 2 - 2 }, heartPath(0.78), solid(palette.deepRed)),
  ]),
}

/** キスマーク 30 — 唇のマークだけ。ハートより少し明るい紅。 */
export const kiss: GiftDefinition = (() => {
  const lips = lipPaths(0.8)
  return {
    id: 'kiss',
    tier: 1,
    icon: scene('kiss', ICON, ICON, [
      shape('upper', { x: ICON / 2, y: ICON / 2 - 4 }, lips.upper, solid(palette.crimson)),
      shape('lower', { x: ICON / 2, y: ICON / 2 - 4 }, lips.lower, solid(palette.crimson)),
    ]),
  }
})()
