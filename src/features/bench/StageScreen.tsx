'use client'

import { GIFTS, giftById, type GiftId } from '@rive/catalog'
import manifest from '@rive/manifest.json'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import type { LaneKey, QueuePolicy } from '../gift/types'
import { useBenchAssets } from './assets'
import { setCpuLoad } from './cpuLoad'
import { ENGINE_LABEL, ENGINES, isEngine, type Engine } from './engines'
import { frameMeterStore, resetFrameMeter, startFrameMeter, stopFrameMeter } from './frameMeter'
import { Field, Hud, Row, SELECT_CLASS, Section, Toggle } from './Hud'
import { LiveStage, parseTileKey } from './LiveStage'
import type { OverflowPolicy } from './queue'
import { RunsTable, type BenchRun } from './RunsTable'
import {
  initialStage,
  stageActive,
  stageDropped,
  stageReducer,
  stageWaitTimes,
  stageWaiting,
  type StageConfig,
  type StageState,
} from './stage'

const OVERLAPS = [1, 2, 3, 5, 10, 20, 50] as const
const STORM_RATES = [5, 10, 20, 50, 100] as const
const STORM_SECONDS = [10, 30, 60] as const
const DPRS = [1, 2, 3] as const
const CPU_LOADS = [0, 4, 8, 12, 16] as const
const GAPS = [0, 200, 500, 1000, 2000] as const
const OVERFLOWS: readonly OverflowPolicy[] = ['queue', 'drop-oldest', 'drop-newest']
const POLICIES: readonly QueuePolicy[] = ['per-lane', 'strict']
const SENDERS = ['さくら', 'ゆい', 'みお', 'りん', 'あおい', 'ひな', 'こはる', 'めい']
const T2_PLUS = GIFTS.filter(g => g.tier >= 2)

const randomSender = () => SENDERS[Math.floor(Math.random() * SENDERS.length)] as string
const randomGift = () =>
  (T2_PLUS[Math.floor(Math.random() * T2_PLUS.length)] as (typeof GIFTS)[number]).id

const pick = <T extends string | number>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T => {
  if (raw === null) return fallback
  const value = typeof fallback === 'number' ? Number(raw) : raw
  return (allowed as readonly (string | number)[]).includes(value) ? (value as T) : fallback
}

const avg = (xs: readonly number[]): number =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0

/**
 * /perf — the live-stream screen at phone size on the right, the senders' side on the left:
 * tap gifts (or let a storm of viewers do it), choose how effects may overlap and queue, switch
 * the runtime, and read the frame meter while it happens.
 *
 * Query params seed the controls:
 * `?engine=lottie-svg&policy=per-lane&overlap=3&gap=0&overflow=drop-oldest&qmax=5&rate=20&seconds=10&dpr=3&cpu=8`
 */
