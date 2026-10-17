# FARSTAR

Portfolio arcade, loaded only after the hidden sequence: Up Up Down Down Left Right Left Right. The portfolio key listener loads no game code, audio, or worker before navigation.

Run `npm run dev`, then open http://127.0.0.1:4192. The root page is the arcade game selector; Space flight opens at `/space.html`. The selector loads no game engine or physics worker. Future games can be added as separate pages and linked from the menu. No dependencies or installation required. Run `npm test` for deterministic simulation checks.

## Mission

Start landed on HOME. Fly through a solar system with a central sun, planets on fixed circular orbits, and gravity affecting ships, asteroids, and projectiles. Land below 65 speed relative to the planet, hold still briefly to retrieve its technology pennant, then return it home. One cargo at a time. Deliver all three to finish. Vesper remains an unguarded planet with no retrieval objective.

- EMBER: Fusion drive, defended by three fast interceptors.
- RUST: Radiation shielding, defended by three shielded guardians. A front-facing 120-degree shield blocks shots; sides and rear are vulnerable.
- FROST: Stellar navigation, defended by three hunters that flank and predict movement.

Arrow keys or WASD to turn/thrust/brake, Space to shoot, M for a live system chart, T to cycle targets, P or Escape to pause. Mobile has touch controls. Near a planet, braking matches its orbital velocity. Home repairs the hull. A destroyed ship is rescued home and any unbanked technology returns to its original planet. Banked progress remains.

The flight manual explains all controls and defender types. The simulation pauses on loss of focus. The games synthesize optional audio locally and use no external game assets or network APIs. Its top-ten, three-letter high-score board is saved in localStorage on the current browser. It uses a seeded initial system for repeatable balancing. Graphics are original canvas vector drawings. Distances and forces are gameplay-scale, not a physical model of the real solar system.

## Gravity and trajectory

Gravity uses an experimental 1/r^1.6 falloff. Solar pull is normalized at HOME’s orbit; planet pull is normalized at the surface and fades smoothly at the edge of its local influence. Planet and asteroid orbital velocities use the same force law. The minimap simulates up to 60 seconds or one orbit of coasting with the real fixed-step gravity, moving planets, speed cap, and outer-boundary force. Prediction runs in a separate worker to avoid interrupting rendering, and moving objects are interpolated between physics steps. The minimap expands when the ship travels farther out and marks predicted impacts with a cross. It stops at the first surface encounter; future thrust, braking, and combat cannot be predicted. With this force law, trajectories need not form closed ellipses.

Saucers fire deliberately spaced shots, maintain a short standoff distance, and bounce apart on contact without counting a kill. Launch protection lasts 2.8 seconds and damage protection lasts 2.7 seconds. Saucers patrol close to their own planets, pursue within the local defense zone, and turn back at the patrol boundary. All types have classic saucer silhouettes, with red engines, a directional shield, or antenna details to distinguish them.

## Scoring

Each technology awards 1,000 on first capture (not on recapture) and 4,000 on delivery. Enemy ships award 100 when shot down; asteroid destruction awards no points. Each rescue adds 30 seconds to a separate scoring clock without advancing orbital simulation or removing points. Completing the game with no enemy kills earns a 6,000-point pacifist bonus. Final score is rounded from `(points + bonus) * difficultyMultiplier / (1 + scoringSeconds / 600)`. Scoring seconds include flight time plus rescue penalties; paused time is excluded. Easy scores ×1, Medium ×1.5, and Hard ×2.5. Medium preserves the existing combat balance; Easy has slower, less frequent shots and longer protection, while Hard has faster, more frequent shots and shorter protection. Difficulty is selected before launch and retained on restart; changing it requires a new mission. Previous scoring-version records remain stored separately. The local board stores ten valid three-letter scores, ordered by score then faster time, and reports unavailable browser storage without breaking the game.

## Files

- `physics.js`: mission state, shared flight/prediction physics, scoring, collisions, cargo and defenders.
- `scores.js`: validated local high-score storage.
- `index.html` / `arcade.css`: lightweight game selection menu.
- `space.html`: Space flight setup and play screens.
- `game.js`: canvas rendering, camera, input and accessible HTML HUD.
- `style.css` / `space.html`: interface and flight manual.
- `tests/physics.test.js`: simulation regression checks.

