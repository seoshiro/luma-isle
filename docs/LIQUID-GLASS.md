# Liquid Glass controls

The material is limited to the overview navigation dock and its separate photo
button. Puzzle sheets, settings, entry, recovery, photo toolbar, game state and
save format keep their existing behavior and dense surfaces.

## Architecture

- `LiquidGlassNavigation.tsx` contains accessible native buttons and one moving
  indicator. The indicator is paint only: it does not introduce another optical
  layer. Icon and tooltip text remain ordinary, unfiltered DOM content.
- `glass-regions.ts` shares two measured DOM rectangles with the existing scene.
  A ResizeObserver and viewport events update geometry. There is no React render
  on each animation frame and no per-control renderer or WebGL context.
- `scene-glass.ts` first performs the original direct Three.js scene render. It
  then copies a small padded rectangle containing the two controls from the live
  framebuffer with Three r182 `copyFramebufferToTexture`. This is a same-frame
  GPU copy, not a static screenshot, DOM capture, image export or second scene.
- One scissored quad refracts only the two capsule silhouettes. A signed-distance
  profile produces a rounded 12 CSS-pixel lip, a bounded approximately 5 CSS-pixel
  displacement, and gentle softening/saturation. Pixels outside the capsules
  are discarded, leaving the original scene unchanged.
- The copied texture contains the already tone-mapped, antialiased sRGB output.
  Its `NoColorSpace` sampling and the material's `toneMapped: false`, with no
  output conversion chunks, deliberately avoid a second ACES/sRGB conversion.
  No float/HDR target or float-linear extension is needed.
- `liquid-glass.css` supplies tint, a restrained directional highlight, inner
  edge reflections and shadow. Optical paint and content are separate siblings.
  The surface wrapper has no filter, opacity or isolation backdrop root.

The normal medium/high-quality cost is one small RGBA8 framebuffer copy and one
scissored draw per visible overview frame. Texture allocation happens only when
its dimensions change. The same texture is reused for movement and lighting.
Resources and event listeners are disposed with the scene.

## Fallback and accessibility

`data-glass-mode` on each `.glass-surface` reports the actual presentation:

- `refractive`: the shared live-scene pass has successfully rendered.
- `frosted`: the pass is pending, unavailable or failed. A substantial translucent
  fill, border and optional CSS backdrop blur remain readable. If backdrop blur
  itself is unsupported, the fill is still sufficient.
- `matte`: low quality, reduced motion, increased contrast or forced colors.
  The optical regions are unregistered, no refraction draw runs, and the surface
  uses a dense fill. Low quality and reduced motion also remove elastic movement.

The pass also bypasses entry, intro, focused puzzles, photo mode and hidden tabs.
The existing PNG export renders the original scene directly and never includes
optical regions or UI. A shader/copy error disables this optional enhancement,
restores renderer state and redraws the clean scene rather than failing the game.
Context loss continues through the existing recovery flow.

All navigation buttons retain keyboard focus, native Enter/Space activation,
44-pixel minimum targets, explicit labels and `aria-current="step"`. Hover and
keyboard focus move one highlight; leaving returns it to current progress.
Morning, sunset and night have separate material/foreground palettes. Forced
colors use system colors and explicit outlines.

## Browser status and local QA

This implementation does not rely on browser support for SVG filters inside
`backdrop-filter`. That path is inconsistent across engines and Chromium
versions, so CSS syntax support is not treated as proof of rendered refraction.
The live pass uses the existing WebGL renderer and standard framebuffer copying.

Local checkpoint validation: 30/30 tests, TypeScript, production build and diff
checks passed. In Chrome 157, live refraction was observed over close-up rocks
while icons stayed sharp. Keyboard focus moved the shared highlight; its computed
filter and backdrop-filter were both `none`. Morning, sunset and night contrast
were inspected. Low quality produced matte, still controls, and the local
`?glass=fallback` check produced frosted controls.

A 320x740 responsive view had no horizontal overflow. DevTools reduced-motion
emulation switched the controls to matte/still; removing it restored refractive
surfaces and elastic motion. Temporary viewport and motion overrides were removed.
Photo mode opened and closed successfully. A real exported 1920x1080 PNG was
found on disk and visually inspected. The download-wait tool timed out even
though the file was created; export was not repeated.

Safari and Firefox were absent from the available browser/app inventory and
standard installation paths, so neither was tested. This is a local checkpoint,
not a claim that this Liquid Glass revision has been published.

Local checks:

1. Start `npm run dev`. Enter the island, inspect both controls for
   `data-glass-mode="refractive"`, and move the camera so a detailed edge passes
   behind the rounded dock lip. The live edge should bend, not the icons.
2. Check morning, sunset and night. Hover each step, leave the dock, tab across
   buttons, and activate a step with Enter/Space. Only one indicator should move.
3. Check narrow portrait/landscape viewports, resize while on the overview, and
   return repeatedly from puzzles and photo mode. No ghost optical region should
   remain after a control unmounts.
4. Low quality and reduced motion should report `matte`. Compare the scene
   outside the controls before and after: no global color/sky change is expected.
5. For a development-only fallback check, open `/?glass=fallback`. The optical
   pass stays disabled while controls remain fully functional and report
   `frosted`. This QA query is not enabled in the production build.
6. Export a postcard, test an interrupted/skip intro and recovery, and confirm
   the optical helper never changes progress or the save format.

## Design and implementation references

- [Aave Labs: Building Glass for the Web](https://aave.com/design/building-glass-for-the-web)
  explains the separation of surface and content, shared moving highlights and
  different practical rendering approaches for web content and canvas/video.
- [kube.io: Liquid Glass in the Browser](https://kube.io/blog/liquid-glass-css-svg/)
  informed the smooth rounded lip, restrained displacement and directional rim.
- [Apple WWDC25: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)
  informed the limited floating-control scope, readable foreground and adaptive
  accessibility behavior rather than applying glass to every panel.
- The exact installed Three r182 `WebGLRenderer.js` and `FramebufferTexture.js`
  implementations were checked for pixel coordinates, copy behavior, color-space
  handling and scissor units before implementation.
