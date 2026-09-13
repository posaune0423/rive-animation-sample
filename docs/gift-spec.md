# Gift effect spec (what this sample implements)

Twelve gifts, cheapest first, grouped into five price tiers. Prices are in coins (1 coin = 1 yen).

| Tier | Gifts                                        | Where it plays                                  | Length | Sender pinned above chat                |
| ---- | -------------------------------------------- | ----------------------------------------------- | ------ | --------------------------------------- |
| T1   | ハート 10 · キスマーク 30                    | icon in the sender's chat row (CSS pop, 0.15 s) | —      | no (row only; repeats collapse to `×n`) |
| T2   | お菓子 100 · シャンパン 300 · ぬいぐるみ 500 | top of the chat column, inside a 64 px icon     | 3 s    | no (row highlighted)                    |
| T3   | 花束 1,000 · 香水 3,000 · 指輪 5,000         | center of the video, ≤ 1/3 of its height        | 5 s    | 10 s                                    |
| T4   | ダイヤ 10,000 · スイートルーム 30,000        | whole frame, see-through, face kept clear       | 8 s    | 30 s                                    |
| T5   | 夜の宮殿 100,000 · 神話 300,000              | whole frame, individually drawn                 | 12 s   | 60 s                                    |

## Timing templates

| Tier | Phases                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| T2   | 0.0–0.3 appear · 0.3–2.2 one short motion inside the icon · 2.2–3.0 settle to the rest pose (= the static icon) |
| T3   | 0.0–0.4 appear small · 0.4–3.6 main motion · 3.6–5.0 fade to nothing                                            |
| T4   | 0.0–0.8 light from the edges · 0.8–5.5 object crosses / room frame opens · 5.5–8.0 light returns and fades      |
| T5   | 0.0–1.5 light only · 1.5–8.0 subject, brightest around 8 s · 8.0–12.0 slow fade                                 |

## Concurrency

- T1 never queues. Same sender + same gift within 3 s → one row with `×n` (max 40 rows kept).
- T2+ queue. Two policies, switchable in the HUD (`NEXT_PUBLIC_QUEUE_POLICY`):
  - `per-lane` (default): `chatTop` (T2), `center` (T3), `full` (T4/T5) each run one effect; FIFO within a lane.
  - `strict`: every T2+ effect goes through a single queue, exactly as the wording "先に送った分が終わってから次を出す".
- T5 is inserted ahead of any waiting T4; T4/T5 are never dropped. Waiting T2 beyond
  `NEXT_PUBLIC_T2_QUEUE_MAX` (5) drops the oldest T2; its chat row stays.
- Pinned senders: max 3, highest tier first, expire after 10/30/60 s.

## Layering

The gift effect is the top layer of the stream. Bottom to top:

| layer | contents |
|---|---|
| video | the stream |
| stream UI | the header with the pinned sender names, and the chat column (T1 rows, the T2 slot) |
| button | ギフトを送る |
| effects | T3 centre and T4/T5 full frame, click-through so the button stays tappable |
| debug HUD | development only |

A full-frame effect owns the screen: while one plays the comment log fades out (500 ms) and comes
back when it ends. Pinned sender names stay — they belong to the gifting — and sit at the top of
the screen, clear of the subject. When both lanes run at once the full-frame effect paints over
the centred one; full-frame effects keep the middle clear, so neither is hidden.

## Fade out

The timeline ends at opacity 0 (T3–T5) or at the rest pose (T2). The wrapper additionally fades
200 ms on deactivation so a purge or policy switch never cuts a frame abruptly.

## Drawing rules encoded in `rive/gifts`

- Palette: deep red / champagne gold / amber / ice white (`rive/palette.ts`), on a night background.
- Full-frame effects keep the face area (22–78 % × 18–58 %) free of anything with effective alpha
  > 0.35 at rest (`rive/writer/lint.ts`, enforced by `riv:build`).
- Drawable budget per file: T2 ≤ 20, T3 ≤ 40, T4 ≤ 80, T5 ≤ 150 (images count as one each). File
  budget: T2 ≤ 150 KB, T3 ≤ 320 KB, T4/T5 ≤ 420 KB. No blend modes, no text.
- **The subjects are rendered, the light is vector.** Every gift's object (heart, lips, box,
  bottle, bear, bouquet, flacon, ring, stone, room, palace, medallion) is a physically shaded
  render from `art/blender/gifts/*.py` — one shared studio rig, camera and palette
  (`art/blender/common.py`) so the twelve read as one set — exported as transparent WebP into
  `art/renders/` and embedded in the `.riv`. Glows, sparkles, bubbles, mist, petals, dust and rings
  stay vector so they scale and animate for free. Nothing else is drawn: no backdrop plates,
  skylines or screen-wide glows — every effect is the transparent object itself plus its own
  particles, so the stream is always visible around it.
- Motion comes from parts, not frames: multi-part gifts render each part alone with the same
  camera (`candy_box` + `candy_lid`, `sparkling_bottle` + `sparkling_cork`, `perfume_bottle` +
  `perfume_cap`, `bouquet_closed` → `bouquet_open`, `suite_frame` + `suite_curtain` mirrored) and the timeline moves them. Objects that have to turn (`ring`,
  `diamond`) are 24-frame turntables cross-faded as a flipbook (`rive/gifts/flipbook.ts`).
- The list icon is the same render (`iconRender`), so the sheet, the chat row and the effect show
  one object.

## Contract for a designer-made file

If the generated files are replaced by editor-made ones, keep artboard name = gift id, state
machine `Main`, trigger `play`, event `finished` (see `rive/contract.ts`). The recommended
production shape is a View Model `Gift` with `tier` (enum), `senderName` / `coinAmount` (string),
`avatar` (image), `play` and `finished` (triggers); only `RiveGiftEffect.tsx` changes.
