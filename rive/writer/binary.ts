/**
 * Low-level encoders for the .riv binary format.
 * Encodings follow rive-runtime `include/rive/core/binary_reader.hpp` and
 * `src/core/field_types/*.cpp`: LEB128 varuint, float32 LE, u32 LE, 1-byte bool,
 * varuint-length-prefixed UTF-8 strings.
 */
export class ByteWriter {
  private readonly chunks: number[] = []

  get length(): number {
    return this.chunks.length
  }

  varuint(value: number): this {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`varuint expects a non-negative integer, got ${value}`)
    }
    let rest = value
    do {
      let byte = rest & 0x7f
      rest = Math.floor(rest / 128)
      if (rest > 0) byte |= 0x80
      this.chunks.push(byte)
    } while (rest > 0)
    return this
  }

  byte(value: number): this {
    this.chunks.push(value & 0xff)
    return this
  }

  bool(value: boolean): this {
    return this.byte(value ? 1 : 0)
  }

  u32(value: number): this {
    const v = value >>> 0
    this.chunks.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff)
    return this
  }

  f32(value: number): this {
    const view = new DataView(new ArrayBuffer(4))
    view.setFloat32(0, value, true)
    for (let i = 0; i < 4; i++) this.chunks.push(view.getUint8(i))
    return this
  }

  string(value: string): this {
    const utf8 = new TextEncoder().encode(value)
    this.varuint(utf8.length)
    for (const b of utf8) this.chunks.push(b)
    return this
  }

  color(argb: number): this {
    return this.u32(argb)
  }

  /** varuint length + raw bytes (Rive `bytes` field, e.g. embedded asset contents). */
  bytes(data: Uint8Array): this {
    this.varuint(data.byteLength)
    for (const b of data) this.chunks.push(b)
    return this
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.chunks)
  }
}

/** Packs 0–255 channels into Rive's ARGB u32 color. */
export const argb = (a: number, r: number, g: number, b: number): number =>
  (((a & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)) >>> 0

/** `#rrggbb` (+ optional alpha 0–1) → ARGB u32. */
export const hex = (rgb: string, alpha = 1): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(rgb)
  if (!m) throw new Error(`invalid hex color: ${rgb}`)
  const n = Number.parseInt(m[1] as string, 16)
  return argb(Math.round(alpha * 255), (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff)
}

export const withAlpha = (color: number, alpha: number): number =>
  ((Math.round(alpha * 255) << 24) | (color & 0x00ffffff)) >>> 0

export const alphaOf = (color: number): number => ((color >>> 24) & 0xff) / 255

export const rgbHexOf = (color: number): string =>
  `#${(color & 0x00ffffff).toString(16).padStart(6, '0')}`
