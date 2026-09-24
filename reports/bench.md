# Rive vs Lottie bench — gift pile-up on the live screen

Generated 2026-09-24T08:39:57.443Z by `bunx playwright test e2e/bench.spec.ts`.

Gifts pile into the 390×844 stream screen; `overlap` effects may play at once per lane (1 = production). Scenarios: **全12種 ×3** = every gift three times 80 ms apart (36 sends); **嵐 R/s × S s** = random T2+ gifts at R per second for S seconds. The meter is read over its 2 s window while every lane is full. `cpu ×` is DevTools CPU throttling (≈ 4–6 for a low-end phone), `dpr` the render resolution asked of Rive / Lottie canvas. Rows accumulate across runs (see the `BENCH_*` variables in `e2e/bench.spec.ts`); delete `reports/bench.json` to start over.

- `M4` = `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)`

| gpu | cpu × | dpr | policy | overlap | overflow | scenario | engine | active | instances | fps | frame avg ms | p95 ms | long (>33ms) | dropped frames | main busy % | off-main % | judge | heap MB | DOM nodes | init avg / max ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M4 | 1 | display | per-lane | 1 | drop-oldest 3 | 嵐 5/s × 10s | rive | 3 | 6 | 60 | 16.7 | 17.2 | 0 | 0 | 7 | 0 | idle | 13 | 377 | 7 / 40 |
| M4 | 1 | display | per-lane | 1 | drop-oldest 3 | 嵐 5/s × 10s | rive-own-context | 3 | 5 | 60 | 16.7 | 17.3 | 0 | 0 | 7 | 0 | idle | 12 | 374 | 23 / 47 |
| M4 | 1 | display | per-lane | 1 | drop-oldest 3 | 嵐 5/s × 10s | lottie-svg | 3 | 6 | 60 | 16.7 | 17.5 | 0 | 0 | 11 | 0 | idle | 14 | 771 | 6 / 28 |
| M4 | 1 | display | per-lane | 1 | drop-oldest 3 | 嵐 5/s × 10s | lottie-canvas | 3 | 5 | 60 | 16.7 | 17.7 | 0 | 0 | 7 | 0 | idle | 15 | 375 | 8 / 24 |
| M4 | 1 | display | per-lane | 3 | queue | 全12種 ×3 | rive | 9 | 9 | 60 | 16.7 | 17.2 | 0 | 0 | 9 | 0 | idle | 13 | 383 | 12 / 106 |
| M4 | 1 | display | per-lane | 3 | queue | 全12種 ×3 | rive-own-context | 9 | 9 | 60 | 16.7 | 16.8 | 0 | 0 | 10 | 0 | idle | 11 | 383 | 15 / 40 |
| M4 | 1 | display | per-lane | 3 | queue | 全12種 ×3 | lottie-svg | 9 | 9 | 60 | 16.7 | 17.6 | 0 | 0 | 10 | 0 | idle | 23 | 827 | 4 / 19 |
| M4 | 1 | display | per-lane | 3 | queue | 全12種 ×3 | lottie-canvas | 9 | 9 | 60 | 16.7 | 17.5 | 0 | 0 | 10 | 0 | idle | 16 | 384 | 7 / 23 |
| M4 | 1 | display | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | rive | 30 | 47 | 54 | 18.5 | 33.4 | 10 | 12 | 57 | 10 | mixed | 13 | 500 | 1 / 31 |
| M4 | 1 | display | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | rive-own-context | 30 | 45 | 54.4 | 18.4 | 33.4 | 9 | 11 | 99 | 0 | main | 20 | 491 | 15 / 40 |
| M4 | 1 | display | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | lottie-svg | 30 | 50 | 59.5 | 16.8 | 17.6 | 1 | 1 | 27 | 1 | idle | 40 | 3060 | 2 / 39 |
| M4 | 1 | display | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | lottie-canvas | 30 | 44 | 60 | 16.7 | 17.3 | 0 | 0 | 18 | 0 | idle | 47 | 492 | 2 / 23 |
| M4 | 4 | 3 | per-lane | 3 | queue | 全12種 ×3 | rive | 9 | 9 | 60 | 16.7 | 17.6 | 0 | 0 | 35 | 0 | idle | 11 | 383 | 10 / 77 |
| M4 | 4 | 3 | per-lane | 3 | queue | 全12種 ×3 | rive-own-context | 9 | 9 | 60 | 16.7 | 17.5 | 0 | 0 | 28 | 0 | idle | 14 | 383 | 36 / 95 |
| M4 | 4 | 3 | per-lane | 3 | queue | 全12種 ×3 | lottie-svg | 9 | 9 | 60 | 16.7 | 18.6 | 0 | 0 | 36 | 17 | idle | 22 | 827 | 14 / 66 |
| M4 | 4 | 3 | per-lane | 3 | queue | 全12種 ×3 | lottie-canvas | 9 | 9 | 59.5 | 16.8 | 18.6 | 1 | 1 | 27 | 26 | idle | 16 | 384 | 27 / 77 |

`active` = effects playing when recorded, `instances` = pooled runtime instances mounted. `main busy %` is the share of wall time the main thread spent producing frames; `off-main %` is time on missed-vsync frames beyond the main thread (GPU / compositor). `judge` classifies the bottleneck from those two.
