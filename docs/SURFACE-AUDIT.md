# Surface and grounding audit

Local release candidate, 15 November 2026. This continues the existing island;
publication and the new recording are separate gates. See LIQUID-GLASS.md for
the earlier floating-control implementation and browser checks.

## Geometry and surface checks

- Eight matched before/after views preserve camera, FOV, morning light, medium
  quality, DPR 1, stage 4/4 and 1536x808 dimensions.
- Loaded-GLB grounding covers 199 decorative objects and 11 trees, with zero
  unplaced items. Crown clearance from the bridge sweep is at least 0.30 units.
- The main continuous foundation has two runs, no unsupported samples and a
  maximum height of 0.54 units. The garden has one run and an intentional 0.138-unit
  supported setback at one outer corner, documented rather than hidden by a fake pier.
- Deterministic surface masks place 1,970 grass tufts and 104 accents in 52 groups,
  with a maximum 257,000 triangles for that vegetation workload. Main island:
  1,800 tufts, 97 accents, 45 groups, 234,746 triangles; garden: 170 tufts,
  7 accents, 7 groups, 22,254 triangles. These final counts follow canopy relocation.
  Roots stay fixed
  in wind; reduced motion freezes motion. Low quality retains approximately 12%.
- Bridge/terrace connections and continuous paths were visually reviewed,
  including additional bridge-side viewpoints. Transparent beam shadow casting
  was corrected and covered by a regression test.

## Measured workload

Same Windows laptop, Chrome 157, integrated AMD Radeon, medium/morning/4-4,
DPR 1. Three runs per viewport, five-second warmup and approximately 30 seconds
of sampling each. All six after runs are valid, with zero intervals over 33 ms
or 50 ms. Before/after low-orbit starting angles were not locked, so draw counts
are a workload comparison rather than a perfectly identical frame trace.

Values below are medians of the three run summaries. RAF measures browser-frame
intervals, not GPU time; the narrow viewport is not a physical phone benchmark.

| Viewport | RAF median before/after ms | RAF p95 before/after ms | Draw calls p95 before/after | Triangles p95 before/after |
| --- | --- | --- | --- | --- |
| 1536x808 | 7 / 7 | 14 / 14 | 317 / 356 | 477,836 / 654,987 |
| 390x844 | 7 / 7 | 7.1 / 7.1 | 286 / 287 | 474,950 / 631,939 |

After render-CPU p95 per run: desktop 4.5, 4.1, 4.2 ms; narrow 2.8, 2.8, 2.9 ms.
Median run render-CPU p95 rises from 3.9 to 4.2 ms on desktop (+7.7%) and
from 2.6 to 2.8 ms in the narrow viewport (+7.7%). Median render-CPU rises from
2.7 to 3.0 ms and from 1.7 to 2.1 ms respectively.
Extra surface detail increases geometric workload despite unchanged measured RAF
p95. These short samples are not a sustained frame-rate guarantee.

## Functional verification

- Final local validation: 71/71 tests, TypeScript, Vite production build and
  whitespace checks passed. Production bundles: `index-CFFI7g6b.js` and
  `index-DU5Od5LX.css`.
- Fresh initial save, entry, all four puzzles completed manually, garden reward,
  and retained 4/4 progress after reload were checked in Chrome.
- Wide 1920x1080 PNG export was saved and visually inspected.
- A supplementary bench-side view confirmed both feet grounded and a clear gap
  from the tree and path. Chrome low-quality mode showed visibly sparse grass and
  a matte dock with sharp icons; medium quality was restored afterwards.
- Real WEBGL_lose_context recovery separated the HUD/focus from the failed scene;
  its 1920x1080 poster loaded, exported save file was verified, and Retry reloaded
  all GLBs with 4/4 progress retained.
- An intentional development-only island/tree asset fallback kept procedural
  ground and trees functional alongside generated buildings. This does not claim
  that an unprompted real network failure occurred.
- An earlier local Vite watcher hit EBUSY while a QA PNG was being written. The
  server was restarted; QA/artifact paths are now excluded from development watch.
  The existing renderer completed valid benchmarks; production runtime is unchanged.

## Limits and budget

The new recording is pending at this checkpoint. New grass reduced-motion wind
behavior is unit-tested, but a new visual grass reduced-motion check was not
completed: the final DevTools emulation attempt did not succeed. The earlier
Liquid Glass reduced-motion UI check passed before grass integration and is not
presented as validation of the later grass. Safari/Firefox are not installed;
no physical-phone test or headphone
listening acceptance is claimed. Local evidence, saves, reference material and
secrets remain excluded from the repository. No new paid assets or generation:
cumulative spend remains 87.5 of the original 300-credit allowance.
