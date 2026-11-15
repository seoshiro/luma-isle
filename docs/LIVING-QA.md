# LUMA living-island release QA

Date: 15 November 2026 (UTC). Status: **working-tree review; Git publication pending**.

Baseline: `4d79ad05c668cf1a54cb51ec5a59f125e452c0a3`.
After: the current living-island and typography working tree. This report does not
claim a published release hash. The existing four mechanisms and their order are
unchanged; optional discoveries are not additional puzzle stages.

## Read this first

The desktop application has passed the recorded automated and manual checks below.
This is **not** a complete cross-device, cross-browser or audiovisual sign-off.

- No continuous video was recorded for this update. The isolated cloud browser had
  WebGL disabled; the user's active laptop Chrome session was not disturbed for
  recording.
- No new physical-phone, Safari or headphone-listening test was completed. Firefox
  was previously blocked by URL recognition; that restriction was not bypassed.
- Mobile AFTER was not tested: the viewport override did not affect the target tab.
  Two older 390 x 844 BEFORE runs therefore have no matched AFTER result.
- The landing-bird sequence has not received a complete visual review.
- The PDF uses actual scene-only PNG exports. They do not contain the interface or
  prove typography, focus behavior, animation, sound, or complete route continuity.
  No new interface screenshot or matched visual before/after pair is claimed.
- The low-quality desktop run contains **one 1022.2 ms frame interval**. It remains
  in the results. Background load was not controlled, so the higher measured FPS
  cannot be attributed solely to this patch.

## Scope compared with 4d79ad0

The release adds a planted pig guardian near the workshop, paper-boat travel along
the actual stream and wheel bypass, independent ripples, a suspended garden chime,
temporary fireflies, optional landing visitors and a small rear-cliff door. Small
environment additions include a workshop shelf, mug, rolled plan and tools,
weather vane, tree-mounted birdhouse, moss, mushrooms and footprints.

Shared wind drives meadow, chime and vane motion. Existing scene, audio and update
loops are reused. The scene owns availability and cooldowns; keyboard controls live
in the zone panel. Photo mode, introduction, recovery and modal settings block
scene actions. The optional door discovery is saved as `secretFound`.

The interface uses locally bundled Manrope with Cyrillic and Latin support under
SIL OFL 1.1. A translucent blue-grey wordmark and fine underline replace the green
badge. Settings are grouped into atmosphere, display and journey, with accessible
selected states, independently scrolling content and touch targets of at least
44 CSS px. These are implementation features, not a claim of physical-device QA.
See [LIVING-ISLAND.md](LIVING-ISLAND.md) and [ASSETS.md](ASSETS.md).

## Checks actually completed

The following functional checks come from the release QA session on the selected
Windows laptop. Report packaging independently inspected the supplied PNG pixels,
metrics and asset notes; it did not repeat the browser actions or source tests.

| Check | Result and evidence boundary |
| --- | --- |
| Source tests | 111 passed in the recorded release run; not a substitute for visual QA. |
| Production build | Final run passed; emitted `index-CNEapkWi.js` and `index-B4hSRPIv.css`. `git diff --check` passed apart from line-ending notices. |
| Desktop interface | RU/EN, Escape and focus behavior manually checked at 1536 x 864. No new UI screenshot is included. |
| Legacy import with explicit volume | Version-1 stage-2 import with volume 42 passed. |
| Legacy import without volume | Version-1 stage-2 import defaulted to volume 30 and passed. |
| Full puzzle journey | Manual 0 to 4 passed: gates 1 + 3; disks 3, 2, 1; rings 6, 3; lighthouse 39. |
| Persistence | Reload retained 4/4 progress. |
| Real WebGL context loss | Recovery state appeared without an active HUD; Retry restored 4/4. |
| Photo mode | PNG export completed; `luma-isle-wide (8).png` was verified in Downloads at 1,512,051 bytes. |
| Introduction | Replay completed. |
| Pig | Appearance reviewed; button produced greeting/cooldown. |
| Door | Appearance reviewed and first discovery caption observed. |
| Chime and boat | Scene appearance visually reviewed. Stills alone do not verify sound or the full animated route. |
| Landing birds | Full visual sequence still unverified. |

