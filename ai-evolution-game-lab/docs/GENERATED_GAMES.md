# Anatomy of a generated project

```
index.html            canvas + UI root, scripts in dependency order, inline favicon
styles/main.css       design tokens from the palette, safe-area insets, coarse-pointer controls
manifest.json         design, traits, parameters + their sources, knowledge used, novelty, provenance
README.md             how to play, what the design is, where every number came from
src/engine/core.js        loop (fixed-step or clamped delta), state machine, seeded RNG, events
src/engine/math.js        vectors, easing, overlap tests, uniform-grid broadphase
src/engine/input.js       action mapping, edge detection, input buffering, touch stick, gamepad
src/engine/entities.js    entity store with tag queries and pooling
src/engine/physics.js     ONE integrator, chosen by the design (top-down / platformer / vehicle / grid / 3D)
src/engine/collision.js   broadphase + narrowphase + swept test + axis-separated rect resolution
src/engine/camera.js      follow / deadzone / side-scroll / rotating chase / isometric
src/engine/ai.js          seek, flee, stand-off, wander, patrol + vision cones, A* on a grid
src/engine/procgen.js     value noise, maze, BSP rooms, race track, platform layout, reachability
src/engine/particles.js   pooled particles
src/engine/render.js      DPR-aware renderer, shape vocabulary, light mask, vignette
src/engine/ui.js          DOM HUD, overlays, toasts, touch controls
src/engine/audio.js       procedural WebAudio cues (no audio files, no licences to worry about)
src/engine/save.js        versioned localStorage with migration and failure tolerance
src/engine/three.js       (3D builds only) three.js + GLTFLoader bootstrap with an honest failure path
src/game/config.js        every tuned number in one place
src/game/world.js         world/level construction for this design
src/game/rules.js         the actual gameplay rules for this ruleset
src/game/main.js          wiring, screens, loop, and the test surface
```

## The eight rulesets

| ruleset | what makes it different |
|---|---|
| `arena` | waves, enemy behaviours (chase / stand-off + fire / patrol+vision / spawner nests), pickups, core defence |
| `platformer` | gravity, coyote time, jump buffering, jump-cut, stomp, procedurally validated platform course |
| `puzzle` | sokoban generated **backwards** from a solved state, undo history, per-level progression |
| `racer` | smoothed closed circuit, ordered checkpoints, drift model (split forward/lateral grip), rival AI on the racing line |
| `defense` | generated creep path, buildable cells, tower targeting the leader, economy and upgrades |
| `runner` | chunk streaming with culling, speed ramp, near-miss detection feeding the combo |
| `stealth` | vision cones blocked by walls, detection meter, patrol routes, exit proven reachable by flood fill |
| `explorer3d` | three.js scene, kinematic 3D controller, GLB loading with generated placeholders |

## Modifiers (the novelty lever)

Each is implemented as a real mechanic, not flavour text:
`gravity-flip` · `time-dilation` · `shrinking-arena` · `resource-decay` ·
`one-hit-fragile` · `light-radius` · `combo-chain` · `terrain-mutation` ·
`echo-replay` · `charge-release` · `rhythm-window`

## Guarantees the generator enforces

- **Solvable puzzles** — reverse generation from a solved board.
- **Traversable platform courses** — gaps generated inside the jump envelope implied
  by the tuned gravity/jump values, then validated; a fallback layout if validation fails.
- **Reachable exits** — stealth exits are placed only on tiles a flood fill proved reachable.
- **Readable colours** — WCAG contrast pass (text 7:1, gameplay 3.5:1) before emission.
- **No bundled third-party assets** — all art and audio are produced at runtime from code.
- **Originality check** — token-shingle overlap against the imported corpus, recorded in
  `manifest.json` and rejected above 15%.

## The test surface

```js
window.__LAB__ = {
  press(action), release(action), pointerTo(x, y), start(),
  snapshot()  // { state, status, score, frame, fps, entities, entityStats,
              //   particles, drawCalls, collisionChecks, player, hud }
}
```
