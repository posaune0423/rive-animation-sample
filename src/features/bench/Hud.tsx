'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { FrameMeterStats } from './frameMeter'

const BOTTLENECK_LABEL = {
  idle: '余裕あり',
  main: 'メインスレッド (CPU) 律速',
  gpu: 'GPU / コンポジタ待ち',
  mixed: 'CPU + GPU 混在',
} as const

/** The live frame meter, 2 s window. */
export const Hud = ({ stats }: { readonly stats: FrameMeterStats }) => (
  <Section title="リアルタイム計測（直近 2 秒）">
    <div className="flex items-end justify-between">
      <div>
        <div className="text-3xl leading-none font-bold text-lime-300" data-testid="bench-fps">
          {stats.samples ? stats.fps : '-'}
        </div>
        <div className="text-[10px] text-zinc-400">fps（vsync ≈ {stats.vsyncMs || '-'} ms）</div>
      </div>
      <Sparkline history={stats.history} />
    </div>
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-[11px]">
      <Row k="frame avg / p95 / max">
        {stats.frameAvgMs} / {stats.frameP95Ms} / {stats.frameMaxMs} ms
      </Row>
      <Row k="long (>33ms) / dropped">
        <span data-testid="bench-long">{stats.longFrames}</span> /{' '}
        <span data-testid="bench-dropped-frames">{stats.droppedFrames}</span>
      </Row>
      <Row k="main-thread avg / busy">
        {stats.mainAvgMs} ms / {stats.mainBusyPct}%
      </Row>
      <Row k="GPU・コンポジタ待ち推定">{stats.offMainPct}%</Row>
      <Row k="判定">
        <span
          className={cn(
            stats.bottleneck === 'idle' && 'text-lime-300',
            stats.bottleneck === 'main' && 'text-amber-300',
            stats.bottleneck === 'gpu' && 'text-sky-300',
            stats.bottleneck === 'mixed' && 'text-rose-300',
          )}
        >
          {BOTTLENECK_LABEL[stats.bottleneck]}
        </span>
      </Row>
      <Row k="LoAF (>50ms)">{stats.loafCount ?? 'n/a'}</Row>
      <Row k="JS heap">{stats.heapMB === null ? 'n/a' : `${stats.heapMB} MB`}</Row>
      <Row k="DOM nodes">{stats.domNodes.toLocaleString()}</Row>
    </dl>
  </Section>
)

const Sparkline = ({ history }: { readonly history: readonly number[] }) => {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    const max = 50
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(0, h - (16.7 / max) * h, w, 1)
    ctx.fillRect(0, h - (33 / max) * h, w, 1)
    const barW = w / 120
    history.forEach((d, i) => {
      const x = w - (history.length - i) * barW
      const y = Math.min(h, (d / max) * h)
      ctx.fillStyle = d > 33 ? '#fb7185' : d > 20 ? '#fbbf24' : '#bef264'
      ctx.fillRect(x, h - y, Math.max(1, barW - 0.5), y)
    })
  }, [history])
  return <canvas ref={ref} width={180} height={40} className="h-10 w-[180px]" />
}

// ---- shared panel bits ------------------------------------------------------------------

export const Section = ({
  title,
  children,
  className,
}: {
  readonly title: string
  readonly children: ReactNode
  readonly className?: string
}) => (
  <section className={cn('rounded-lg border border-white/10 bg-black/30 p-2', className)}>
    <h2 className="mb-1 text-[10px] tracking-wider text-zinc-500 uppercase">{title}</h2>
    {children}
  </section>
)

export const Field = ({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) => (
  <label className="flex items-center justify-between gap-2 py-0.5 text-[11px] text-zinc-300">
    <span>{label}</span>
    {children}
  </label>
)

export const Row = ({ k, children }: { readonly k: string; readonly children: ReactNode }) => (
  <>
    <dt className="text-zinc-400">{k}</dt>
    <dd className="text-right">{children}</dd>
  </>
)

export const Toggle = ({
  active,
  className,
  ...props
}: React.ComponentProps<'button'> & { readonly active?: boolean }) => (
  <button
    type="button"
    className={cn(
      'rounded border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10 active:translate-y-px disabled:opacity-40',
      active && 'border-lime-300/60 bg-lime-300/15 text-lime-200',
      className,
    )}
    {...props}
  />
)

export const SELECT_CLASS = 'rounded border border-white/15 bg-black/40 px-2 py-0.5 text-[11px]'
