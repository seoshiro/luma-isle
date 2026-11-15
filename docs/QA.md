# QA status

## Pre-art-integration baseline

The following checks were reported completed on the procedural development build:

- Pure game-state tests: 9/9 passing.
- Complete four-puzzle progression and locked-stage behavior.
- Intermediate save, reload, reset cancellation and confirmed reset.
- Hints, assist, mechanism replay, save export and import.
- Russian/English UI and preferences.
- PNG exports: wide 1920x1080, square 1600x1600, portrait 1200x1600.
- Desktop Chrome and 390x844 responsive layout.
- No captured browser errors during that baseline session.

## Integrated artwork checks

- Six optimized GLB models integrated; provenance and sizes in [ASSETS.md](ASSETS.md).
- All four puzzles manually completed again after art integration.
- Garden opening and final message checked.
- Initial pre-publication automated tests: 9/9 passed; TypeScript and Vite build passed.
- The entry-copy update adds a regression test for the exact Russian and English
  LUMA entry labels and removal of the previous wording from all localization strings.
  Updated test suite: 10/10 passed; TypeScript and Vite build passed again.
- Model loading and fallback image use the project-aware Vite BASE_URL.
- Source-file and exclusion audit completed before initial publication.

The latest integrated local build also exported a 1920x1080 PNG that was visually
checked. The earlier square/portrait export results are recorded in the baseline.

## Public production verification

Verified on 2026-11-15 at https://seoshiro.github.io/luma-isle/ against application
commit `c7be0b5`. A subsequent copy-only correction changes the RU/EN entry labels
to LUMA and adds the regression test noted above; its public locale check is separate
from the gameplay verification recorded here.

- All six GLB URLs and the fallback image returned HTTP 200 under `/luma-isle/`.
- Desktop Chrome loaded the final island, entry and skip-intro controls correctly.
- At a 390x844 browser viewport, the complete manual four-puzzle flow passed:
  water gates 1 and 3, bridge discs 3/2/1 clicks, observatory rings 6/3 clicks,
  lighthouse 13 increments to 39, then the garden opened.
- Intermediate progress after gate 1 and completed 4/4 progress both survived reload.
- No console errors or warnings were captured after completion.
- Save import through the UI restored a clean Russian start screen; the temporary
  viewport override was removed after testing.
- The application commit was verified on the remote, and its Pages build/deploy
  workflow succeeded: [run 43693580123](https://github.com/seoshiro/luma-isle/actions/runs/43693580123).

Limits: no physical phone, audio-listening test, or forced WebGL-failure test was
performed. The fallback file's URL was checked, not the forced-failure interaction.
PNG exports were checked locally as described above, not repeated on production.
No 60 FPS claim is made: background-window automation is not a valid gameplay
performance benchmark.

## Release gate

- [x] Integrate final artwork and inspect its actual appearance.
- [x] Run `npm test` and `npm run build` against final source.
- [x] Check artwork and fallback file URLs under `/luma-isle/`.
- [x] Recheck desktop and responsive-browser interaction and persistence.
- [x] Check integrated local wide PNG output; retain baseline square/portrait results.
- [x] Review the exact tracked files for reference material, secrets and saves.
- [x] Verify the remote application commit and its successful Pages workflow.
- [x] Open the HTTPS Pages URL and check loading, interaction and console errors.
