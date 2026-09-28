'use client'

import { GIFTS, type GiftId } from '@rive/catalog'
import manifest from '@rive/manifest.json'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import type { LaneKey, QueuePolicy } from '../gift/types'
import { useBenchAssets } from './assets'
import { setCpuLoad } from './cpuLoad'
import { DEVICES, deviceById, isDeviceId, type DeviceId, type DeviceProfile } from './devices'
import { ENGINE_LABEL, ENGINES, isEngine, type Engine } from './engines'
import { setFrameCap } from './frameCap'
import { frameMeterStore, resetFrameMeter, startFrameMeter, stopFrameMeter } from './frameMeter'
import { Field, Hud, Row, SELECT_CLASS, Section, Toggle } from './Hud'
import { LiveStage, parseTileKey } from './LiveStage'
import {
  giftBurst,
  LOADS,
  loadById,
  loadStageConfig,
  onScreen,
  type LoadId,
  type LoadLevel,
} from './loads'
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
import { markFirstEffect, startupStore } from './startup'
import { hidePixelLocalStorage } from './webglPath'

const OVERLAPS = [1, 2, 3, 5, 10, 20, 50] as const
const BURST_RATES = [5, 10, 20, 30, 50, 100] as const
const BURST_SECONDS = [10, 30, 60] as const
const DPRS = [1, 2, 3] as const
const CPU_LOADS = [0, 4, 8, 12, 16] as const
const GAPS = [0, 200, 500, 1000, 2000] as const
const OVERFLOWS: readonly OverflowPolicy[] = ['queue', 'drop-oldest', 'drop-newest']
const POLICIES: readonly QueuePolicy[] = ['per-lane', 'strict']
const SENDERS = ['さくら', 'ゆい', 'みお', 'りん', 'あおい', 'ひな', 'こはる', 'めい']

const randomSender = () => SENDERS[Math.floor(Math.random() * SENDERS.length)] as string

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

const seconds = (ms: number | null): string => (ms === null ? '-' : `${(ms / 1000).toFixed(1)} s`)

const loadTitle = (load: LoadLevel): string =>
  `${load.label}（同時 ${onScreen(load)} 本・毎秒 ${load.perSecond} 件）`

/**
 * /perf — the live-stream screen at phone size on the right, the senders' side on the left:
 * pick the phone to emulate and how busy the stream is, switch the runtime, and read the frame
 * meter while viewers' gifts pile up.
 *
 * Query params seed the controls:
 * `?device=iphone-11&engine=lottie-canvas&load=heavy` (or the raw knobs:
 * `policy`, `overlap`, `gap`, `overflow`, `qmax`, `rate`, `seconds`, `dpr`, `cpu`)
 */
