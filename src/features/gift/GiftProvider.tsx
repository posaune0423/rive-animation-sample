'use client'

import { EventType, RiveFile } from '@rive-app/react-webgl2'
import { GIFTS, giftById } from '@rive/catalog'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { env } from '@/env'
import { flushFrames, recordFile, setActiveInstances, setFrameSampling } from './metrics'
import { preloadRiveRuntime } from './rive/runtime'
import {
  activeCount,
  initialScheduler,
  laneKeyFor,
  schedulerReducer,
  type SchedulerState,
} from './scheduler/lanes'
import type { GiftId, GiftLane, LaneKey, PlayingGift, QueuePolicy, Sender } from './types'

const SENDERS: readonly Sender[] = [
  { id: 'u1', name: 'さくら' },
  { id: 'u2', name: 'ゆい' },
  { id: 'u3', name: 'みお' },
  { id: 'u4', name: 'りん' },
  { id: 'u5', name: 'あおい' },
  { id: 'u6', name: 'ひな' },
  { id: 'u7', name: 'こはる' },
  { id: 'u8', name: 'めい' },
]

/** The viewer using the sample — T1 combos need a stable sender. */
export const ME: Sender = { id: 'me', name: 'あなた' }

type GiftContextValue = {
  readonly state: SchedulerState
  readonly riveFiles: Readonly<Partial<Record<GiftId, RiveFile>>>
  /** Gifts that have been requested per visual lane; each gets one pooled Rive instance. */
  readonly seen: Readonly<Record<Exclude<GiftLane, 'chat'>, readonly GiftId[]>>
  readonly send: (giftId: GiftId, sender?: Sender) => void
  readonly comment: (sender: Sender, text: string) => void
  readonly finished: (lane: LaneKey, seq: number) => void
  readonly setPolicy: (policy: QueuePolicy) => void
  readonly purge: () => void
  readonly activeFor: (lane: Exclude<GiftLane, 'chat'>, giftId: GiftId) => PlayingGift | null
  readonly laneKeyOf: (lane: Exclude<GiftLane, 'chat'>) => LaneKey
}

const GiftContext = createContext<GiftContextValue | null>(null)

export const GiftProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(
    schedulerReducer,
    initialScheduler(env.NEXT_PUBLIC_QUEUE_POLICY, env.NEXT_PUBLIC_T2_QUEUE_MAX),
  )
  const [riveFiles, setRiveFiles] = useState<Partial<Record<GiftId, RiveFile>>>({})
  const [seen, setSeen] = useState<Record<Exclude<GiftLane, 'chat'>, readonly GiftId[]>>({
    chatTop: [],
    center: [],
    full: [],
  })
  const seqRef = useRef(0)

  // Preload the runtime and parse every .riv once, up front.
  useEffect(() => {
    let cancelled = false
    const files: RiveFile[] = []
    void preloadRiveRuntime()
    for (const gift of GIFTS) {
      if (!gift.rivSrc) continue
      const t0 = performance.now()
      void fetch(gift.rivSrc)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          if (cancelled) return
          const file = new RiveFile({ buffer })
          files.push(file)
          file.on(EventType.Load, () => {
            if (cancelled) return
            recordFile(gift.id, {
              bytes: buffer.byteLength,
              loadMs: Math.round(performance.now() - t0),
            })
            setRiveFiles(prev => ({ ...prev, [gift.id]: file }))
          })
          void file.init()
        })
    }
    return () => {
      cancelled = true
      for (const f of files) f.cleanup()
    }
  }, [])

  // Pins expire on a coarse clock; frame stats are flushed on the same tick.
  useEffect(() => {
    const id = window.setInterval(() => {
      dispatch({ type: 'tick', now: performance.now() })
      flushFrames()
    }, 500)
    return () => window.clearInterval(id)
  }, [])

  const active = activeCount(state)
  useEffect(() => {
    setActiveInstances(active)
    setFrameSampling(active > 0)
  }, [active])

  const send = useCallback((giftId: GiftId, sender: Sender = ME) => {
    const gift = giftById(giftId)
    const lane = gift.lane
    if (lane !== 'chat') {
      setSeen(prev =>
        prev[lane].includes(giftId) ? prev : { ...prev, [lane]: [...prev[lane], giftId] },
      )
    }
    dispatch({
      type: 'send',
      event: {
        seq: ++seqRef.current,
        giftId,
        tier: gift.tier,
        lane: gift.lane,
        sender,
        at: performance.now(),
      },
    })
  }, [])

  const value = useMemo<GiftContextValue>(
    () => ({
      state,
      riveFiles,
      seen,
      send,
      comment: (sender, text) => dispatch({ type: 'comment', sender, text, at: performance.now() }),
      finished: (lane, seq) => dispatch({ type: 'finished', lane, seq, now: performance.now() }),
      setPolicy: policy => dispatch({ type: 'setPolicy', policy, now: performance.now() }),
      purge: () => dispatch({ type: 'purge' }),
      laneKeyOf: lane => laneKeyFor({ lane }, state.policy),
      activeFor: (lane, giftId) => {
        const bucket = state.lanes[laneKeyFor({ lane }, state.policy)]
        const job = bucket?.active
        return job && job.giftId === giftId && job.lane === lane ? job : null
      },
    }),
    [state, riveFiles, seen, send],
  )

  return <GiftContext.Provider value={value}>{children}</GiftContext.Provider>
}

export const useGift = (): GiftContextValue => {
  const ctx = useContext(GiftContext)
  if (!ctx) throw new Error('useGift must be used inside <GiftProvider>')
  return ctx
}

export const randomSender = (): Sender =>
  SENDERS[Math.floor(Math.random() * SENDERS.length)] as Sender
