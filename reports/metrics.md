# Gift effect metrics

Generated 2026-09-12T11:53:55.172Z by `bun run e2e` (Playwright, Chromium, iPhone 14 viewport).

## Runtime

| item | value |
|---|---|
| wasm url | /rive/rive-2.42.1.wasm |
| wasm compressed / raw | 871 KB / 2108 KB |
| wasm fetch + compile | 59 ms |
| first Rive instance ready | 39 ms |
| replay latency (trigger → first advance) | 13.3 ms |

## Frame pacing (T2 + T3 + T5 concurrently, 4 s window)

WebGL renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)` (software rasterizer — not representative of a phone GPU)

| samples | fps avg | p95 frame | long frames (>33 ms) |
|---|---|---|---|
| 300 | 34.2 | 83.3 ms | 73 |

## Files

| gift | tier | lane | .riv KB | parse ms | first play latency ms |
|---|---|---|---|---|---|
| candy | T2 | chatTop | 1.1 | 60 | 1.8 |
| sparkling | T2 | chatTop | 1.8 | 60 | 4.5 |
| plush | T2 | chatTop | 0.9 | 60 | - |
| bouquet | T3 | center | 4.3 | 60 | 15.8 |
| perfume | T3 | center | 3.0 | 60 | 22.8 |
| ring | T3 | center | 1.3 | 60 | - |
| diamond | T4 | full | 2.8 | 60 | 21.7 |
| suite | T4 | full | 4.9 | 60 | - |
| palace | T5 | full | 9.6 | 60 | - |
| myth | T5 | full | 12.1 | 60 | - |
