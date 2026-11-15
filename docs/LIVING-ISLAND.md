# Living island and interface update

This update continues the existing island. The four mechanisms and their order
remain unchanged; the new discoveries are optional.

## New details

- One planted little guardian beside the workshop, with a quiet breathing/head
  response, small ears, hoof contacts and a sage scarf. This is a deliberately
  local character, not a walking or pathfinding character.
- A paper boat follows the actual stone-lined stream and a narrow bypass around
  the waterwheel. It passes under the existing path and fades into the spray at
  the existing outlet. The original wheel flume is retained.
- Independent water ripples, a suspended garden chime with strings and temporary
  fireflies, landing visitors from the existing bird population, and a small
  rear-cliff door.
- A workshop shelf, mug, rolled plan and tools; a roof-mounted pig weather vane;
  one tree-mounted birdhouse; restrained moss, mushrooms and footprints.
- Shared wind drives meadow motion, the chime and the vane. No extra WebGL
  renderer, animation loop, remote service or generation request is added.

## Interaction and recovery

The scene is authoritative for action availability and cooldowns. The existing
zone panel provides keyboard controls, including a separate water-ripple control.
Unsupported optional geometry does not produce a permanently disabled control.
Photo mode, introduction, recovery and modal settings block scene actions.

The optional door discovery is saved as `secretFound`. Previous version-1 saves
remain readable, including older saves without an explicit volume setting.
Imports and resets clear transient action states even when the puzzle stage
does not change. The door is not a fifth puzzle.

Sound remains off by default and uses the existing master volume, gesture
unlock and hidden-tab policy. New pig/chime cues are original local synthesized
audio; no third-party recording or paid asset was added. Reduced motion avoids
accelerated flights and large animations.

## Interface

Manrope with Cyrillic and Latin support is bundled locally under SIL OFL 1.1.
The wordmark has no green badge. A restrained translucent blue-grey title and
fine underline replace it. Large panels remain dense and readable; existing
Liquid Glass navigation and photo controls are preserved.

Settings are grouped into atmosphere, display and journey sections. Selected
choices have explicit accessible state; touch controls are at least 44 CSS px.
The settings body scrolls independently while close and save/reset controls
remain reachable. All labels and functions are available in Russian and English.
See ASSETS.md for the font source and exact file hash.

## Costs and limitations

This update uses zero additional Higgsfield credits and no paid hosting,
purchases or subscriptions. The previous generation ledger remains 87.5 credits.
New generation credit expenditure requires a separately specified budget.

Implementation tests do not substitute for visual review, subjective listening,
recorded motion or a physical-device check. See the release QA report for the
checks actually performed and any unavailable environments.
