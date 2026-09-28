# rive-animation-sample

**Live demo: https://posaune0423.github.io/rive-animation-sample/** — the stream mock on `/`, the
Rive vs Lottie bench on [`/perf/`](https://posaune0423.github.io/rive-animation-sample/perf/).

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
- **1. 想定する端末** (`src/features/bench/devices.ts`): この PC / 最新 iPhone (17 Pro) /
  数年前の iPhone (13) / 旧型 iPhone (11, the oldest iOS 27 supports) / 低価格 Android. A profile
  sets the render resolution, caps `requestAnimationFrame` at 60 Hz as iOS Safari does on a 120 Hz
  screen (`frameCap.ts`), and for iPhones hides `WEBGL_shader_pixel_local_storage` so Rive takes
  the fallback path it takes on Safari (`webglPath.ts`). Its CPU factor (M4 Pro → the phone's
  single-core speed) is applied by the e2e through the DevTools protocol; by hand, DevTools →
  Performance → CPU. The GPU is not emulated, so real phones do worse on GPU-bound work.
- **2. 配信の混み具合** (`src/features/bench/loads.ts`): 本番想定 (3 effects on screen, 5 gifts/s) ·
  盛り上がり (9, 10/s) · イベント終盤 (30, 30/s) · 限界 (60, 50/s). Viewers keep sending every effect
  gift in catalog order for 10 s — the same sequence for every engine; past 5 waiting per lane the
  oldest are dropped.
- **3. Engine**: Rive (WebGL2, one shared offscreen context — the production path — or one context
  per canvas) · Lottie SVG · Lottie Canvas (`lottie-web` 5.13). Instances are pooled per lane ×
  slot × gift, as in production. The panel also shows the cold start: time until every effect and
  the runtime are ready, until the first effect draws, and bytes transferred.
- **Live meter** (2 s window): fps with a plain verdict (なめらか ≥ 55 / ややカクつく ≥ 40 /
  カクつく ≥ 25 / コマ送り), frame avg / p95 / max, long frames (>33 ms), **main-thread ms per
  frame** (a MessageChannel task posted from inside `requestAnimationFrame` lands after that
  frame's script + style/layout/paint), the share of long frames spent _beyond_ the main thread
  (GPU / compositor waiting — browsers expose no GPU counter), a CPU / GPU bottleneck verdict,
  Long Animation Frames, JS heap, DOM nodes.
- **詳細設定**: single gifts and fixed scenarios (全12種, ♥ 連打 ×30, ダイヤ 連打 ×10, 神話 ×5 一斉),
  連投 at any rate, the queue controls (`stage.ts` over the unit-tested `queue.ts`: キュー方針,
  レーン内の同時重なり上限, 前演出終了後のディレイ, 溢れ方, 待機上限), DPR and a per-frame
  main-thread burn.
- **記録に追加** snapshots a row into a comparison table (copy as Markdown).

Query params seed the controls: `/perf?device=iphone-11&engine=lottie-canvas` (plus the raw knobs
`policy`, `overlap`, `gap`, `overflow`, `qmax`, `rate`, `seconds`, `dpr`, `cpu`).

```bash
# every phone × load level × engine, plus a cold load on slow 4G per phone → reports/bench.md
bunx playwright test e2e/bench.spec.ts --headed
BENCH_DEVICES=iphone-11 BENCH_LOADS=heavy BENCH_ENGINES=rive,lottie-canvas bunx playwright test e2e/bench.spec.ts --headed
```

Run headed: headless Chromium draws WebGL and canvas on the CPU (SwiftShader).

## Deploy

`main` is exported as a static site and published to GitHub Pages by
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). The project site lives under
`/rive-animation-sample/`, so the build sets `NEXT_PUBLIC_BASE_PATH`; `next/link` picks it up from
`basePath`, and the files we fetch ourselves (`.riv`, Lottie JSON, WebP icons, `rive.wasm`) carry
it from the same variable in `rive/catalog.ts` and `src/features/gift/rive/runtime.ts`.

To reproduce the published build locally:

```bash
NEXT_OUTPUT_EXPORT=true NEXT_PUBLIC_BASE_PATH=/rive-animation-sample bun run build
npx serve out   # or any static server; open /perf/
```

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
