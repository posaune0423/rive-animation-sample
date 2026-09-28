# Rive vs Lottie — gift effects on emulated phones

Generated 2026-09-28T12:04:48.098Z by `bunx playwright test e2e/bench.spec.ts --headed` (devices in `src/features/bench/devices.ts`, load levels in `src/features/bench/loads.ts`). fps is read over 2 s while the screen holds the stated number of effects; phones render at most 60 fps.

### 最新 iPhone — iPhone 17 Pro 相当（2025, A19 Pro, 12GB）

CPU 1× / DPR 3 / 60 fps 上限 / Rive 描画経路 Safari 相当

| 混み具合 | Rive 共有ctx | Rive 個別ctx | Lottie (SVG) | Lottie (Canvas) |
|---|---|---|---|---|
| 本番想定（同時 3 本・毎秒 5 件） | 60 fps なめらか | 60 fps なめらか | 60 fps なめらか | 60 fps なめらか |
| 盛り上がり（同時 9 本・毎秒 10 件） | 49.8 fps ややカクつく | 59 fps なめらか | 57 fps なめらか | 60 fps なめらか |
| イベント終盤（同時 30 本・毎秒 30 件） | 13.4 fps コマ送り | 54.3 fps ややカクつく | 60 fps なめらか | 60 fps なめらか |
| 限界（同時 60 本・毎秒 50 件） | 7 fps コマ送り | 52.2 fps ややカクつく | 59.5 fps なめらか | 60 fps なめらか |

### 数年前の iPhone — iPhone 13 相当（2021, A15, 4GB）

CPU 2× / DPR 3 / 60 fps 上限 / Rive 描画経路 Safari 相当

| 混み具合 | Rive 共有ctx | Rive 個別ctx | Lottie (SVG) | Lottie (Canvas) |
|---|---|---|---|---|
| 本番想定（同時 3 本・毎秒 5 件） | 60 fps なめらか | 60 fps なめらか | 60 fps なめらか | 60 fps なめらか |
| 盛り上がり（同時 9 本・毎秒 10 件） | 52.9 fps ややカクつく | 60 fps なめらか | 60 fps なめらか | 60 fps なめらか |
| イベント終盤（同時 30 本・毎秒 30 件） | 16.8 fps コマ送り | 22.2 fps コマ送り | 59 fps なめらか | 60 fps なめらか |
| 限界（同時 60 本・毎秒 50 件） | 8.4 fps コマ送り | 20 fps コマ送り | 55.9 fps なめらか | 60 fps なめらか |

### 旧型 iPhone — iPhone 11 / SE 第2世代 相当（2019, A13, 3〜4GB）— iOS 27 の最低対応機種

CPU 3× / DPR 2 / 60 fps 上限 / Rive 描画経路 Safari 相当

| 混み具合 | Rive 共有ctx | Rive 個別ctx | Lottie (SVG) | Lottie (Canvas) |
|---|---|---|---|---|
| 本番想定（同時 3 本・毎秒 5 件） | 60 fps なめらか | 60 fps なめらか | 60 fps なめらか | 60 fps なめらか |
| 盛り上がり（同時 9 本・毎秒 10 件） | 60 fps なめらか | 59 fps なめらか | 60 fps なめらか | 60 fps なめらか |
| イベント終盤（同時 30 本・毎秒 30 件） | 28.7 fps カクつく | 18.6 fps コマ送り | 58.5 fps なめらか | 60 fps なめらか |
| 限界（同時 60 本・毎秒 50 件） | 14.5 fps コマ送り | 13 fps コマ送り | 34.8 fps カクつく | 51.2 fps ややカクつく |

### 低価格 Android — 2〜3 万円台の Android（Chrome, 4GB）

CPU 5× / DPR 2 / 60 fps 上限 / Rive 描画経路 ブラウザ既定

| 混み具合 | Rive 共有ctx | Rive 個別ctx | Lottie (SVG) | Lottie (Canvas) |
|---|---|---|---|---|
| 本番想定（同時 3 本・毎秒 5 件） | 59.5 fps なめらか | 60 fps なめらか | 59.5 fps なめらか | 59.5 fps なめらか |
| 盛り上がり（同時 9 本・毎秒 10 件） | 60 fps なめらか | 59.5 fps なめらか | 59 fps なめらか | 59.5 fps なめらか |
| イベント終盤（同時 30 本・毎秒 30 件） | 30.5 fps カクつく | 15.3 fps コマ送り | 46.6 fps ややカクつく | 55.5 fps なめらか |
| 限界（同時 60 本・毎秒 50 件） | 14.5 fps コマ送り（同時 59 本までしか積めず） | 6.3 fps コマ送り | 17 fps コマ送り | 28.7 fps カクつく |

