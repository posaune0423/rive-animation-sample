'use client'

import { GIFTS } from '@rive/catalog'
import { useState, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import { randomSender, useGift } from './GiftProvider'
import { metricsStore, resetFrames } from './metrics'
import { activeCount, waitingCount } from './scheduler/lanes'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export const DebugHud = () => {
  const { state, send, setPolicy, purge } = useGift()
  const metrics = useSyncExternalStore(
    metricsStore.subscribe,
    metricsStore.getSnapshot,
    metricsStore.getSnapshot,
  )
  const [detail, setDetail] = useState(false)
  const [faceGuide, setFaceGuide] = useState(false)

  const toggleFaceGuide = () => {
    setFaceGuide(v => {
      document.documentElement.toggleAttribute('data-face-guide', !v)
      return !v
    })
  }

  const spamHearts = async () => {
    for (let i = 0; i < 20; i++) {
      send('heart')
      await sleep(60)
    }
  }

  const sendAll = async () => {
    for (const gift of GIFTS) {
      send(gift.id, randomSender())
      await sleep(150)
    }
  }

  const lanes = Object.entries(state.lanes)
  const lastPlay = metrics.plays.at(-1)

  return (
    <aside
      data-testid="hud"
      className="pointer-events-auto absolute top-2 right-2 z-50 w-44 rounded-lg bg-black/70 p-2 font-mono text-[10px] leading-4 text-lime-200 backdrop-blur"
    >
      <div className="flex justify-between">
        <span>fps</span>
        <b data-testid="hud-fps">{metrics.frames.fpsAvg || '-'}</b>
      </div>
      <div className="flex justify-between">
        <span>p95 / long</span>
        <span>
          {metrics.frames.p95Ms}ms / {metrics.frames.longFrames}
        </span>
      </div>
      <div className="flex justify-between">
        <span>active / wait</span>
        <span data-testid="hud-active">
          {activeCount(state)} / {waitingCount(state)}
        </span>
      </div>
      <div className="flex justify-between">
        <span>sent / dropT2</span>
        <span>
          {state.sent} / {state.droppedT2}
        </span>
      </div>
      <div className="flex justify-between">
        <span>first advance</span>
        <span>{lastPlay?.firstAdvanceMs ?? '-'}ms</span>
      </div>
      <div className="flex justify-between">
        <span>wasm</span>
        <span>
          {metrics.wasm ? `${metrics.wasm.loadMs}ms` : '…'}
          {metrics.wasm?.encodedBytes ? ` ${Math.round(metrics.wasm.encodedBytes / 1024)}KB` : ''}
        </span>
      </div>
      {metrics.heapMB !== null && (
        <div className="flex justify-between">
          <span>heap</span>
          <span>{metrics.heapMB}MB</span>
        </div>
      )}
      <ul className="mt-1 border-t border-lime-200/20 pt-1">
        {lanes.map(([key, lane]) => (
          <li key={key} className="flex justify-between">
            <span>{key}</span>
            <span>
              {lane?.active?.giftId ?? '-'} +{lane?.waiting.length ?? 0}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <HudButton
          data-testid="hud-policy"
          onClick={() => setPolicy(state.policy === 'per-lane' ? 'strict' : 'per-lane')}
        >
          {state.policy}
        </HudButton>
        <HudButton data-testid="hud-spam-hearts" onClick={() => void spamHearts()}>
          ♥ ×20
        </HudButton>
        <HudButton data-testid="hud-send-all" onClick={() => void sendAll()}>
          全12種
        </HudButton>
        <HudButton data-testid="hud-purge" onClick={purge}>
          purge
        </HudButton>
        <HudButton onClick={toggleFaceGuide} active={faceGuide}>
          face
        </HudButton>
        <HudButton
          onClick={() => {
            resetFrames()
            setDetail(v => !v)
          }}
          active={detail}
        >
          files
        </HudButton>
      </div>
      {detail && (
        <table className="mt-1 w-full border-t border-lime-200/20 pt-1" data-testid="hud-files">
          <tbody>
            {Object.entries(metrics.files).map(([id, f]) => (
              <tr key={id}>
                <td>{id}</td>
                <td className="text-right">{f ? `${(f.bytes / 1024).toFixed(1)}KB` : ''}</td>
                <td className="text-right">{f ? `${f.loadMs}ms` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </aside>
  )
}

const HudButton = ({
  active,
  className,
  ...props
}: React.ComponentProps<'button'> & { active?: boolean }) => (
  <button
    type="button"
    className={cn(
      'rounded border border-lime-200/30 px-1 py-0.5 text-[10px] hover:bg-lime-200/10',
      active && 'bg-lime-200/20',
      className,
    )}
    {...props}
  />
)
