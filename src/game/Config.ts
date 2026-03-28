/**
 * Central configuration — every tunable game parameter lives here.
 * Tweak values and see instant results on next reload.
 */

export const CONFIG = {
  // ── Player Movement ──
  moveSpeed: 6,
  runSpeed: 10,
  accelerationGround: 30,
  accelerationAir: 12,
  frictionGround: 10,

  // ── Gravity & Jump ──
  gravity: 28,
  jumpSpeed: 12,
  maxFallSpeed: 30,
  /** Multiply upward velocity by this when jump is released early */
  jumpCutMultiplier: 0.4,

  // ── Game-Feel Timers (seconds) ──
  coyoteTime: 0.1,
  jumpBuffer: 0.1,

  // ── Player Collider (half-extents) ──
  playerSize: { x: 0.35, y: 0.5, z: 0.35 },

  // ── Camera ──
  cameraOffset: { x: 0, y: 6, z: 10 },
  cameraLerp: 4,
  cameraLookAhead: 1.5,

  // ── Moving Platforms ──
  movingPlatformSpeed: 2,
  movingPlatformAmplitude: 4,

  // ── Physics Simulation ──
  fixedTimestep: 1 / 60,
  maxSubSteps: 5,

  // ── Death (Y threshold below which player dies) ──
  killPlaneY: -10,
} as const;

/** Mutable runtime copy so we can hot-tweak via console: `window.__CFG` */
export type GameConfig = { -readonly [K in keyof typeof CONFIG]: (typeof CONFIG)[K] };
export const cfg: GameConfig = { ...CONFIG } as GameConfig;

// Expose to dev console for quick tuning
(window as unknown as Record<string, unknown>).__CFG = cfg;
