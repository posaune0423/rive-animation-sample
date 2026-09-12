import { hex } from './writer/binary'

/**
 * Night / light / gift. Four families; each gift leans on one of them.
 * Values are ARGB u32 (see `hex`).
 */
export const palette = {
  // 深い赤
  deepRed: hex('#8B1E2D'),
  deepRedLight: hex('#B8323F'),
  crimson: hex('#D4405A'),
  // シャンパンゴールド
  champagne: hex('#E8C877'),
  champagneLight: hex('#F6E3A8'),
  gold: hex('#D9A93F'),
  goldDeep: hex('#A87A1F'),
  // 琥珀
  amber: hex('#C77D2E'),
  amberDeep: hex('#8E5518'),
  amberGlass: hex('#E9A54B'),
  // 氷の白
  ice: hex('#EAF4FF'),
  iceBlue: hex('#BFDCFF'),
  white: hex('#FFFFFF'),
  // supporting
  night: hex('#0B1024'),
  nightBlue: hex('#182A5C'),
  moon: hex('#D7DEEA'),
  bottleGreen: hex('#1E4D3A'),
  cream: hex('#F4E9D8'),
  fur: hex('#D8A36E'),
  furDeep: hex('#A8703F'),
  leaf: hex('#24452E'),
  wrap: hex('#2A1A2E'),
} as const

export type PaletteName = keyof typeof palette
