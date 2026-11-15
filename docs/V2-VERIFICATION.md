# LUMA ISLE v2 verification

Date: 15 November 2026. Baseline: 6ee5d4c81dd59256293e3cb3994e09cfcef839b3. The existing world and four state-gated puzzles are retained. The supplied audit ends at “5. Визуальная доводка существующего острова Н”; no missing continuation was assumed.

## Changes

- Separate full WebGL failure/context-loss recovery screen, clean actual-game poster, working retry and save export. The canvas is inert while unavailable and the game HUD/photo controls are not mounted.
- Each local GLB has an 18-second fetch/parse deadline. Individual failures preserve the procedural object and allow play. Late results and renderer/shadow resources are disposed.
- Two-second cloud passage from the actual starting pose, 37 → 56 → 37 FOV, strong early translation and gentle stop. Skip settles in the same overview. Reduced motion is a 250ms dissolve with no accelerated camera flight or FOV change.
- Water camera looks from above the channel's open side; all three gates remain legible. Bridge, open dome, lighthouse/target and garden have wider, UI-aware views, including 390px layouts. Gate hover/focus highlights the corresponding 3D handle. Foreground decorative clouds do not obstruct focused mechanisms.
- Irregular tubular waterfall with foam/mist; coordinated vegetation. Two flocks use shared geometry/materials, eight birds normally and four on low quality. Reduced motion freezes decoration, hidden tabs stop the frame loop.
- Natural CC0 bird/water/wind recordings, five bird excerpts, 6–18 second intervals. Sound defaults off and needs a gesture. Master volume is saved, legacy v1 saves migrate safely. Hidden/reduced-motion states are silent, sunset/evening have no birds. Audio loading has a 15-second deadline. Temporary intro pause retains the prior unlock; actual scene failure closes audio.
- First garden entry opens flowers, adds arch light and lifts the second flock. Contrast-backed final text is positioned below the garden rather than over its arch. Success no longer produces a duplicate visible toast; one polite live region announces progress.

## Completed checks before publication

- 21 unit tests: game and save invariants, volume migration, sound policy, phrase spacing, birds/collision envelope/quality, volumetric waterfall, intro duration/FOV/reduced motion.
- TypeScript and Vite production build passed.
- Native Chrome on the owner's Windows laptop: manually completed all four puzzles without assist, including the inclusive lighthouse target, and entered the garden. All successful mechanisms and final 4/4 state were observed.
- Desktop visual inspection of water, full opened bridge, opened dome, lighthouse/target and full garden; camera refinements were made from these observations.
- Chrome responsive emulation at 390 × 844: observed all five focused views and settings in Russian/English. This is not a physical phone test.
- Actual WebGL_lose_context extension triggered context loss. Recovery replaced HUD and canvas accessibility; exported JSON was verified on disk with all four completed puzzles and volume 0.3. Retry restored scene and 4/4 progress.
- In the isolated test tab only, getContext was temporarily made to reject WebGL. Retry showed the full “island could not open” screen. Restoring the API recovered the scene.
- In the isolated test tab only, mill.glb fetch was rejected. Its procedural mill remained, other models loaded, a non-blocking degraded notice appeared and the 4/4 state remained accessible. A reload removed all temporary test overrides.
- Chrome Rendering emulated prefers-reduced-motion; matchMedia returned true and focused views settled without animated travel. Emulation was then removed.
- Sound was enabled by a real click; all three local Ogg files loaded with expected byte counts and no audio failure notice. English menu and volume slider rendered correctly.

## Honest limits

No physical phone test and no human headphone listening acceptance were performed. Technical audio tests and successful file loading do not establish perceived loudness, recording quality or natural phrase boundaries. See AUDIO.md for the required listening checklist. Browser frame samples are short diagnostics, not a sustained FPS guarantee. The earlier owner-supplied video is not an assistant-made recording. New published-site recording and deployment verification will be documented after they occur.

## Budget

ASSETS.md and artifacts/assets/CREDITS.md agree: seven Tripo jobs × 12.5 = 87.5 credits spent, including one rejected tree. No new generation or purchase was made for v2. Remaining allowance under the original combined 300-credit ceiling is 212.5. GitHub Pages remains the free deployment target.
