# Gift effect metrics

Generated 2026-09-13T06:36:48.264Z by `bun run e2e` (Playwright, Chromium, iPhone 14 viewport).

## Runtime

| item | value |
|---|---|
| wasm url | /rive/rive-2.42.1.wasm |
| wasm compressed / raw | 871 KB / 2108 KB |
| wasm fetch + compile | 56 ms |
| first Rive instance ready | 15 ms |
| replay latency (trigger → first advance) | 13.5 ms |

## Frame pacing (T2 + T3 + T5 concurrently, 4 s window)

WebGL renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)` (software rasterizer — not representative of a phone GPU)

| samples | fps avg | p95 frame | long frames (>33 ms) |
|---|---|---|---|
| 300 | 34.4 | 66.7 ms | 85 |

## Files

| gift | tier | lane | .riv KB | parse ms | first play latency ms |
|---|---|---|---|---|---|
| candy | T2 | chatTop | 10.3 | 66 | 1.5 |
| sparkling | T2 | chatTop | 7.6 | 66 | 3.8 |
| plush | T2 | chatTop | 7.0 | 66 | - |
| bouquet | T3 | center | 29.7 | 66 | 6.4 |
| perfume | T3 | center | 14.4 | 66 | 21.7 |
| ring | T3 | center | 272.5 | 67 | - |
| diamond | T4 | full | 126.4 | 67 | 15.0 |
| suite | T4 | full | 17.1 | 67 | - |
| palace | T5 | full | 21.1 | 67 | - |
| myth | T5 | full | 48.2 | 67 | - |
