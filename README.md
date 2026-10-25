# Russell’s Ragdoll Lab

A local physics playground with a procedural sci-fi chamber, humanoid robots assembled from separate 2D parts, machined props, luminous particles, and three arena palettes. All game assets run locally; no packages or external services are required.

## Play

Run `python3 -m http.server 8000 --bind 127.0.0.1` in this directory and open http://127.0.0.1:8000/.

Pick a tool from the hotbar under the arena: its tabs group tools into Hands, Weapons, Hazards and Disasters, and number keys pick a slot in the open group. **Robots** (or **K**) opens a panel for robot count, spawning, behavior and fight mode; number keys pick a behavior while it is open. The gear button holds gravity, graphics and fullscreen, and the top bar switches arenas. **Space** pauses, **R** resets, **Esc** closes panels, and the **¼×** button enables slow motion. Super Ragdoll uses the arrow keys. **Fire** starts a six-second ground fire at the last horizontal pointer position. Nearby robots take heat damage. Explosions leave brief decorative flames; bombs emit fuse smoke and sparks.

The renderer uses Canvas 2D with procedural materials, a simple dark backdrop, bloom-style particles, and high-density canvas rendering. Physics runs at 60 fixed steps per second, independent of display refresh rate; timers follow pause and slow motion. Resizing the arena rebuilds its contents.

## Files

- `app.js`: simulation, interactions, and fixed-step clock.
- `renderer.js`: procedural graphics and playback/environment controls.
- `particles.js`: fire emitters, smoke, sparks, embers, and particle rendering. High quality caps particles at 1,400; Performance caps them at 450.
- `styles.css`, `index.html`: responsive game interface.
- `backups/`: original game files before this rebuild.

## Verification

Run `node tests/smoke.cjs` to check timing, pause, slow motion, hazards, all tools, graphics modes, and reset with a mock canvas. Visual rendering and UI controls also require browser review.

The Total Damage metric is an arcade repair bill, priced at $2,500 per actual HP lost by robots and damageable arena objects. Excess damage to depleted parts is not charged. Healing does not refund the bill. Resetting or resizing the arena clears it.
