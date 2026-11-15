# Watercourse and mechanism support repair

The November 15, 2026 screenshot audit found an outlet water box ending at z=5.8,
although the loaded island has no terrain beneath that footprint. The decorative
pebble strip continued into the same empty space. Workshop puzzle disks had no
stationary bearing or support, and the observatory reward sat above a plain,
unsupported brown box.

## Physical corrections

- The main channel and its three short branches now have closed limestone beds
  and banks. Their undersides follow actual transformed island terrain. The
  tailrace has a water surface, without transparent rectangular side walls.
- `supportedWaterStations` in `src/water-support.ts` is the authoritative sampled
  main-channel centerline, half-width, water level and terrain-limited endpoint.
  The loaded outlet is **(-4.2, 0.105, 4.04)**. Its 728 support-corner samples have
  no missing ground; the deepest outer bank is 0.853 world units. Full-width
  cross-sections are checked every 0.12 world units before construction.
- The waterfall begins exactly at that outlet. Its trajectory is checked at
  41 heights and nine lateral probes against the entire visible cliff, including
  the procedural rock body in fallback mode. The centerline clears the foremost
  cliff by at least 0.15 before the ribbon radius is applied. Foam and spray use
  this same trajectory; no terrain raycasts occur during animation.
- The old floating pebble strip is gone. Its exact 70-call random budget remains,
  so later clouds, rocks and vegetation do not get a new random layout.
- Workshop disks and their interaction targets moved together from z=4.85 to
  z=4.1, just inside the porch rather than over the main path. A stationary wood
  rail and brass bearings connect to ray-verified porch columns at z=4.013 and
  z=4.013. Every rendered rack vertex clears the main path footprint. Disk angles,
  state transitions, replay and hitbox sizes remain unchanged.
- The brown reward cube was removed. A small brass fork is attached to the actual
  observatory wall at (0.95, 3.4, -2.902). The lens is at z=-2.742, remains clear
  of the doorway, and retains its original stage-dependent reveal.
- Lamps and pots now probe their entire actual bottom disks. Their XZ positions
  remain at the prior loaded-terrain positions. Measured terrain variation was
  up to 0.130 across a lamp foot and 0.100 across a pot foot. Small solid stone
  pads follow terrain underneath and meet the complete bottom footprint. These
  are physical geometry, not painted contact shadows or grass concealment.
- All 15 decorative rocks were separately checked using their transformed mesh
  vertices. Each already intersects the loaded terrain, with 40–63 embedded
  vertices and minimum clearance between -0.125 and -0.233. Their positions and
  shapes were left unchanged. The likely rock seen behind the shop has 51
  embedded vertices and minimum clearance -0.125.

Path foundations and channel stone use subtle, matte, world-space masonry
variation. The shader does not need UVs and does not displace geometry. The
observatory terrace material is documented separately. Bridge geometry, docks,
route layout, gameplay, save schema, audio, assets and dependencies are unchanged.

## Regression coverage

`src/mechanism-support.test.ts` covers loaded terrain support, dry-branch prism
winding, exact waterfall attachment, complete cliff clearance, gate-controlled
flow, rack/target alignment through disk rotation and replay, path clearance,
reward visibility and door clearance, full furniture foot contacts, actual solid
pads, procedural terrain/building fallback, and the UV-independent stone shader.

Final local verification: **81/81 tests passed**, TypeScript passed, and the Vite
production build completed successfully. The existing large-chunk advisory
remains; no new dependency or runtime network request was added.

Browser screenshots, lighting, mobile interaction, complete puzzle playthrough,
and publication are verified by the release owner after the final code freeze.