Sound remains off by default and follows the existing master volume, gesture
unlock and hidden-tab policy. The new pig and chime cues are original local
synthesis. Subjective sound quality has not been approved through headphones.

## Matched desktop measurements

Source: `qa/living-review/metrics-comparison.json`, with the original BEFORE and
AFTER JSON retained under `qa/living-review/before` and `after`.

Protocol: 5 seconds warm-up followed by 30 seconds of unclamped RAF sampling;
1536 x 864, renderer DPR 1, morning lighting, stage 4. Renderer: ANGLE, AMD
Radeon(TM) Graphics (0x00001681), Direct3D11. No project build or encoding ran
during the AFTER samples. Other system load was not isolated. This measures RAF
intervals and CPU render duration, **not GPU timing**. All four matched runs were
marked valid with no hidden-tab interruption.

| View / quality | FPS before | FPS after | After frame p95 / p99 | After maximum | After >50 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Overview / medium | 31.122 | 47.871 | 21.0 / 21.1 ms | 27.9 ms | 0 |
| Waterfall / medium (QA 3) | 30.168 | 47.649 | 21.1 / 27.8 ms | 28.0 ms | 0 |
| Quiet garden / medium (QA 6) | 30.396 | 47.827 | 21.0 / 21.1 ms | 28.0 ms | 0 |
| Overview / low | 32.421 | 46.294 | 21.0 / 21.1 ms | **1022.2 ms** | **1** |

The BEFORE overview maximums were also long: 1001.6 ms at medium and 1001.5 ms
at low. The AFTER low result must not be summarized as a uniformly smooth run.

| View / quality | Median draw calls before / after | Median triangles before / after | Textures before / after |
| --- | ---: | ---: | ---: |
| Overview / medium | 382 / 434 (+13.6%) | 603,791 / 627,392 (+3.9%) | 29 / 29 |
| Waterfall / medium | 264 / 296 | 642,754 / 662,925 | 29 / 29 |
| Quiet garden / medium | 229 / 244 | 520,821 / 525,482 | 29 / 29 |
| Overview / low | 353 / 400 | 547,787 / 570,868 | 27 / 27 |

The 13.6% draw-call and 3.9% triangle increases describe the medium overview,
not an average across every view. Texture counts are unchanged in all matched
runs; counts alone do not establish unchanged memory consumption.

## Visual evidence and provenance

Four actual 1536 x 864 scene exports were inspected and reproduced without
retouching. The report scales images to fit the page and labels them as AFTER
views, not UI screenshots or matched visual comparisons.

- Guardian, final supplied view: `luma-surface-after-14-island-keeper-2026-11-15T16-14-21-741Z.png`.
- Chime: `luma-surface-after-16-arch-wind-chime-2026-11-15T15-54-13-074Z.png`.
- Door: `luma-surface-after-17-secret-cliff-door-2026-11-15T15-54-48-607Z.png`.
- Boat route: `luma-surface-after-15-paper-boat-route-2026-11-15T16-00-22-583Z.png`.

Images show the planted guardian and shelf, chime suspension, the door against
the cliff, and the stone-lined wheel bypass. A still cannot establish continuous
motion, physics, clipping over an entire route or state transitions. Earlier
focused-fix comparison images are not relabeled as this update's baseline.

The local report manifest records SHA-256 hashes for all images and metrics.
The raw AFTER metrics hash is
`c8cba145d099cfde2546ee0222485318ee0d18a8ba85a011761ac2a744559889`.
The raw BEFORE metrics hash is
`307cef08bc545625b93b64d8328b67ba3f1cae78fb2401dcd50e62ed79715da4`.

## Cost and release status

This update spent **0 additional Higgsfield credits**. The historical generation
ledger remains **87.5 credits**. No paid hosting, purchase, subscription or new
paid asset is claimed. Manrope is bundled locally; no external font request is
needed. Generation-credit expenditure needs a separately specified budget.

Git publication is pending at the time of this report. A future release should
record its verified commit and remote result separately. Remaining checks are
mobile AFTER, physical phone/Safari, available Firefox, headphones, complete
landing-bird review and continuous motion recording in a suitable WebGL-enabled
environment. These gaps are not marked as passes.
