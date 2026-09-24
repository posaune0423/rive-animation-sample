# rive-animation-sample

A proof of concept for live-streaming gift effects rendered with [Rive](https://rive.app):
twelve gifts in five price tiers, a queue that never overlaps full-screen effects, and
measurements of file size, load time and frame pacing.

The `.riv` files are **generated from TypeScript** (`rive/`) — no Rive editor involved — so the
web side can be built and load-tested before designer assets exist. The gift artwork itself is
**rendered headlessly with Blender** (`art/`) from one shared studio rig and embedded in the
files as WebP; motion, light and particles are vector timelines on top. See
[`docs/riv-format.md`](docs/riv-format.md) for the format, and
[`docs/gift-spec.md`](docs/gift-spec.md) for what the effects do.

## Stack

Next.js 16 (App Router) · React 19 · Bun · TypeScript (`tsgo`) · Tailwind v4 + shadcn/ui ·
oxlint · oxfmt · Vitest 5 · Playwright · lefthook · t3-env + valibot · `@rive-app/react-webgl2`

## Run

```bash
bun install
bun run riv:build   # regenerate public/rive/*.riv, public/gifts/*.webp and the self-hosted wasm
bun dev             # http://localhost:3000
```

Re-rendering the artwork needs Blender 4.2+ at `/Applications/Blender.app` (or `$BLENDER`),
ImageMagick (`magick`) and `cwebp`:

```bash
bun run art:preview          # every gift at low res/samples (~2 min)
bun run art:render ring      # one gift at full quality; no argument renders all (~15 min)
bun run riv:build            # embed the new renders
bun run e2e/record.ts http://localhost:3100 reports/gift-effects.webm   # video of all 12 gifts
# the encoded mp4 is not committed; upload it with: gh release upload <tag> reports/gift-effects.mp4
```

The page is a portrait live-stream mock. Tap **ギフトを送る**, pick a gift; hearts/kisses send
on tap, everything else asks once. The HUD (top right) shows fps, queue state and load metrics and
has buttons for spamming hearts, sending all twelve gifts and switching the queue policy.

To try it on a phone: `bun dev --hostname 0.0.0.0` and open `http://<your-ip>:3000`.

`/lab?src=/rive/candy.riv&w=192&h=192&loop=1` plays a single file on a plain background — handy
for reviewing one effect or bisecting a rendering problem.

### `/perf` — Rive vs Lottie on the live screen, under a gift pile-up

`riv:build` also compiles every effect to Lottie (`public/lottie/<id>.json`, same scene graph and
keyframes via `rive/writer/toLottie.ts`), so `/perf` can play the **same artwork and motion**
through three runtimes on the **same phone-size stream screen** and measure while gifts pile up:

- **Right**: the 390×844 live screen with the production lanes — the T2 slot at the top of the
  chat, T3 in the centre, T4/T5 full frame — and the chat rows (T1 hearts collapse to `×n`, the log
  steps aside for a full-frame effect).
- **Left**: the viewers. Tap any of the twelve gifts, or fire a scenario: 全12種 (順に / ×3),
  ♥ 連打 ×30, ダイヤ 連打 ×10, 神話 ×5 一斉, or a **storm** of random T2+ gifts at 5–100 per second
  for 10–60 s (the load that separates the runtimes).
- **Queue controls** (`src/features/bench/stage.ts` over the unit-tested
  `src/features/bench/queue.ts`): キュー方針 (レーン毎 / 厳格), **レーン内の同時重なり上限**
  (1 = production, up to 50 stacked effects per lane), 前演出終了後のディレイ, 溢れ方 (全部待つ /
  古い待ちを捨てる / 新しい分を捨てる) and the per-lane waiting cap. Each lane shows what is
  playing, how many wait and how many were dropped.
- **Engine**: Rive (WebGL2, one shared offscreen context, the production path) · Lottie SVG ·
  Lottie Canvas (`lottie-web` 5.13). Instances are pooled per lane × slot × gift, as in production.
- **Live meter** (2 s window): fps, frame avg / p95 / max, long frames (>33 ms), dropped frames
  against the estimated vsync, **main-thread ms per frame** (a MessageChannel task posted from
  inside `requestAnimationFrame` lands after that frame's script + style/layout/paint), the share
  of long frames spent _beyond_ the main thread (GPU / compositor waiting — browsers expose no
  GPU counter, this is the closest observable signal), a CPU / GPU bottleneck verdict, Long
  Animation Frames, JS heap, DOM nodes, pooled instance count and creation time.
- **端末の模擬**: 描画解像度 DPR (1 / 2 / 3, applied to Rive and Lottie canvas — SVG follows the
  display) and a per-frame main-thread burn (0–16 ms) that emulates the rest of an app on a slow
  phone. To slow the CPU itself use DevTools → Performance → CPU 4× / 6× slowdown, or `BENCH_CPU`
  below; to measure on a real phone run `bun dev --hostname 0.0.0.0` and open `/perf` there.
- **記録に追加** snapshots a row (engine, scenario, queue config, device emulation, meter) into a
  comparison table (copy as Markdown).

Query params seed the controls: `/perf?engine=lottie-svg&policy=per-lane&overlap=10&overflow=drop-oldest&qmax=5&rate=50&seconds=10&dpr=3&cpu=8`.

```bash
bunx playwright test e2e/bench.spec.ts            # headless (SwiftShader): functional + reports/bench.md
# real GPU numbers: run headed; rows accumulate in reports/bench.md
BENCH_OVERLAP=3 bunx playwright test e2e/bench.spec.ts --headed
BENCH_SCENARIO=storm BENCH_RATE=50 BENCH_OVERLAP=20 bunx playwright test e2e/bench.spec.ts --headed
BENCH_SCENARIO=storm BENCH_RATE=20 BENCH_OVERLAP=10 BENCH_CPU=4 BENCH_DPR=3 bunx playwright test e2e/bench.spec.ts --headed  # ≈ low-end phone
```

`BENCH_SCENARIO` (all-x3 | storm), `BENCH_RATE`, `BENCH_SECONDS`, `BENCH_OVERLAP`, `BENCH_POLICY`,
`BENCH_OVERFLOW`, `BENCH_QMAX`, `BENCH_CPU` (DevTools CPU throttling factor), `BENCH_DPR`.

## Check

```bash
bun run check   # oxfmt --check, oxlint, tsgo, vitest
bun run e2e     # Playwright: builds, starts on :3100, runs e2e/*.spec.ts, writes reports/metrics.md
```

Vitest loads every generated `.riv` headlessly with `@rive-app/canvas-advanced`, fires the `play`
trigger and asserts that `finished` is reported at the tier's duration. Playwright drives the real
UI on an iPhone-14 viewport and records metrics (see `reports/metrics.md` after a run).

## Layout

```
art/blender/          Blender scripts: common.py (rig, camera, materials, turntable) + gifts/*.py
art/renders/          rendered WebP parts and turntable frames (committed; input to riv:build)
rive/                 generator: writer (binary/scene/timeline/images → .riv), 12 gift definitions,
                      flipbook helper, catalog (shared with the app), build script, manifest.json
public/rive, gifts/   generated output (committed; `riv:build` is deterministic)
public/lottie/        the same effects as Lottie JSON (`toLottie`), for the /perf comparison
src/features/gift/    scheduler (pure reducer), GiftProvider (preload + pool), RiveGiftEffect
                      (one Rive instance per lane×gift), stage/chat/sheet UI, DebugHud, metrics
src/features/bench/   /perf: lane stage + queue reducers, frame meter, Rive / Lottie tiles, LiveStage, StageScreen
e2e/                  Playwright specs (flow, queue policies, performance report, Rive vs Lottie bench)
docs/                 format notes and the effect spec
```

## Design notes

- One `.riv` per gift, parsed once (`RiveFile`), one pooled Rive instance per lane × gift that is
  replayed by firing the state-machine trigger; all instances share one WebGL2 context
  (`useOffscreenRenderer`). Idle timelines are one-shot so the runtime self-pauses.
- `rive.wasm` is self-hosted at the version the React runtime pins and compiled before the first
  effect is requested (`RuntimeLoader.setWasmUrl` + `awaitInstance`).
- Full-frame effects keep the streamer's face visible; the build fails if a resting shape covers it.
- Rendered parts share one camera per gift, so a lid, a cork or a cap is a separate image placed
  at the same point as its body and simply moved by the timeline; turning objects are 24-frame
  turntables cross-faded in Rive rather than a 3D runtime.

## Environment

Copy `.env.example` to `.env.local` to change the HUD, queue policy or T2 queue limit.
