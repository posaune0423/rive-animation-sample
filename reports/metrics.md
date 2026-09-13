# Gift effect metrics

Generated 2026-09-13T09:41:18.090Z by `bun run e2e` (Playwright, Chromium, iPhone 14 viewport).

## Runtime

| item | value |
|---|---|
| wasm url | /rive/rive-2.42.1.wasm |
| wasm compressed / raw | 871 KB / 2108 KB |
| wasm fetch + compile | 58 ms |
| first Rive instance ready | 15 ms |
| replay latency (trigger → first advance) | 13.3 ms |

## Frame pacing (T2 + T3 + T5 concurrently, 4 s window)

WebGL renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)` (software rasterizer — not representative of a phone GPU)

| samples | fps avg | p95 frame | long frames (>33 ms) |
|---|---|---|---|
| 300 | 35.7 | 66.7 ms | 80 |

## Files

| gift | tier | lane | .riv KB | parse ms | first play latency ms |
|---|---|---|---|---|---|
| candy | T2 | chatTop | 10.3 | 68 | 1.6 |
| sparkling | T2 | chatTop | 7.6 | 68 | 3.7 |
| plush | T2 | chatTop | 7.0 | 68 | - |
| bouquet | T3 | center | 27.7 | 68 | 6.2 |
| perfume | T3 | center | 14.4 | 68 | 21.4 |
| ring | T3 | center | 265.3 | 69 | - |
| diamond | T4 | full | 126.4 | 68 | 13.7 |
| suite | T4 | full | 29.5 | 69 | - |
| palace | T5 | full | 21.1 | 69 | - |
| myth | T5 | full | 48.2 | 69 | - |
