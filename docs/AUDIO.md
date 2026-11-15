# LUMA ISLE recorded soundscape

No paid generations or audio purchases were used. Sound defaults off, volume defaults to 0.3. Existing version 1 saves missing only volume receive 0.3. Invalid values, additional settings and unknown save versions remain rejected.

## Integration

`useIslandAudio({ enabled, volume, stage, lighting, reducedMotion, sceneAvailable })` returns `{ unlockAudioFromGesture, audioError }`. Call unlock synchronously in the enable-sound click handler, before dispatching enabled=true. For a restored enabled preference, call it from a subsequent genuine pointer/key gesture. Merely restoring a save, mounting or fetching never creates an AudioContext. Surface audioError for failed decoding/fetches. Setting sound off closes the context. After interruption or reduced-motion/scene unavailability closes it, a fresh gesture is required.

Every source routes through its envelope and the same master gain. Morning has five different recorded excerpts (1–4.4, 7–10.8, 13–16.3, 19–23.1, 25–28.6 seconds), varying level, no immediately repeated excerpt, 6–18 seconds between starts, no overlapping bird phrases. Sunset/night have no birds and quieter nature. Hidden tabs stop sources/timers and suspend the context. Disable/unmount/context loss abort pending fetches, invalidate asynchronous decoding, stop sources/timers, disconnect nodes and close the context. Reduced-motion and unavailable scenes are silent. Recorded ambience gets a 400ms seam fade; it is not a generated noise oscillator.

## Provenance and permission

All bundled files are unmodified downloaded Ogg originals. Excerpts, gain envelopes and loop fades are applied at playback. Each source's own file page explicitly supplies CC0 for the audio itself (not merely the Commons metadata).

- `public/audio/huamei.ogg`: **Huamei June 4 1053 AM 2025**, Jidanni, recorded 4 June 2025, own work published by the copyright holder, CC0 1.0. [Primary file page and license](https://commons.wikimedia.org/wiki/File:Huamei_June_4_1053_AM_2025.ogg), [pinned page revision](https://commons.wikimedia.org/w/index.php?title=File:Huamei_June_4_1053_AM_2025.ogg&oldid=1053403020), [original audio](https://upload.wikimedia.org/wikipedia/commons/3/37/Huamei_June_4_1053_AM_2025.ogg).
- `public/audio/swale.ogg`: **Swale**, Siddharth Patil (Ksd5 / Sidpatil), recorded 27 February 2011, own work, CC0 1.0. [Primary file page and license](https://commons.wikimedia.org/wiki/File:Swale.ogg), [pinned revision](https://commons.wikimedia.org/w/index.php?title=File:Swale.ogg&oldid=1228133884), [original audio](https://upload.wikimedia.org/wikipedia/commons/8/84/Swale.ogg).
- `public/audio/wind.ogg`: **Howling wind**, Tvabutzku1234, 2011, own work published by the copyright holder, CC0 1.0. [Primary file page and license](https://commons.wikimedia.org/wiki/File:Howling_wind.ogg), [pinned revision](https://commons.wikimedia.org/w/index.php?title=File:Howling_wind.ogg&oldid=508965737), [original audio](https://upload.wikimedia.org/wikipedia/commons/2/2d/Howling_wind.ogg). This is recorded wind in a building, mixed very quietly, not a claim of an outdoor island recording.

License: https://creativecommons.org/publicdomain/zero/1.0/ . Attribution retained voluntarily. Source/license pages checked 15 November 2026.

Downloaded original SHA-256 checksums:
- huamei.ogg, 264824 bytes: `cadc0710ac1eed4022e897a10c9c2a5abffb002f05f5de60ff90f10a15cd9549`
- swale.ogg, 1092440 bytes: `b71def4798508e588229a5f801fefaed9ac51c5dbad224274123c92e6d183fff`
- wind.ogg, 1112243 bytes: `cc585200603027ca808ab68ab4b381d1a828c55d58f010222f5ff687929d084d`

## Verification boundary

Automated policy/migration tests are not a listening review. No claim is made that a person wore headphones or that an assistant physically listened. The five excerpt windows are implemented and technically bounded, but musical phrase boundaries, loudness comfort, recording noise and ambience balance still require real human headphone review. Do not mark that user acceptance criterion passed based on AudioContext state or a waveform alone. A reviewer should listen for at least 2 minutes in morning, switch sunset/night, change volume, hide/restore the tab, disable/re-enable and test reduced motion; confirm silence and lack of clicks/overlap. The natural source identity is supported by the recorder's primary page, not by a fabricated auditory observation.

Tests: `node node_modules/tsx/dist/cli.mjs --test src/game.test.ts src/audio-policy.test.ts`.