The deployment build copies runtime files to /arcade/ and excludes tests and research. Update runtime source from Documents/Farstar when making game changes.

## Tanks

The arcade also links to `/tanks.html`, a separate top-down tank game using the same white, black, and red palette. WASD moves, mouse aims, each left click fires one shell, and Space drops a mine. P pauses. Holding Escape for one second returns to the portfolio; a short press pauses Tanks. Touch devices have separate move and aim/fire pads.

The 100-mission campaign uses the original widescreen layout and spawn data: 30 layouts, fixed opening/milestone missions, and the documented random layout and tank-type ranges for later missions. Stationary, patrol, rocket, mine-layer, rapid-fire, warrior, sniper, stealth, and elite enemies are represented. A new run rerolls the randomized missions; retries preserve that run’s layout and enemies. The player begins with three tanks, gains one after every five completed fields, and has five simultaneous shells and two active mines. Tracks pivot before translating, can reverse without a full turn, and briefly stop while firing or laying a mine. A dotted guide shows the current turret direction. Ordinary shells travel at 226 units per second for both sides, bounce once, and cancel one another; rocket tanks fire faster non-bouncing shots while snipers calculate up to two rebounds. Pits block tanks but let shots pass. Mines arm after 0.8 seconds, give a 0.75-second proximity warning, and otherwise detonate after nine seconds; shots trigger them immediately. Blast chains destroy red-hatched cover. One hit destroys a tank. Retrying resets the field and its partial score. Enemy points scale by type: sentry 200, patrol 300, rocket 450, miner 500, hunter 650, warrior 850, sniper 1,000, stealth 1,200, elite 1,500. Player movement and ordinary shell speed are calibrated from video; AI decisions and other timings remain approximations, not an exact recreation. Patrol and basic rocket tanks wander between reachable points instead of constantly chasing the player.

`tanks-physics.js` contains the independent fixed-step simulation and field layouts; `tanks.js` renders and handles input; `tanks.css` and `tanks.html` provide the interface. `tests/tanks.test.js` checks spawning, collisions, ricochets, mines, progression, and pause behavior. Neither game engine loads from the arcade menu.

