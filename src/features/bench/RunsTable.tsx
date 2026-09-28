'use client'

import { ENGINE_LABEL, type Engine } from './engines'
import type { FrameMeterStats } from './frameMeter'
import { Toggle } from './Hud'
import type { StageConfig } from './stage'

/** One recorded measurement, shown in the comparison table and exposed to Playwright. */
export type BenchRun = {
  readonly at: string
  readonly engine: Engine
  /** What was sent (e.g. "全12種 ×3", "神話 ×5") */
  readonly scenario: string
  readonly config: StageConfig
  /** render resolution (null = display) and emulated main-thread load per frame */
  readonly render: { readonly dpr: number | null; readonly cpuLoadMs: number }
  readonly stats: FrameMeterStats
  /** effects playing at once when recorded */
  readonly active: number
  readonly instances: number
  readonly initAvgMs: number | null
  readonly initMaxMs: number | null
  readonly dropped: number
  readonly waitAvgMs: number | null
}

const COLUMNS = [
  'engine',
  'scenario',
  'policy',
  'overlap',
  'gap ms',
  'overflow',
  'dpr',
  'cpu load ms',
  'fps',
  'p95 ms',
  'long',
  'dropped fr',
  'main %',
  'off-main %',
  'judge',
  'heap MB',
  'DOM',
  'active',
  'instances',
  'init avg/max ms',
  'queue drop',
  'wait ms',
] as const

export const runCells = (r: BenchRun): string[] => [
  ENGINE_LABEL[r.engine],
  r.scenario,
  r.config.policy,
  String(r.config.overlap),
  String(r.config.gapMs),
  r.config.overflow,
  r.render.dpr === null ? 'auto' : String(r.render.dpr),
  String(r.render.cpuLoadMs),
  String(r.stats.fps),
  String(r.stats.frameP95Ms),
  String(r.stats.longFrames),
  String(r.stats.droppedFrames),
  String(r.stats.mainBusyPct),
  String(r.stats.offMainPct),
  r.stats.bottleneck,
  r.stats.heapMB === null ? '-' : String(r.stats.heapMB),
  String(r.stats.domNodes),
  String(r.active),
  String(r.instances),
  `${r.initAvgMs ?? '-'} / ${r.initMaxMs ?? '-'}`,
  String(r.dropped),
  String(r.waitAvgMs ?? '-'),
]

export const runsToMarkdown = (runs: readonly BenchRun[]): string =>
  [
    `| ${COLUMNS.join(' | ')} |`,
    `|${COLUMNS.map(() => '---').join('|')}|`,
    ...runs.map(r => `| ${runCells(r).join(' | ')} |`),
  ].join('\n')

export const RunsTable = ({
  runs,
  onClear,
}: {
  readonly runs: readonly BenchRun[]
  readonly onClear: () => void
}) => {
  if (runs.length === 0) return null
  return (
    <div data-testid="bench-runs">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-white">記録（比較表）</h2>
        <Toggle onClick={() => void navigator.clipboard.writeText(runsToMarkdown(runs))}>
          Markdown をコピー
        </Toggle>
        <Toggle onClick={onClear}>クリア</Toggle>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-[11px] whitespace-nowrap">
          <thead className="text-zinc-400">
            <tr>
              {COLUMNS.map(c => (
                <th key={c} className="px-2 py-1 font-normal">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.at} className="border-t border-white/10">
                {runCells(r).map((cell, i) => (
                  <td key={COLUMNS[i]} className="px-2 py-1">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