## 対照: Rive が高速経路（PLS = WEBGL_shader_pixel_local_storage）を使えた場合

| 端末 | 混み具合 | エンジン | 出荷状態のブラウザ（PLS なし） | PLS を有効にした Chromium |
|---|---|---|---|---|
| 最新 iPhone | 盛り上がり | Rive 共有ctx | 49.8 fps（なし） | 59.4 fps（あり） |
| 最新 iPhone | 盛り上がり | Rive 個別ctx | 59 fps（なし） | 57.9 fps（あり） |
| 最新 iPhone | イベント終盤 | Rive 共有ctx | 13.4 fps（なし） | 59.5 fps（あり） |
| 最新 iPhone | イベント終盤 | Rive 個別ctx | 54.3 fps（なし） | 55.4 fps（あり） |
| 最新 iPhone | 限界 | Rive 共有ctx | 7 fps（なし） | 50.8 fps（あり） |
| 最新 iPhone | 限界 | Rive 個別ctx | 52.2 fps（なし） | 48.3 fps（あり） |
| 旧型 iPhone | 盛り上がり | Rive 共有ctx | 60 fps（なし） | 59.4 fps（あり） |
| 旧型 iPhone | 盛り上がり | Rive 個別ctx | 59 fps（なし） | 59.5 fps（あり） |
| 旧型 iPhone | イベント終盤 | Rive 共有ctx | 28.7 fps（なし） | 60 fps（あり） |
| 旧型 iPhone | イベント終盤 | Rive 個別ctx | 18.6 fps（なし） | 18.8 fps（あり） |
| 旧型 iPhone | 限界 | Rive 共有ctx | 14.5 fps（なし） | 55.9 fps（あり） |
| 旧型 iPhone | 限界 | Rive 個別ctx | 13 fps（なし） | 13.7 fps（あり） |
| 低価格 Android | 盛り上がり | Rive 共有ctx | 60 fps（なし） | 59.5 fps（あり） |
| 低価格 Android | 盛り上がり | Rive 個別ctx | 59.5 fps（なし） | 58.5 fps（あり） |
| 低価格 Android | イベント終盤 | Rive 共有ctx | 30.5 fps（なし） | 60 fps（あり） |
| 低価格 Android | イベント終盤 | Rive 個別ctx | 15.3 fps（なし） | 13.8 fps（あり） |
| 低価格 Android | 限界 | Rive 共有ctx | 14.5 fps（なし） | 34.4 fps（あり） |
| 低価格 Android | 限界 | Rive 個別ctx | 6.3 fps（なし） | 7.1 fps（あり） |

## 初回ロード（混雑した 4G: 1.6 Mbps / RTT 150 ms、キャッシュなし）

| 端末 | ランタイム | 回線 | 全演出の準備完了 s | 最初の演出 s | 転送 ランタイム KB | 転送 演出 KB | 転送 計 KB |
|---|---|---|---|---|---|---|---|
| 最新 iPhone | lottie | slow 4G | 6.0 | 6.1 | 75 | 533 | 1008 |
| 最新 iPhone | rive | slow 4G | 10.2 | 10.7 | 871 | 560 | 1831 |
| 数年前の iPhone | lottie | slow 4G | 6.0 | 6.2 | 75 | 533 | 1008 |
| 数年前の iPhone | rive | slow 4G | 10.3 | 10.4 | 871 | 560 | 1831 |
| 旧型 iPhone | lottie | slow 4G | 6.1 | 6.3 | 75 | 533 | 1008 |
| 旧型 iPhone | rive | slow 4G | 10.4 | 10.5 | 871 | 560 | 1831 |
| 低価格 Android | lottie | slow 4G | 6.1 | 6.5 | 75 | 533 | 1008 |
| 低価格 Android | rive | slow 4G | 10.4 | 10.7 | 871 | 560 | 1831 |

## 詳細

