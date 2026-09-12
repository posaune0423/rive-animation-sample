# rive-animation-sample

A proof of concept for live-streaming gift effects rendered with [Rive](https://rive.app):
twelve gifts in five price tiers, a queue that never overlaps full-screen effects, and
measurements of file size, load time and frame pacing.

The `.riv` files are **generated from TypeScript** (`rive/`) — no Rive editor involved — so the
web side can be built and load-tested before designer assets exist. See
[`docs/riv-format.md`](docs/riv-format.md) for how, and [`docs/gift-spec.md`](docs/gift-spec.md)
for what the effects do.

## Stack

Next.js 16 (App Router) · React 19 · Bun · TypeScript (`tsgo`) · Tailwind v4 + shadcn/ui ·
oxlint · oxfmt · Vitest 5 · Playwright · lefthook · t3-env + valibot · `@rive-app/react-webgl2`

## Run

```bash
bun install
bun run riv:build   # regenerate public/rive/*.riv, public/gifts/*.svg and the self-hosted wasm
bun dev             # http://localhost:3000
```

The page is a portrait live-stream mock. Tap **ギフトを送る**, pick a gift; hearts/kisses send
on tap, everything else asks once. The HUD (top right) shows fps, queue state and load metrics and
has buttons for spamming hearts, sending all twelve gifts and switching the queue policy.

To try it on a phone: `bun dev --hostname 0.0.0.0` and open `http://<your-ip>:3000`.

`/lab?src=/rive/candy.riv&w=192&h=192&loop=1` plays a single file on a plain background — handy
for reviewing one effect or bisecting a rendering problem.

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
rive/                 generator: writer (binary/scene/timeline → .riv + .svg), 12 gift definitions,
                      catalog (shared with the app), build script, manifest.json
public/rive, gifts/   generated output (committed; `riv:build` is deterministic)
src/features/gift/    scheduler (pure reducer), GiftProvider (preload + pool), RiveGiftEffect
                      (one Rive instance per lane×gift), stage/chat/sheet UI, DebugHud, metrics
e2e/                  Playwright specs (flow, queue policies, performance report)
docs/                 format notes and the effect spec
```

## Design notes

- One `.riv` per gift, parsed once (`RiveFile`), one pooled Rive instance per lane × gift that is
  replayed by firing the state-machine trigger; all instances share one WebGL2 context
  (`useOffscreenRenderer`). Idle timelines are one-shot so the runtime self-pauses.
- `rive.wasm` is self-hosted at the version the React runtime pins and compiled before the first
  effect is requested (`RuntimeLoader.setWasmUrl` + `awaitInstance`).
- Full-frame effects keep the streamer's face visible; the build fails if a resting shape covers it.

## Environment

Copy `.env.example` to `.env.local` to change the HUD, queue policy or T2 queue limit.