export const StageScreen = () => {
  const params = useSearchParams()
  const [engine, setEngine] = useState<Engine>(() =>
    isEngine(params.get('engine')) ? (params.get('engine') as Engine) : 'rive',
  )
  const [stage, dispatch] = useReducer(
    stageReducer,
    {
      policy: pick(params.get('policy'), POLICIES, 'per-lane'),
      overlap: pick(params.get('overlap'), OVERLAPS, 1),
      gapMs: pick(params.get('gap'), GAPS, 0),
      overflow: pick(params.get('overflow'), OVERFLOWS, 'queue'),
      queueMax: Math.max(0, Number(params.get('qmax') ?? 5) || 0),
    },
    initialStage,
  )
  const stats = useSyncExternalStore(
    frameMeterStore.subscribe,
    frameMeterStore.getSnapshot,
    frameMeterStore.getSnapshot,
  )
  const { assets, total, errors } = useBenchAssets(engine)
  const loaded = Object.keys(assets).length
  const [runs, setRuns] = useState<BenchRun[]>([])
  const [scenario, setScenario] = useState('-')
  const [readyMs, setReadyMs] = useState<ReadonlyMap<string, number>>(new Map())
  const [storm, setStorm] = useState(false)
  const [stormRate, setStormRate] = useState<number>(() =>
    pick(params.get('rate'), STORM_RATES, 20),
  )
  const [stormSeconds, setStormSeconds] = useState<number>(() =>
    pick(params.get('seconds'), STORM_SECONDS, 10),
  )
  // low-end device emulation: render resolution and a per-frame main-thread burn
  const [dpr, setDpr] = useState<number | null>(() =>
    params.get('dpr') === null ? null : pick(params.get('dpr'), DPRS, 2),
  )
  const [cpuLoadMs, setCpuLoadMs] = useState<number>(() => pick(params.get('cpu'), CPU_LOADS, 0))
  useEffect(() => {
    setCpuLoad(cpuLoadMs)
    return () => setCpuLoad(0)
  }, [cpuLoadMs])

  const onReady = useCallback((tileKey: string, ms: number) => {
    setReadyMs(prev => new Map(prev).set(tileKey, ms))
  }, [])
  const onFinished = useCallback((tileKey: string, seq: number) => {
    const { lane, slot } = parseTileKey(tileKey)
    dispatch({ type: 'finished', lane, slot, seq, now: performance.now() })
  }, [])

  useEffect(() => {
    startFrameMeter()
    return stopFrameMeter
  }, [])
  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 100)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    ;(window as Window & { __benchStage?: StageState }).__benchStage = stage
  }, [stage])
  useEffect(() => {
    ;(window as Window & { __benchRuns?: readonly BenchRun[] }).__benchRuns = runs
  }, [runs])

  // ---- sending -------------------------------------------------------------------------

  const timers = useRef<number[]>([])
  // `timers.current` is emptied in place and never reassigned, so the array captured below stays
  // the live one: a scenario fired after a reset is still cleared at unmount.
  const stopTimers = () => {
    timers.current.splice(0).forEach(id => window.clearTimeout(id))
    setStorm(false)
  }
  useEffect(() => {
    const pending = timers.current
    return () => pending.splice(0).forEach(id => window.clearTimeout(id))
  }, [timers])

  const send = useCallback((giftId: GiftId) => {
    dispatch({ type: 'send', giftId, sender: randomSender(), now: performance.now() })
  }, [])

  /** `gifts[i]` is sent `i × intervalMs` after the click — how viewers actually pile in. */
  const sendSeries = (label: string, gifts: readonly GiftId[], intervalMs: number) => {
    setScenario(label)
    resetFrameMeter()
    gifts.forEach((giftId, i) => {
      timers.current.push(window.setTimeout(() => send(giftId), i * intervalMs))
    })
  }

  /** Random T2+ gifts at `perSecond` for `seconds`. */
  const startStorm = (perSecond: number, seconds: number) => {
    const gifts = Array.from({ length: perSecond * seconds }, randomGift)
    sendSeries(`嵐 ${perSecond}/s × ${seconds}s`, gifts, 1000 / perSecond)
    setStorm(true)
    timers.current.push(window.setTimeout(() => setStorm(false), seconds * 1000))
  }

  const reset = () => {
    stopTimers()
    dispatch({ type: 'reset' })
    setReadyMs(new Map())
    setScenario('-')
    resetFrameMeter()
  }

  const switchEngine = (next: Engine) => {
    reset()
    setEngine(next)
  }

  const setConfig = (config: Partial<StageConfig>) =>
    dispatch({ type: 'setConfig', config, now: performance.now() })

  const record = () => {
    const init = [...readyMs.values()]
    const waits = stageWaitTimes(stage).slice(-50)
    setRuns(prev => [
      ...prev,
      {
        at: new Date().toISOString(),
        engine,
        scenario,
        config: stage.config,
        render: { dpr, cpuLoadMs },
        stats,
        active: stageActive(stage),
        instances: Object.values(stage.seen).reduce((n, g) => n + g.length, 0),
        initAvgMs: init.length ? avg(init) : null,
        initMaxMs: init.length ? Math.round(Math.max(...init)) : null,
        dropped: stageDropped(stage),
        waitAvgMs: waits.length ? avg(waits) : null,
      },
    ])
  }

  const lanes = Object.entries(stage.lanes) as [
    LaneKey,
    NonNullable<StageState['lanes'][LaneKey]>,
  ][]

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-[#0b0712] p-4 font-mono text-[12px] text-zinc-200 lg:flex-row lg:items-start">
      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[360px]">
        <header className="flex items-baseline justify-between">
          <h1 className="text-sm font-semibold text-white">Rive vs Lottie 配信ギフト負荷計測</h1>
          <Link href="/" className="text-[11px] text-zinc-400 underline">
            ← live
          </Link>
        </header>

        <Section title="エンジン">
          <div className="grid grid-cols-3 gap-1">
            {ENGINES.map(e => (
              <Toggle
                key={e}
                data-testid={`bench-engine-${e}`}
                active={engine === e}
                onClick={() => switchEngine(e)}
              >
                {ENGINE_LABEL[e]}
              </Toggle>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-zinc-500" data-testid="bench-assets">
            {loaded}/{total} ファイル読込済
            {errors.length > 0 && <span className="text-rose-400"> · {errors[0]}</span>}
          </p>
        </Section>

        <Section title="ギフトを送る（タップ = 視聴者 1 人が 1 回）">
          <div className="grid grid-cols-4 gap-1">
            {GIFTS.map(g => (
              <button
                key={g.id}
                type="button"
                data-testid={`bench-gift-${g.id}`}
                onClick={() => {
                  setScenario(`${g.name} ×1`)
                  send(g.id)
                }}
                className="flex flex-col items-center gap-0.5 rounded border border-white/10 bg-white/[0.03] p-1 hover:bg-white/10 active:translate-y-px"
              >
                <img src={g.iconSrc} alt="" className="size-8" />
                <span className="text-[10px] leading-3">{g.name}</span>
                <span className="text-[9px] text-zinc-500">
                  T{g.tier} · {g.price.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <Toggle
              data-testid="bench-send-all"
              onClick={() =>
                sendSeries(
                  '全12種 ×1',
                  GIFTS.map(g => g.id),
                  150,
                )
              }
            >
              全12種を順に（150ms）
            </Toggle>
            <Toggle
              data-testid="bench-send-all-x3"
              onClick={() =>
                sendSeries(
                  '全12種 ×3',
                  [0, 1, 2].flatMap(() => GIFTS.map(g => g.id)),
                  80,
                )
              }
            >
              全12種 ×3（80ms）
            </Toggle>
            <Toggle
              data-testid="bench-spam-hearts"
              onClick={() =>
                sendSeries(
                  'ハート ×30',
                  Array.from({ length: 30 }, () => 'heart'),
                  50,
                )
              }
            >
              ♥ 連打 ×30
            </Toggle>
            <Toggle
              data-testid="bench-spam-diamond"
              onClick={() =>
                sendSeries(
                  'ダイヤ ×10',
                  Array.from({ length: 10 }, () => 'diamond'),
                  100,
                )
              }
            >
              ダイヤ 連打 ×10
            </Toggle>
            <Toggle
              data-testid="bench-myth-burst"
              onClick={() =>
                sendSeries(
                  '神話 ×5 一斉',
                  Array.from({ length: 5 }, () => 'myth'),
                  0,
                )
              }
            >
              神話 ×5 一斉
            </Toggle>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px]">
            <span className="text-zinc-400">嵐（T2+ ランダム）</span>
            <select
              data-testid="bench-storm-rate"
              value={stormRate}
              onChange={e => setStormRate(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              {STORM_RATES.map(r => (
                <option key={r} value={r}>
                  {r} 件/s
                </option>
              ))}
            </select>
            <span>×</span>
            <select
              data-testid="bench-storm-seconds"
              value={stormSeconds}
              onChange={e => setStormSeconds(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              {STORM_SECONDS.map(sec => (
                <option key={sec} value={sec}>
                  {sec} s
                </option>
              ))}
            </select>
            <Toggle
              data-testid="bench-storm"
              active={storm}
              className="flex-1"
              onClick={() => (storm ? stopTimers() : startStorm(stormRate, stormSeconds))}
            >
              {storm ? '止める' : '開始'}
            </Toggle>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <Toggle data-testid="bench-record" onClick={record}>
              記録に追加
            </Toggle>
            <Toggle data-testid="bench-reset" onClick={reset}>
              リセット
            </Toggle>
          </div>
        </Section>

        <Section title="表示キュー制御">
          <Field label="キュー方針">
            <select
              data-testid="bench-policy"
              value={stage.config.policy}
              onChange={e => setConfig({ policy: e.target.value as QueuePolicy })}
              className={SELECT_CLASS}
            >
              <option value="per-lane">レーン毎（chatTop / center / full）</option>
              <option value="strict">厳格（T2+ を 1 本の列に）</option>
            </select>
          </Field>
          <Field label="レーン内の同時重なり上限">
            <select
              data-testid="bench-overlap"
              value={stage.config.overlap}
              onChange={e => setConfig({ overlap: Number(e.target.value) })}
              className={SELECT_CLASS}
            >
              {OVERLAPS.map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="前演出終了後のディレイ">
            <select
              value={stage.config.gapMs}
              onChange={e => setConfig({ gapMs: Number(e.target.value) })}
              className={SELECT_CLASS}
            >
              {GAPS.map(g => (
                <option key={g} value={g}>
                  {g} ms
                </option>
              ))}
            </select>
          </Field>
          <Field label="溢れ方">
            <select
              data-testid="bench-overflow"
              value={stage.config.overflow}
              onChange={e => setConfig({ overflow: e.target.value as OverflowPolicy })}
              className={SELECT_CLASS}
            >
              <option value="queue">全部待つ（上限なし）</option>
              <option value="drop-oldest">古い待ちを捨てる</option>
              <option value="drop-newest">新しい分を捨てる</option>
            </select>
          </Field>
          <Field label="待機上限（drop 時、レーン毎）">
            <input
              type="number"
              min={0}
              value={stage.config.queueMax}
              onChange={e => setConfig({ queueMax: Math.max(0, Number(e.target.value) || 0) })}
              className={cn(SELECT_CLASS, 'w-16 text-right')}
            />
          </Field>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-[11px]">
            <Row k="送信 / 再生中 / 待ち">
              {stage.sent} / <span data-testid="bench-active">{stageActive(stage)}</span> /{' '}
              <span data-testid="bench-waiting">{stageWaiting(stage)}</span>
            </Row>
            <Row k="溢れて捨てた">
              <span data-testid="bench-dropped">{stageDropped(stage)}</span>
            </Row>
            <Row k="待ち時間 avg（直近 20）">{avg(stageWaitTimes(stage).slice(-20))} ms</Row>
            <Row k="プール中インスタンス">
              <span data-testid="bench-instances">
                {Object.values(stage.seen).reduce((n, g) => n + g.length, 0)}
              </span>{' '}
              · 生成 {avg([...readyMs.values()])} ms avg
            </Row>
          </dl>
          <ul className="mt-1 border-t border-white/10 pt-1 text-[11px]">
            {lanes.map(([key, lane]) => (
              <li
                key={key}
                className="flex items-center justify-between gap-2"
                data-testid={`bench-lane-${key}`}
              >
                <span className="text-zinc-400">{key}</span>
                <span className="truncate">
                  {lane.slots.map(s => (s ? giftById(s.giftId).name : '·')).join(' / ')}
                  <span className="text-amber-300"> +{lane.waiting.length}</span>
                  {lane.dropped > 0 && <span className="text-rose-300"> −{lane.dropped}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="端末の模擬（低性能スマホ）">
          <Field label="描画解像度 DPR（Rive / Lottie canvas）">
            <select
              data-testid="bench-dpr"
              value={dpr ?? 'auto'}
              onChange={e => setDpr(e.target.value === 'auto' ? null : Number(e.target.value))}
              className={SELECT_CLASS}
            >
              <option value="auto">この画面に従う</option>
              {DPRS.map(d => (
                <option key={d} value={d}>
                  {d}×{' '}
                  {d === 3 ? '（iPhone Pro / Pixel 相当）' : d === 1 ? '（廉価 Android 相当）' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="毎フレームの CPU 負荷（他の処理の模擬）">
            <select
              data-testid="bench-cpu-load"
              value={cpuLoadMs}
              onChange={e => setCpuLoadMs(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              {CPU_LOADS.map(ms => (
                <option key={ms} value={ms}>
                  {ms} ms{ms === 0 ? '（なし）' : ''}
                </option>
              ))}
            </select>
          </Field>
          <p className="mt-1 text-[10px] leading-4 text-zinc-500">
            CPU 自体を遅くするには DevTools → Performance → CPU 4× / 6× slowdown（e2e は{' '}
            <code>BENCH_CPU=4</code>）。SVG の解像度は画面の DPR に従います。実機では{' '}
            <code>bun dev --hostname 0.0.0.0</code> でこのページを開けば同じ計測ができます。
          </p>
        </Section>

        <Hud stats={stats} />

        <p className="text-[10px] leading-4 text-zinc-500">
          GPU 使用率はブラウザから取得できません。フレーム時間のうちメインスレッド以外（GPU /
          コンポジタ待ち）の割合と、Rive は WebGL2（共有コンテキスト）、Lottie は SVG DOM または 2D
          canvas という描画経路の差で判断してください。数値は直近 2 秒の窓、判定は 60 Hz 基準です。
        </p>
      </aside>

      <section className="flex flex-1 flex-col gap-4">
        <div className="flex justify-center lg:justify-start">
          <LiveStage
            engine={engine}
            state={stage}
            assets={assets}
            dpr={dpr}
            onReady={onReady}
            onFinished={onFinished}
          />
        </div>
        <RunsTable runs={runs} onClear={() => setRuns([])} />
        <FileTable />
      </section>
    </main>
  )
}

const FileTable = () => (
  <details className="text-[11px] text-zinc-400">
    <summary className="cursor-pointer">ファイルサイズ（.riv vs Lottie JSON）</summary>
    <table className="mt-1 whitespace-nowrap">
      <tbody>
        {manifest.gifts
          .filter(g => g.riv && g.lottie)
          .map(g => (
            <tr key={g.id}>
              <td className="pr-3">{g.id}</td>
              <td className="pr-3 text-right">T{g.tier}</td>
              <td className="pr-3 text-right">
                {g.riv ? `${(g.riv.bytes / 1024).toFixed(1)} KB` : ''}
              </td>
              <td className="pr-3 text-right">{g.riv?.shapes} shapes</td>
              <td className="pr-3 text-right">
                {g.lottie ? `${(g.lottie.bytes / 1024).toFixed(1)} KB` : ''}
              </td>
              <td className="text-right">{g.lottie?.layers} layers</td>
            </tr>
          ))}
      </tbody>
    </table>
  </details>
)