| device | load | engine | active | fps | p95 ms | long | main % | off-main % | judge | heap MB | DOM | instances | gpu | PLS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| iphone-17-pro | normal | rive | 3 | 60 | 17.5 | 0 | 6 | 0 | idle | 11 | 412 | 5 | M4 | no |
| iphone-17-pro | normal | rive-own-context | 3 | 60 | 17.3 | 0 | 6 | 0 | idle | 9 | 412 | 5 | M4 | no |
| iphone-17-pro | normal | lottie-svg | 3 | 60 | 17.4 | 0 | 7 | 0 | idle | 20 | 649 | 6 | M4 | no |
| iphone-17-pro | normal | lottie-canvas | 3 | 60 | 17.5 | 0 | 6 | 0 | idle | 19 | 413 | 6 | M4 | no |
| iphone-17-pro | busy | rive | 9 | 59.4 | 18.7 | 1 | 8 | 26 | idle | 11 | 436 | 13 | M4 | yes |
| iphone-17-pro | busy | rive | 9 | 49.8 | 33.4 | 14 | 40 | 28 | mixed | 9 | 442 | 15 | M4 | no |
| iphone-17-pro | busy | rive-own-context | 9 | 57.9 | 18.7 | 2 | 11 | 29 | gpu | 11 | 442 | 15 | M4 | yes |
| iphone-17-pro | busy | rive-own-context | 9 | 59 | 18.6 | 2 | 9 | 23 | idle | 11 | 442 | 15 | M4 | no |
| iphone-17-pro | busy | lottie-svg | 9 | 57 | 17.7 | 5 | 42 | 0 | idle | 15 | 1117 | 15 | M4 | no |
| iphone-17-pro | busy | lottie-canvas | 9 | 60 | 17.5 | 0 | 9 | 0 | idle | 17 | 443 | 15 | M4 | no |
| iphone-17-pro | heavy | rive | 30 | 59.5 | 18.6 | 1 | 12 | 23 | idle | 14 | 514 | 39 | M4 | yes |
| iphone-17-pro | heavy | rive | 30 | 13.4 | 85 | 26 | 15 | 85 | gpu | 13 | 538 | 49 | M4 | no |
| iphone-17-pro | heavy | rive-own-context | 30 | 55.4 | 33.2 | 6 | 73 | 8 | main | 22 | 523 | 45 | M4 | yes |
| iphone-17-pro | heavy | rive-own-context | 30 | 54.3 | 33.4 | 8 | 85 | 6 | main | 12 | 529 | 47 | M4 | no |
| iphone-17-pro | heavy | lottie-svg | 30 | 60 | 17.7 | 0 | 22 | 0 | idle | 44 | 2949 | 50 | M4 | no |
| iphone-17-pro | heavy | lottie-canvas | 30 | 60 | 17.7 | 0 | 18 | 0 | idle | 40 | 545 | 52 | M4 | no |
| iphone-17-pro | extreme | rive | 60 | 50.8 | 48.4 | 11 | 48 | 17 | mixed | 15 | 673 | 95 | M4 | yes |
| iphone-17-pro | extreme | rive | 60 | 7 | 168.1 | 13 | 9 | 91 | gpu | 11 | 673 | 92 | M4 | no |
| iphone-17-pro | extreme | rive-own-context | 60 | 48.3 | 49.5 | 15 | 93 | 2 | main | 20 | 655 | 89 | M4 | yes |
| iphone-17-pro | extreme | rive-own-context | 60 | 52.2 | 33.4 | 10 | 89 | 4 | main | 23 | 661 | 91 | M4 | no |
| iphone-17-pro | extreme | lottie-svg | 60 | 59.5 | 17.6 | 1 | 36 | 0 | idle | 67 | 5783 | 105 | M4 | no |
| iphone-17-pro | extreme | lottie-canvas | 60 | 60 | 17.6 | 0 | 32 | 0 | idle | 65 | 683 | 99 | M4 | no |
| iphone-13 | normal | rive | 3 | 60 | 17.6 | 0 | 11 | 0 | idle | 9 | 413 | 5 | M4 | no |
| iphone-13 | normal | rive-own-context | 3 | 60 | 17.7 | 0 | 11 | 0 | idle | 9 | 413 | 5 | M4 | no |
| iphone-13 | normal | lottie-svg | 3 | 60 | 17.6 | 0 | 12 | 0 | idle | 20 | 650 | 6 | M4 | no |
| iphone-13 | normal | lottie-canvas | 3 | 60 | 17.6 | 0 | 9 | 0 | idle | 19 | 414 | 6 | M4 | no |
| iphone-13 | busy | rive | 9 | 52.9 | 33.4 | 8 | 50 | 12 | mixed | 10 | 443 | 15 | M4 | no |
| iphone-13 | busy | rive-own-context | 9 | 60 | 17.5 | 0 | 21 | 0 | idle | 11 | 443 | 15 | M4 | no |
| iphone-13 | busy | lottie-svg | 9 | 60 | 17.7 | 0 | 17 | 0 | idle | 15 | 1118 | 15 | M4 | no |
| iphone-13 | busy | lottie-canvas | 9 | 60 | 17.7 | 0 | 16 | 0 | idle | 17 | 444 | 15 | M4 | no |
| iphone-13 | heavy | rive | 30 | 16.8 | 67.7 | 33 | 23 | 77 | gpu | 13 | 545 | 50 | M4 | no |
| iphone-13 | heavy | rive-own-context | 30 | 22.2 | 67.2 | 35 | 100 | 0 | main | 12 | 548 | 50 | M4 | no |
| iphone-13 | heavy | lottie-svg | 30 | 59 | 17.6 | 1 | 42 | 0 | idle | 54 | 3068 | 53 | M4 | no |
| iphone-13 | heavy | lottie-canvas | 30 | 60 | 17.6 | 0 | 35 | 0 | idle | 37 | 546 | 49 | M4 | no |
| iphone-13 | extreme | rive | 60 | 8.4 | 133.4 | 16 | 17 | 83 | gpu | 19 | 671 | 94 | M4 | no |
| iphone-13 | extreme | rive-own-context | 60 | 20 | 100.7 | 33 | 100 | 0 | main | 22 | 662 | 90 | M4 | no |
| iphone-13 | extreme | lottie-svg | 60 | 55.9 | 17.7 | 3 | 82 | 0 | idle | 59 | 5679 | 104 | M4 | no |
| iphone-13 | extreme | lottie-canvas | 60 | 60 | 17.7 | 0 | 69 | 0 | idle | 65 | 642 | 81 | M4 | no |
| iphone-11 | normal | rive | 3 | 60 | 17.7 | 0 | 16 | 0 | idle | 11 | 413 | 5 | M4 | no |
| iphone-11 | normal | rive-own-context | 3 | 60 | 17.6 | 0 | 15 | 0 | idle | 13 | 413 | 6 | M4 | no |
| iphone-11 | normal | lottie-svg | 3 | 60 | 17.6 | 0 | 18 | 0 | idle | 16 | 650 | 6 | M4 | no |
| iphone-11 | normal | lottie-canvas | 3 | 60 | 17.6 | 0 | 13 | 0 | idle | 18 | 414 | 6 | M4 | no |
| iphone-11 | busy | rive | 9 | 59.4 | 18.5 | 0 | 17 | 32 | idle | 11 | 443 | 15 | M4 | yes |
| iphone-11 | busy | rive | 9 | 60 | 18.5 | 0 | 23 | 27 | idle | 12 | 437 | 13 | M4 | no |
| iphone-11 | busy | rive-own-context | 9 | 59.5 | 18.6 | 1 | 34 | 27 | idle | 11 | 437 | 13 | M4 | yes |
| iphone-11 | busy | rive-own-context | 9 | 59 | 18.6 | 1 | 35 | 29 | idle | 12 | 437 | 13 | M4 | no |
| iphone-11 | busy | lottie-svg | 9 | 60 | 17.6 | 0 | 26 | 0 | idle | 18 | 1118 | 15 | M4 | no |
| iphone-11 | busy | lottie-canvas | 9 | 60 | 17.6 | 0 | 20 | 0 | idle | 18 | 444 | 15 | M4 | no |
| iphone-11 | heavy | rive | 30 | 60 | 18.5 | 0 | 32 | 21 | idle | 16 | 515 | 42 | M4 | yes |
| iphone-11 | heavy | rive | 30 | 28.7 | 51.5 | 35 | 51 | 47 | mixed | 14 | 545 | 50 | M4 | no |
| iphone-11 | heavy | rive-own-context | 30 | 18.8 | 83.6 | 33 | 100 | 0 | main | 11 | 533 | 47 | M4 | yes |
| iphone-11 | heavy | rive-own-context | 30 | 18.6 | 100 | 31 | 100 | 0 | main | 17 | 539 | 50 | M4 | no |
| iphone-11 | heavy | lottie-svg | 30 | 58.5 | 17.6 | 1 | 67 | 0 | idle | 35 | 2956 | 50 | M4 | no |
| iphone-11 | heavy | lottie-canvas | 30 | 60 | 17.6 | 0 | 50 | 0 | idle | 41 | 519 | 40 | M4 | no |
| iphone-11 | extreme | rive | 60 | 55.9 | 32 | 4 | 88 | 3 | main | 19 | 692 | 100 | M4 | yes |
| iphone-11 | extreme | rive | 60 | 14.5 | 99.3 | 28 | 36 | 64 | gpu | 16 | 644 | 84 | M4 | no |
| iphone-11 | extreme | rive-own-context | 60 | 13.7 | 168.2 | 25 | 100 | 0 | main | 20 | 671 | 91 | M4 | yes |
| iphone-11 | extreme | rive-own-context | 60 | 13 | 134.3 | 25 | 100 | 0 | main | 19 | 674 | 92 | M4 | no |
| iphone-11 | extreme | lottie-svg | 60 | 34.8 | 50.1 | 28 | 100 | 0 | main | 67 | 5677 | 97 | M4 | no |
| iphone-11 | extreme | lottie-canvas | 60 | 51.2 | 33.5 | 13 | 100 | 0 | main | 62 | 633 | 81 | M4 | no |
| android-low | normal | rive | 3 | 59.5 | 18.6 | 0 | 27 | 29 | idle | 10 | 416 | 6 | M4 | no |
| android-low | normal | rive-own-context | 3 | 60 | 18.6 | 0 | 23 | 25 | idle | 12 | 416 | 6 | M4 | no |
| android-low | normal | lottie-svg | 3 | 59.5 | 18.5 | 0 | 29 | 22 | idle | 17 | 650 | 6 | M4 | no |
| android-low | normal | lottie-canvas | 3 | 59.5 | 18.5 | 1 | 22 | 26 | idle | 16 | 414 | 6 | M4 | no |
| android-low | busy | rive | 9 | 59.5 | 18.6 | 1 | 30 | 23 | idle | 10 | 437 | 13 | M4 | yes |
| android-low | busy | rive | 9 | 60 | 18.6 | 0 | 42 | 20 | idle | 9 | 437 | 13 | M4 | no |
| android-low | busy | rive-own-context | 9 | 58.5 | 18.7 | 1 | 39 | 29 | gpu | 12 | 428 | 10 | M4 | yes |
| android-low | busy | rive-own-context | 9 | 59.5 | 18.6 | 1 | 42 | 23 | idle | 12 | 428 | 10 | M4 | no |
| android-low | busy | lottie-svg | 9 | 59 | 18.6 | 2 | 44 | 21 | idle | 20 | 1118 | 15 | M4 | no |
| android-low | busy | lottie-canvas | 9 | 59.5 | 18.6 | 0 | 34 | 25 | idle | 18 | 444 | 15 | M4 | no |
| android-low | heavy | rive | 30 | 60 | 18.4 | 0 | 79 | 10 | idle | 14 | 545 | 50 | M4 | yes |
| android-low | heavy | rive | 30 | 30.5 | 51.8 | 31 | 78 | 22 | main | 17 | 548 | 50 | M4 | no |
| android-low | heavy | rive-own-context | 30 | 13.8 | 133.3 | 27 | 100 | 0 | main | 15 | 545 | 52 | M4 | yes |
| android-low | heavy | rive-own-context | 30 | 15.3 | 116.2 | 29 | 100 | 0 | main | 17 | 533 | 45 | M4 | no |
| android-low | heavy | lottie-svg | 30 | 46.6 | 35 | 13 | 100 | 0 | main | 48 | 2443 | 40 | M4 | no |
| android-low | heavy | lottie-canvas | 30 | 55.5 | 33 | 5 | 95 | 2 | main | 48 | 549 | 50 | M4 | no |
| android-low | extreme | rive | 59 | 14.5 | 100.1 | 28 | 63 | 37 | mixed | 24 | 683 | 95 | M4 | no |
| android-low | extreme | rive | 60 | 34.4 | 50.4 | 26 | 100 | 0 | main | 11 | 698 | 100 | M4 | yes |
| android-low | extreme | rive-own-context | 59 | 7.1 | 248.2 | 12 | 100 | 0 | main | 12 | 722 | 110 | M4 | yes |
| android-low | extreme | rive-own-context | 60 | 6.3 | 217 | 11 | 100 | 0 | main | 17 | 716 | 108 | M4 | no |
| android-low | extreme | lottie-svg | 60 | 17 | 101.6 | 29 | 100 | 0 | main | 67 | 5864 | 100 | M4 | no |
| android-low | extreme | lottie-canvas | 60 | 28.7 | 51.2 | 35 | 100 | 0 | main | 76 | 699 | 100 | M4 | no |

`main %` is the share of wall time the main thread spent producing frames; `off-main %` is time on missed frames beyond it (GPU / compositor). `PLS` = whether Rive had WEBGL_shader_pixel_local_storage (hidden for the Safari-like profiles).