export const StageScreen = () => {
  const params = useSearchParams()
  // The device is page-level, like picking up another phone: changing it reloads (Rive reads the
  // WebGL path once per context, and the frame cap wraps requestAnimationFrame for the page).
  const [deviceId] = useState<DeviceId>(() => {
    const raw = params.get('device')
    return isDeviceId(raw) ? raw : 'pc'
  })
  // `?webgl=default|safari` swaps only Rive's drawing path, to tell its cost apart from the rest
  const [device] = useState<DeviceProfile>(() => {
    const profile = deviceById(deviceId)
    const webgl = params.get('webgl')
    return webgl === 'default' || webgl === 'safari' ? { ...profile, webgl } : profile
  })
  useEffect(() => {
    if (device.webgl === 'safari') hidePixelLocalStorage()
    setFrameCap(device.fpsCap)
  }, [device])

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
  const startup = useSyncExternalStore(
    startupStore.subscribe,
    startupStore.getSnapshot,
    startupStore.getSnapshot,
  )
  const { assets, total, errors } = useBenchAssets(engine)
  const loaded = Object.keys(assets).length
  const [runs, setRuns] = useState<BenchRun[]>([])
  const [scenario, setScenario] = useState('-')
  const [loadId, setLoadId] = useState<LoadId | null>(null)
  const [readyMs, setReadyMs] = useState<ReadonlyMap<string, number>>(new Map())
  const [sending, setSending] = useState(false)
  const [burstRate, setBurstRate] = useState<number>(() =>
    pick(params.get('rate'), BURST_RATES, 20),
  )
  const [burstSeconds, setBurstSeconds] = useState<number>(() =>
    pick(params.get('seconds'), BURST_SECONDS, 10),
  )
  const [dpr, setDpr] = useState<number | null>(() =>
    params.get('dpr') === null ? device.dpr : pick(params.get('dpr'), DPRS, 2),
  )
  const [cpuLoadMs, setCpuLoadMs] = useState<number>(() => pick(params.get('cpu'), CPU_LOADS, 0))
  useEffect(() => {
    setCpuLoad(cpuLoadMs)
    return () => setCpuLoad(0)
  }, [cpuLoadMs])

  const onReady = useCallback((tileKey: string, ms: number) => {
    markFirstEffect()
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
    setSending(false)
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
    setLoadId(null)
    resetFrameMeter()
    gifts.forEach((giftId, i) => {
      timers.current.push(window.setTimeout(() => send(giftId), i * intervalMs))
    })
  }

  /** Viewers keep sending: every effect gift in turn, `perSecond` for `secs`. */
  const startBurst = (label: string, perSecond: number, secs: number) => {
    sendSeries(label, giftBurst(perSecond, secs), 1000 / perSecond)
    setSending(true)
    timers.current.push(window.setTimeout(() => setSending(false), secs * 1000))
  }

  const setConfig = useCallback(
    (config: Partial<StageConfig>) =>
      dispatch({ type: 'setConfig', config, now: performance.now() }),
    [],
  )

  const runLoad = (load: LoadLevel) => {
    stopTimers()
    dispatch({ type: 'reset' })
    setConfig(loadStageConfig(load))
    startBurst(loadTitle(load), load.perSecond, load.seconds)
    setLoadId(load.id)
  }

  const reset = () => {
    stopTimers()
    dispatch({ type: 'reset' })
    setReadyMs(new Map())
    setScenario('-')
    setLoadId(null)
    resetFrameMeter()
  }

  const switchEngine = (next: Engine) => {
    reset()
    setEngine(next)
  }

  const switchDevice = (next: DeviceId) => {
    const query = new URLSearchParams(window.location.search)
    query.set('device', next)
    query.set('engine', engine)
    query.delete('dpr')
    query.delete('webgl')
    window.location.assign(`?${query}`)
  }

  const record = () => {
    const init = [...readyMs.values()]
    const waits = stageWaitTimes(stage).slice(-50)
    setRuns(prev => [
      ...prev,
      {
        at: new Date().toISOString(),
        engine,
        device: deviceId,
        load: loadId,
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
          <Link href="/" prefetch={false} className="text-[11px] text-zinc-400 underline">
            ← live
          </Link>
        </header>

        <Section title="1. 想定する端末">
          <div className="grid grid-cols-2 gap-1">
            {DEVICES.map(d => (
              <Toggle
                key={d.id}
                data-testid={`bench-device-${d.id}`}
                active={deviceId === d.id}
                onClick={() => switchDevice(d.id)}
              >
                {d.label}
              </Toggle>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-zinc-300" data-testid="bench-device-spec">
            {device.spec}
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">
            描画解像度 {device.dpr ?? 'この画面'}×・
            {device.fpsCap ? `${device.fpsCap} fps 上限` : 'fps 上限なし'}・Rive の描画経路{' '}
            {device.webgl === 'safari' ? 'Safari 相当' : 'ブラウザ既定'}
            {device.cpuThrottle > 1 && (
              <>
                。CPU の遅さは DevTools → Performance → CPU を <b>{device.cpuThrottle}×</b>{' '}
                にして再現します（自動計測では自動で設定）
              </>
            )}
          </p>
        </Section>

        <Section title="2. 配信の混み具合（視聴者がギフトを送り続ける）">
          <div className="grid grid-cols-2 gap-1">
            {LOADS.map(load => (
              <Toggle
                key={load.id}
                data-testid={`bench-load-${load.id}`}
                active={loadId === load.id && sending}
                onClick={() => runLoad(load)}
                className="flex flex-col items-start text-left"
              >
                <span className="font-semibold">{load.label}</span>
                <span className="text-[10px] text-zinc-400">
                  同時 {onScreen(load)} 本 · 毎秒 {load.perSecond} 件
                </span>
              </Toggle>
            ))}
          </div>
          <p className="mt-1 text-[10px] leading-4 text-zinc-500">
            {loadId
              ? loadById(loadId).summary
              : '押すと 10 秒間、視聴者が T2 以上のギフトを順番に送り続けます。送る順番は毎回同じなので、エンジン同士を同じ条件で比べられます。'}
          </p>
        </Section>

        <Section title="3. エンジン">
          <div className="grid grid-cols-2 gap-1">
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
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-[11px]">
            <Row k="開いてから全演出の準備完了">{seconds(startup.assetsReadyMs)}</Row>
            <Row k="最初の演出が出るまで">{seconds(startup.firstEffectMs)}</Row>
            <Row k="転送量 ランタイム / 演出 / 計">
              {startup.transferKB.runtime} / {startup.transferKB.effects} /{' '}
              {startup.transferKB.total} KB
            </Row>
          </dl>
        </Section>

        <Hud stats={stats} />

        <div className="grid grid-cols-2 gap-1">
          <Toggle data-testid="bench-record" onClick={record}>
            記録に追加
          </Toggle>
          <Toggle data-testid="bench-reset" onClick={reset}>
            リセット
          </Toggle>
        </div>

        <details className="rounded-lg border border-white/10 bg-black/30 p-2">
          <summary className="cursor-pointer text-[11px] text-zinc-400">
            詳細設定（1 件ずつ送る・キュー制御・連投の速さ）
          </summary>
          <div className="mt-2 flex flex-col gap-3">
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
                <span className="text-zinc-400">連投</span>
                <select
                  data-testid="bench-burst-rate"
                  value={burstRate}
                  onChange={e => setBurstRate(Number(e.target.value))}
                  className={SELECT_CLASS}
                >
                  {BURST_RATES.map(r => (
                    <option key={r} value={r}>
                      毎秒 {r} 件
                    </option>
                  ))}
                </select>
                <span>×</span>
                <select
                  data-testid="bench-burst-seconds"
                  value={burstSeconds}
                  onChange={e => setBurstSeconds(Number(e.target.value))}
                  className={SELECT_CLASS}
                >
                  {BURST_SECONDS.map(sec => (
                    <option key={sec} value={sec}>
                      {sec} 秒
                    </option>
                  ))}
                </select>
                <Toggle
                  data-testid="bench-burst"
                  active={sending && loadId === null}
                  className="flex-1"
                  onClick={() =>
                    sending
                      ? stopTimers()
                      : startBurst(
                          `連投 毎秒 ${burstRate} 件 × ${burstSeconds} 秒`,
                          burstRate,
                          burstSeconds,
                        )
                  }
                >
                  {sending ? '止める' : '開始'}
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
            </Section>

            <Section title="端末の模擬を個別に調整">
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
                      {d}×
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
                SVG の解像度は画面の DPR に従います。実機では{' '}
                <code>bun dev --hostname 0.0.0.0</code>{' '}
                か公開ページをスマホで開けば同じ計測ができます。
              </p>
            </Section>
          </div>
        </details>

        <p className="text-[10px] leading-4 text-zinc-500">
          GPU 使用率はブラウザから取得できません。フレーム時間のうちメインスレッド以外（GPU /
          コンポジタ待ち）の割合と、Rive は WebGL2、Lottie は SVG DOM または 2D canvas
          という描画経路の差で判断してください。数値は直近 2 秒の窓、判定は 60 fps 基準です。
        </p>
      </aside>

      <section className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
          <LiveStage
            engine={engine}
            state={stage}
            assets={assets}
            dpr={dpr}
            onReady={onReady}
            onFinished={onFinished}
          />
          <QueuePanel stage={stage} lanes={lanes} scenario={scenario} readyMs={readyMs} />
        </div>
        <RunsTable runs={runs} onClear={() => setRuns([])} />
        <FileTable />
      </section>
    </main>
  )
}

const LANE_LABEL: Record<LaneKey, string> = {
  chatTop: 'チャット上（T2）',
  center: '中央（T3）',
  full: '全画面（T4/T5）',
  stage: '1 列（全ティア）',
}

const QueuePanel = ({
  stage,
  lanes,
  scenario,
  readyMs,
}: {
  readonly stage: StageState
  readonly lanes: readonly [LaneKey, NonNullable<StageState['lanes'][LaneKey]>][]
  readonly scenario: string
  readonly readyMs: ReadonlyMap<string, number>
}) => (
  <Section title="いま画面で起きていること" className="lg:w-[300px]">
    <p className="text-[11px] text-zinc-300">{scenario}</p>
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-[11px]">
      <Row k="送信 / 再生中 / 待ち">
        {stage.sent} / <span data-testid="bench-active">{stageActive(stage)}</span> /{' '}
        <span data-testid="bench-waiting">{stageWaiting(stage)}</span>
      </Row>
      <Row k="溢れて捨てた">
        <span data-testid="bench-dropped">{stageDropped(stage)}</span>
      </Row>
      <Row k="待ち時間 avg（直近 20）">{avg(stageWaitTimes(stage).slice(-20))} ms</Row>
      <Row k="生成済みインスタンス">
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
          <span className="shrink-0 text-zinc-400">{LANE_LABEL[key]}</span>
          <span className="truncate">
            {lane.slots.filter(Boolean).length} 本
            <span className="text-amber-300"> 待ち {lane.waiting.length}</span>
            {lane.dropped > 0 && <span className="text-rose-300"> 捨て {lane.dropped}</span>}
          </span>
        </li>
      ))}
    </ul>
    {lanes.length === 0 && <p className="text-[11px] text-zinc-500">まだ何も送っていません</p>}
  </Section>
)

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
