# Rive vs Lottie bench — gift pile-up on the live screen

Generated 2026-09-18T11:02:21.415Z by `bunx playwright test e2e/bench.spec.ts`.

Gifts pile into the 390×844 stream screen; `overlap` effects may play at once per lane (1 = production). Scenarios: **全12種 ×3** = every gift three times 80 ms apart (36 sends); **嵐 R/s × S s** = random T2+ gifts at R per second for S seconds. The meter is read over its 2 s window while every lane is full. `cpu ×` is DevTools CPU throttling (≈ 4–6 for a low-end phone), `dpr` the render resolution asked of Rive / Lottie canvas. Rows accumulate across runs (see the `BENCH_*` variables in `e2e/bench.spec.ts`); delete `reports/bench.json` to start over.

- `M4` = `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)`

| gpu | cpu × | dpr | policy | overlap | overflow | scenario | engine | active | instances | fps | frame avg ms | p95 ms | long (>33ms) | dropped frames | main busy % | off-main % | judge | heap MB | DOM nodes | init avg / max ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M4 | 1 | display | per-lane | 3 | queue | 全12種 ×3 | rive | 9 | 9 | 116.5 | 8.6 | 9.2 | 0 | 7 | 27 | 11 | idle | 13 | 382 | 4 / 37 |
| M4 | 1 | display | per-lane | 3 | queue | 全12種 ×3 | lottie-svg | 9 | 9 | 120 | 8.3 | 9.3 | 0 | 0 | 18 | 19 | idle | 18 | 826 | 4 / 20 |
| M4 | 1 | display | per-lane | 3 | queue | 全12種 ×3 | lottie-canvas | 9 | 9 | 120 | 8.3 | 9.3 | 0 | 0 | 13 | 18 | idle | 22 | 383 | 7 / 22 |
| M4 | 1 | display | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | rive | 30 | 46 | 49.3 | 20.3 | 25.1 | 0 | 40 | 28 | 37 | gpu | 20 | 496 | 1 / 32 |
| M4 | 1 | display | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | lottie-svg | 30 | 46 | 120 | 8.3 | 9 | 0 | 0 | 42 | 5 | idle | 37 | 2640 | 2 / 19 |
| M4 | 1 | display | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | lottie-canvas | 30 | 45 | 120 | 8.3 | 9.4 | 0 | 0 | 27 | 20 | idle | 28 | 494 | 2 / 20 |
| M4 | 1 | display | per-lane | 20 | drop-oldest 5 | 嵐 50/s × 10s | rive | 60 | 95 | 27.6 | 36.3 | 41.8 | 52 | 64 | 21 | 79 | gpu | 19 | 640 | 1 / 34 |
| M4 | 1 | display | per-lane | 20 | drop-oldest 5 | 嵐 50/s × 10s | lottie-svg | 60 | 99 | 117.5 | 8.5 | 9.3 | 1 | 6 | 84 | 6 | idle | 75 | 5414 | 2 / 22 |
| M4 | 1 | display | per-lane | 20 | drop-oldest 5 | 嵐 50/s × 10s | lottie-canvas | 60 | 91 | 120 | 8.3 | 9.3 | 0 | 0 | 58 | 10 | idle | 69 | 632 | 2 / 28 |
| M4 | 1 | display | per-lane | 50 | drop-oldest 5 | 嵐 100/s × 10s | rive | 150 | 242 | 10 | 99.6 | 183.3 | 18 | 208 | 65 | 35 | mixed | 23 | 1081 | 1 / 34 |
| M4 | 1 | display | per-lane | 50 | drop-oldest 5 | 嵐 100/s × 10s | lottie-svg | 150 | 241 | 47.4 | 21.1 | 33.2 | 5 | 38 | 100 | 0 | main | 143 | 13712 | 11 / 48 |
| M4 | 1 | display | per-lane | 50 | drop-oldest 5 | 嵐 100/s × 10s | lottie-canvas | 150 | 242 | 75.8 | 13.2 | 17.3 | 0 | 87 | 100 | 0 | main | 135 | 1084 | 16 / 35 |
| M4 | 4 | 3 | per-lane | 3 | queue | 全12種 ×3 | rive | 9 | 9 | 100.8 | 9.9 | 16.9 | 0 | 38 | 79 | 14 | main | 14 | 382 | 10 / 78 |
| M4 | 4 | 3 | per-lane | 3 | queue | 全12種 ×3 | lottie-svg | 9 | 9 | 118.6 | 8.4 | 10.1 | 0 | 5 | 55 | 34 | mixed | 16 | 826 | 18 / 61 |
| M4 | 4 | 3 | per-lane | 3 | queue | 全12種 ×3 | lottie-canvas | 9 | 9 | 118.5 | 8.4 | 10.2 | 1 | 18 | 41 | 47 | mixed | 15 | 383 | 32 / 81 |
| M4 | 4 | 3 | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | rive | 30 | 50 | 27.1 | 36.9 | 50.1 | 32 | 68 | 43 | 57 | mixed | 14 | 505 | 3 / 74 |
| M4 | 4 | 3 | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | lottie-svg | 30 | 52 | 69.7 | 14.3 | 25.8 | 4 | 145 | 100 | 0 | main | 37 | 2914 | 18 / 85 |
| M4 | 4 | 3 | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | lottie-canvas | 30 | 50 | 65.1 | 15.4 | 25.4 | 0 | 136 | 100 | 0 | main | 53 | 509 | 34 / 103 |
| M4 | 6 | 3 | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | rive | 30 | 51 | 16.8 | 59.4 | 75.8 | 32 | 81 | 100 | 0 | main | 14 | 511 | 8 / 123 |
| M4 | 6 | 3 | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | lottie-svg | 30 | 55 | 23.2 | 43.2 | 82.7 | 15 | 72 | 85 | 15 | main | 40 | 3412 | 98 / 384 |
| M4 | 6 | 3 | per-lane | 10 | drop-oldest 5 | 嵐 20/s × 10s | lottie-canvas | 30 | 48 | 41.7 | 24 | 33.9 | 11 | 48 | 100 | 0 | main | 34 | 499 | 85 / 246 |

`active` = effects playing when recorded, `instances` = pooled runtime instances mounted. `main busy %` is the share of wall time the main thread spent producing frames; `off-main %` is time on missed-vsync frames beyond the main thread (GPU / compositor). `judge` classifies the bottleneck from those two.
