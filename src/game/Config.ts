/**
 * Central configuration — every tunable game parameter lives here.
 * 2D side-scroller version: player moves on X/Y only.
 */

export const CONFIG = {
  // ── Player Movement (horizontal only) ──
  moveSpeed: 7,
  runSpeed: 11,
  accelerationGround: 35,
  accelerationAir: 14,
  frictionGround: 12,

  // ── Gravity & Jump ──
  gravity: 32,
  jumpSpeed: 13.5,
  maxFallSpeed: 28,
  jumpCutMultiplier: 0.4,

  // ── Game-Feel Timers (seconds) ──
  coyoteTime: 0.1,
  jumpBuffer: 0.1,

  // ── Player Collider (half-extents, Z kept thin for 2D) ──
  playerSize: { x: 0.35, y: 0.5, z: 0.5 },

  // ── Camera (orthographic) ──
  cameraViewHeight: 14,
  cameraLerp: 5,
  cameraLookAheadX: 2.5,
  cameraLookAheadY: 1.0,
  /** Camera won't go below this Y */
  cameraMinY: 5,

  // ── Moving Platforms ──
  movingPlatformSpeed: 2,
  movingPlatformAmplitude: 3,

  // ── Physics Simulation ──
  fixedTimestep: 1 / 60,
  maxSubSteps: 5,

  // ── Death ──
  killPlaneY: -8,

  // ── Farm Palette ──
  colors: {
    sky: 0x7ec8e3,
    grassTop: 0x5cb338,
    dirt: 0x8b6914,
    dirtDark: 0x6b4f12,
    stone: 0x5a5a6a,
    stoneDark: 0x3d3d4d,
    wood: 0xa0724a,
    woodDark: 0x7a5232,
    water: 0x3a8fd4,
    hazardRed: 0xcc3333,
    coinGold: 0xffd700,
    goalGreen: 0x33cc55,
    hillFar: 0x6ab04c,
    hillNear: 0x4a9a3a,
    cloud: 0xffffff,
    fenceWood: 0xc49a6c,
    treeTrunk: 0x7a5232,
    treeLeaves: 0x2d8a4e,
    treeLeavesBright: 0x4caf50,
  },
} as const;

export type GameConfig = { -readonly [K in keyof typeof CONFIG]: (typeof CONFIG)[K] };
export const cfg: GameConfig = { ...CONFIG } as GameConfig;

(window as unknown as Record<string, unknown>).__CFG = cfg;
