# Gift effect metrics

Generated 2026-09-13T02:15:25.405Z by `bun run e2e` (Playwright, Chromium, iPhone 14 viewport).

## Runtime

| item | value |
|---|---|
| wasm url | /rive/rive-2.42.1.wasm |
| wasm compressed / raw | 871 KB / 2108 KB |
| wasm fetch + compile | 58 ms |
| first Rive instance ready | 20 ms |
| replay latency (trigger → first advance) | 12.1 ms |

## Frame pacing (T2 + T3 + T5 concurrently, 4 s window)

WebGL renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)` (software rasterizer — not representative of a phone GPU)

| samples | fps avg | p95 frame | long frames (>33 ms) |
|---|---|---|---|
| 300 | 34.7 | 83.3 ms | 70 |

## Files

| gift | tier | lane | .riv KB | parse ms | first play latency ms |
|---|---|---|---|---|---|
| candy | T2 | chatTop | 10.3 | 68 | 1.6 |
| sparkling | T2 | chatTop | 7.6 | 68 | 4.4 |
| plush | T2 | chatTop | 7.0 | 68 | - |
| bouquet | T3 | center | 29.8 | 68 | 14.9 |
| perfume | T3 | center | 14.5 | 68 | 21.4 |
| ring | T3 | center | 272.6 | 68 | - |
| diamond | T4 | full | 126.7 | 68 | 19.3 |
| suite | T4 | full | 30.1 | 69 | - |
| palace | T5 | full | 22.1 | 68 | - |
| myth | T5 | full | 48.4 | 68 | - |
