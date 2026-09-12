import { describe, expect, it } from 'vitest'
import { RIVE_CONTRACT } from '../contract'
import { ByteWriter, hex } from './binary'
import { loadHeadlessRive } from './headless'
import { ellipse, scene, shape, solid } from './scene'
import { EASE, timeline } from './timeline'
import { toRiv } from './toRiv'
import { toSvg } from './toSvg'

describe('ByteWriter', () => {
  it('encodes LEB128 varuints', () => {
    expect([...new ByteWriter().varuint(0).toUint8Array()]).toEqual([0])
    expect([...new ByteWriter().varuint(127).toUint8Array()]).toEqual([0x7f])
    expect([...new ByteWriter().varuint(300).toUint8Array()]).toEqual([0xac, 0x02])
  })

  it('encodes float32 little-endian and length-prefixed strings', () => {
    expect([...new ByteWriter().f32(500).toUint8Array()]).toEqual([0x00, 0x00, 0xfa, 0x43])
    expect([...new ByteWriter().string('ab').toUint8Array()]).toEqual([2, 0x61, 0x62])
  })

  it('packs ARGB colors', () => {
    expect(hex('#ff3366')).toBe(0xffff3366)
    expect(hex('#000000', 0.5)).toBe(0x80000000)
  })
})

const ball = () =>
  scene('Gift', 500, 500, [shape('ball', { x: 250, y: 250 }, ellipse(200), solid(hex('#ff3366')))])

const drive = async (bytes: Uint8Array, seconds: number, step = 1 / 60) => {
  const rive = await loadHeadlessRive()
  const file = await rive.load(bytes)
  const artboard = file.artboardByIndex(0)
  const sm = new rive.StateMachineInstance(artboard.stateMachineByIndex(0), artboard)
  const events: Array<{ t: number; name: string }> = []
  const samples: Array<{ t: number; x: number }> = []
  const advance = (dt: number, t: number) => {
    sm.advance(dt)
    artboard.advance(dt)
    for (let i = 0; i < sm.reportedEventCount(); i++) {
      const e = sm.reportedEventAt(i)
      if (e) events.push({ t, name: e.name })
    }
  }
  const fire = () => {
    for (let i = 0; i < sm.inputCount(); i++) {
      const input = sm.input(i)
      if (input.name === RIVE_CONTRACT.playTrigger) input.asTrigger().fire()
    }
  }
  const run = (from: number, to: number) => {
    for (let t = from; t < to - 1e-9; t += step) {
      advance(step, t + step)
      samples.push({ t: t + step, x: artboard.node('ball').x })
    }
  }
  return { file, artboard, sm, events, samples, fire, run, seconds }
}

describe('toRiv', () => {
  it('produces a file the runtime loads with the contract names', async () => {
    const bytes = toRiv(
      ball(),
      timeline('play', 1).key('ball', 'x', 0, 250).key('ball', 'x', 1, 400).build(),
    )
    expect(bytes.length).toBeLessThan(1024)
    const rive = await loadHeadlessRive()
    const file = await rive.load(bytes)
    expect(file.artboardCount()).toBe(1)
    const artboard = file.artboardByIndex(0)
    expect(artboard.name).toBe('Gift')
    expect(artboard.bounds.maxX).toBe(500)
    expect(artboard.animationCount()).toBe(2)
    expect(artboard.animationByIndex(0).name).toBe(RIVE_CONTRACT.idleAnimation)
    expect(artboard.animationByIndex(1).name).toBe(RIVE_CONTRACT.playAnimation)
    expect(artboard.stateMachineByIndex(0).name).toBe(RIVE_CONTRACT.stateMachine)
    const sm = new rive.StateMachineInstance(artboard.stateMachineByIndex(0), artboard)
    expect(sm.inputCount()).toBe(1)
    expect(sm.input(0).name).toBe(RIVE_CONTRACT.playTrigger)
  })

  it('fires "finished" when play ends and can be replayed on the same instance', async () => {
    const bytes = toRiv(
      ball(),
      timeline('play', 1).key('ball', 'x', 0, 250).key('ball', 'x', 1, 400).build(),
    )
    const d = await drive(bytes, 3)
    d.run(0, 0.1)
    expect(d.events).toEqual([])
    d.fire()
    d.run(0.1, 1.5)
    expect(d.events.map(e => e.name)).toEqual([RIVE_CONTRACT.finishedEvent])
    expect(d.events[0]?.t).toBeGreaterThan(1.0)
    expect(d.events[0]?.t).toBeLessThan(1.25)
    d.fire()
    d.run(1.5, 3)
    expect(d.events).toHaveLength(2)
  })

  it('applies linear keyframes (midpoint of 250→400 is ~325)', async () => {
    const bytes = toRiv(
      ball(),
      timeline('play', 1).key('ball', 'x', 0, 250).key('ball', 'x', 1, 400).build(),
    )
    const d = await drive(bytes, 1)
    d.fire()
    d.run(0, 1)
    const mid = d.samples.find(s => Math.abs(s.t - 0.5) < 1e-6)
    expect(mid?.x).toBeGreaterThan(315)
    expect(mid?.x).toBeLessThan(335)
  })

  it('applies cubic ease-in (midpoint well below linear) and hold', async () => {
    const bytes = toRiv(
      ball(),
      timeline('play', 1).key('ball', 'x', 0, 0, EASE.in).key('ball', 'x', 1, 100).build(),
    )
    const d = await drive(bytes, 1)
    d.fire()
    d.run(0, 1)
    const mid = d.samples.find(s => Math.abs(s.t - 0.5) < 1e-6)
    expect(mid?.x).toBeGreaterThan(1)
    expect(mid?.x).toBeLessThan(35)

    const held = toRiv(
      ball(),
      timeline('play', 1).key('ball', 'x', 0, 0, 'hold').key('ball', 'x', 1, 100).build(),
    )
    const h = await drive(held, 1)
    h.fire()
    h.run(0, 1)
    const heldMid = h.samples.find(s => Math.abs(s.t - 0.5) < 1e-6)
    expect(heldMid?.x).toBe(0)
  })
})

describe('toSvg', () => {
  it('renders the static scene', () => {
    const svg = toSvg(ball(), { width: 48, height: 48 })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('viewBox="0 0 500 500"')
    expect(svg).toContain(
      '<ellipse cx="0" cy="0" rx="100" ry="100" fill="#ff3366" fill-opacity="1"',
    )
    expect(svg).toContain('translate(250 250)')
  })
})