Reference pass: reviewed the opening of [WatchmeplayNintendo’s walkthrough](https://www.youtube.com/watch?v=48L9-_laUP8), plus frame sequences from Bright’s [mission 6](https://tanks.brightsoo.com/mission-6/) and [mission 13](https://tanks.brightsoo.com/mission-13/) footage. Enemy roles were cross-checked against the [enemy guide](https://tanks.brightsoo.com/enemy-tanks/). The game retains its own monochrome artwork and implementation. The current campaign replaces the early prototype layouts with the original map data.

### Campaign data provenance

`tanks-levels.js` encodes the layout, player/enemy spawn, block type/height, pit, and mission-range facts from [Kataryn’s Tanks Lookup](https://kataryn.com/tanks-lookup/) ([format description](https://kataryn.com/tanks-lookup/about.html)). The original 22×17 grid uses square tiles in a true overhead arena. Solid horizontal runs are merged for collision efficiency; individual cork cells remain destructible. The lookup’s code and image assets are not included. [Bright’s mission screenshots](https://tanks.brightsoo.com/missions/) were used for visual comparison. The original artwork and perspective are not copied: tanks and blocks are flat outlines, pits are circular, and ordinary shells have a larger 8-unit stroke.

### Timing calibration

At approximately 0:52.25–0:53.75 in the linked YouTube walkthrough, the player travels about 220 source pixels horizontally in 1.5 seconds. The reference tile pitch is about 48 pixels: 3.06 tiles/sec, or 136 units/sec in this arena. At approximately 0:15.50–0:15.75, an ordinary shell tip moves from roughly (387,411) to (443,427). Correcting the video’s foreshortened rows (about 32 pixels per tile) gives about 5.1 tiles/sec, or 226 units/sec. Values are rounded measurements, not recovered original constants. The top-down version uses square tiles, so this speed is direction-independent. Regression tests compare actual simulated displacement against these observations.

The user also checked Wii Play in Dolphin and confirmed that holding fire produces only one shell. Desktop firing is therefore press-triggered; the touch aiming pad retains repeated fire as its explicit mobile adaptation. Mine fuse, firing delays, rocket speeds, and the AI’s random decisions have not yet been frame-verified in Dolphin.

### Enemy timing pass

Reviewed the opening attacks in the YouTube walkthrough and Bright’s mission 6 footage, plus mine placement in the walkthrough’s mission 8 and Bright’s mission 13 footage. Opening attacks can occur within roughly the first second, and yellow mine layers begin placing mines about a second after play starts. The old startup formula added 0.23 seconds per enemy slot on top of 1.2 seconds, producing artificial delays in crowded missions.

`AI_TIMING` now defines seeded ranges for opening readiness, shot cooldowns, target updates, and mine placement. Opening readiness ranges from 0.25–1.2 seconds by type; alignment adds a 0.06–0.18 second settling interval. Losing a firing solution or switching to a substantially different angle resets that interval; small tracking changes retain it. Regular firing intervals vary within bounds rather than following a metronome. Mine layers begin after 0.65–1.4 seconds and wait 1.8–3.2 seconds between placements when capacity permits. The same seed and input sequence reproduce the timing, and retry resets the random stream.

These ranges are observation-informed tuning, not exact extracted constants. Later enemy types retain conservative variations around the prior cadence; their precise reaction times have not been independently measured. Projectile travel and the original per-type ammunition caps still limit actual firing frequency. Tests cover the acquisition pause, loss of target, varied firing cadence, seed reproducibility, and mine-layer startup.

### Adaptive tank music

The footer **Unmute music** button starts locally synthesized audio; each page starts muted. Music pauses with the game/background tab. No audio downloads or external playback dependencies.

The melody is **The British Grenadiers**, a traditional public-domain march ([public-domain score](https://hymnary.org/media/fetch/215530)); melody notes were checked against [John Chambers' G-major transcription](https://abcnotation.com/tunePage?a=trillian.mit.edu/~jc/music/abc/England/march/British_Grenadiers_16G/0000). The instrumentation, accompaniment, synthesis, and short event cues are new. No Nintendo recording or modern commercial recording is used.

Instrument activation matches every row of the [documented original game's audio table](https://nintendo.fandom.com/wiki/Tanks!#Audio): highest surviving musical rank plus total surviving enemy count; rank order is brown, gray, teal, pink, yellow, purple, green, white, black. Two piccolos carry the melody. Timpani A/B are mutually exclusive. White supersedes bells with synth, and black keeps its full mix without snare regardless of count. The reference table is preserved in `research/music-rules.json`; 72 mixed/same-type rank/count cases and a destruction sequence are tested against it. Changes fade over 12 ms without resetting the musical clock. Instrument-selection rules match the published table, not a reverse-engineered original implementation; note patterns, tempo, synthesis, cue duration, and fade time are our arrangement.

Mission-ready announcement uses two trumpet voices; begin uses snare; kills/extra lives use trumpet; loss uses two piccolos and bell; clear uses two piccolos, with tuba/cymbals/bass drum/snare for missions 20/100. Run-over/final results use piccolos, tuba, snare, and metronome. The existing game's screens determine when those cues play.

### Layer preview and basic-enemy review

Open `music-layers.html` for the live arrangement: individual mute/solo, volume, a tour through all ten parts, a sixteen-bar activity chart, and tank-rank/count presets. It runs the same `TankMusic` sequencer as the game; switching parts preserves the clock. Timpani variants are alternatives. Playback stops when the preview is hidden.

The gray patrol previously used exhaustive wall-reflection targeting and instant per-frame projectile evasion. It now takes direct visible shots, samples targeting every 0.55–0.85 seconds, settles for 0.28 seconds, and uses the basic sentry's 2.1–3 second firing interval. Basic gray/teal turrets turn at 1.65 rad/s and retain their last sampled aim while the player is hidden. Their evasion samples visible nearby threats every 0.18–0.28 seconds; teal ignores reflected shots, and neither detects player mines. Movement/shell speeds and random patrol destinations are unchanged. Advanced enemies retain their existing behavior.

These are explicit tuning choices informed by the [original-game enemy observations](https://tanks.brightsoo.com/enemy-tanks/), [contemporary gameplay guide](https://gamefaqs.gamespot.com/wii/935589-wii-play/faqs/46247), and mission 2/3 footage from the previously referenced walkthrough, not verified original AI constants. Sources disagree on exact gray movement speed; this pass changes decision-making, not track speed. A simple no-fire up/down survival comparison over 20 seeds did not improve uniformly across missions 2–4, so it is not evidence of an exact difficulty match.

Mission 1's full-width row-12 wall is its smaller tutorial arena boundary (visible above the tutorial banner in original footage). The view now ends there, omitting the unused area behind it; the collision wall and mission-100 layout remain intact. A player shot from approximately `(123,400)` can bounce off that boundary and destroy the first enemy. It is obstructed by the left-hand cover from the exact spawn point. Verified with a live projectile test and mouse-controlled browser play. No extra ricochet allowance was added.

### Space soundtrack

The space game's footer has a separate **Unmute music** toggle. `space-music.js` generates an original, quiet ambient score locally: eight slow suspended/add-note chords, sparse sine-bell notes, gentle stereo spread, and a low-pass echo. No licensed recordings or external audio downloads. It begins muted on each page load, pauses with flight hold/manual/scores or a hidden tab, and cleans up scheduled voices on mute/page exit. Audio scheduling is separate from flight physics; cached timers do not accumulate on repeated toggles. Browser checks cover real audio output, mute, pause/resume, and mobile control visibility in Chromium and WebKit.

### Light sound effects

Both games have an independent **Unmute effects** toggle, initially muted. Shared `sound-effects.js` synthesizes quiet cues: tank shells/ricochets/impacts/mines/treads; space lasers/thrust/damage/docking/cargo/ship destruction. Enemy weapons are quieter than the player's. Effects use short envelopes, per-kind rate limits, an eight-voice cap, and pause/visibility cleanup. The render layer observes simulation objects and state without changing physics or consuming gameplay events. Chromium/WebKit checks verify actual weapon triggers, low-level audio output, music-independent toggling, cleanup, and 390/650/768px layouts.

### Tank leaderboard

The panel's High scores button opens a separate top-ten local tank board. Run-over and campaign-complete screens accept three-letter initials once per run; entries include score, field reached, and an all-clear marker. Storage is validated and failures leave the form available to retry. Tanks use their own storage key, leaving space scores untouched. Chrome/WebKit checks cover save, reload, restart, duplicate prevention, completion, and mobile layout.

Thrust effects use a quiet high-passed white-noise hiss (180 Hz cutoff), replacing the earlier low-pass rumble.

### Drag audio volume

Music and effect buttons in both games share `audio-controls.js`. Click toggles mute; a vertical drag changes independent volume (150px across the full range) with a floating percentage. Drag release does not toggle playback. Focused buttons also support Up/Down in 5% steps. Effects retain their quieter gain range. Settings survive mute/unmute within the page. Chromium/WebKit checks cover both buttons in both games, click/drag distinction, keyboard changes, and independent levels.

Scoring calibration: Tanks totals 8,900 after mission 8 and 11,100 after mission 9 (first-pass benchmark, not measured player averages). Space grants 1,000 per first pickup, 4,000 per delivery, 100 per kill, and a 6,000 completion-only pacifist bonus; final points use difficulty / (1 + scoring seconds / 600). A 12-minute Medium completion with four kills earns 10,500; a ten-minute Easy pacifist completion earns 10,500. Rescue penalties and anti-farming remain unchanged. Both boards use v2 storage keys; old records remain stored under v1 but are not mixed with the new scale.

Easy landing assist: safe contact up to 105 relative speed (Medium/Hard remain 65); local brake damping 3.8/s rather than 2.3/s within 520 units of a planet surface. Braking away from planets is unchanged. The approach meter uses the active difficulty threshold.
