# Mini Mario 3D

A minimalist 3D platformer prototype built with **Three.js** — no external physics engine.  
Demonstrates Space & Physics mechanics: gravity, AABB collision, moving platforms, coyote time, and jump buffering.

## Quick Start

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

### Build for production

```bash
npm run build
npm run preview
```

## Controls

| Key | Action |
|---|---|
| **WASD** / Arrow keys | Move (XZ plane) |
| **Space** | Jump |
| **Shift** | Run (hold) |
| **Escape** | Pause / Resume |
| **Enter** | Start game |
| **R** | Restart (after death / win) |
| **F1** | Toggle debug collision wireframes |

## Architecture

```
src/
├── main.ts                  Entry point — creates Game and starts the loop
└── game/
    ├── Config.ts            Central tunable parameters (exposed as window.__CFG)
    ├── Game.ts              Main loop, fixed-timestep accumulator, state machine
    ├── Renderer.ts          Three.js scene, camera, lights, WebGL setup
    ├── Input.ts             Keyboard state tracking with just-pressed queries
    ├── CameraRig.ts         Smooth third-person follow camera
    ├── Physics.ts           AABB types, integration, collision resolution
    ├── PlayerController.ts  Movement, jump, coyote time, jump buffer, variable jump
    ├── Level.ts             Level data definitions, mesh building, moving platforms
    ├── UI.ts                HTML overlay management (HUD, menus, overlays)
    ├── Audio.ts             Synthesized sound effects via Web Audio API
    └── Debug.ts             Toggle collision wireframe visualization
```

### State Machine

`Boot → StartScreen → Playing ⇄ Paused`  
`Playing → Dead → (restart) → Playing`  
`Playing → Won → (restart) → Playing`

### Physics Pipeline (per fixed step)

1. Move moving platforms to new position
2. Player controller: input → acceleration → integration → collision resolution
3. Carry player on moving platform (apply platform delta)
4. Check hazards / kill plane → trigger death
5. Check goal → trigger win
6. Update coins
7. Camera follow

## Tuning Parameters

All gameplay constants live in `src/game/Config.ts`.  
You can also hot-tweak at runtime via the browser console:

```js
window.__CFG.gravity = 20;
window.__CFG.jumpSpeed = 14;
window.__CFG.coyoteTime = 0.15;
```

Key parameters:

| Parameter | Default | Description |
|---|---|---|
| `moveSpeed` | 6 | Walk speed |
| `runSpeed` | 10 | Sprint speed (hold Shift) |
| `gravity` | 28 | Downward acceleration |
| `jumpSpeed` | 12 | Initial upward velocity on jump |
| `coyoteTime` | 0.1s | Grace period to jump after leaving edge |
| `jumpBuffer` | 0.1s | Pre-land jump input buffer |
| `maxFallSpeed` | 30 | Terminal velocity |
| `frictionGround` | 10 | Ground deceleration factor |
| `accelerationGround` | 30 | Ground acceleration responsiveness |
| `accelerationAir` | 12 | Air control responsiveness |

## Adding Levels

Edit `src/game/Level.ts` — the `LEVEL_1` object defines:

- `spawn`: player start position
- `platforms[]`: static boxes with position, size, color
- `movingPlatforms[]`: animated platforms with axis, amplitude, speed
- `hazards[]`: kill volumes
- `coins[]`: collectible positions
- `goal`: finish trigger

Duplicate and modify for additional levels. The `Level.load(index)` method accepts a level index.
