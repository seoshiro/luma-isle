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
- Final pre-publication automated tests: 9/9 passed; TypeScript and Vite build passed.
- Model loading and fallback image use the project-aware Vite BASE_URL.
- Source-file and exclusion audit completed before initial publication.

The earlier persistence/import/PNG checks are recorded above; a repeated live
production check is still pending. Physical-phone testing has not been performed.
No 60 FPS claim is made: background-window automation is not a valid gameplay
performance benchmark.

## Release gate

- [x] Integrate final artwork and inspect its actual appearance.
- [x] Run `npm test` and `npm run build` against final source.
- [ ] Check artwork paths under `/luma-isle/`, including WebGL fallback.
- [ ] Recheck desktop/mobile interaction, persistence and PNG exports.
- [x] Review the exact tracked files for reference material, secrets and saves.
- [ ] Verify the remote commit and successful Pages workflow for that commit.
- [ ] Open the HTTPS Pages URL and check loading, interaction and console errors.
