import * as THREE from 'three';
import { cfg } from './Config';

/* ──────────────────────────────────────────────
 *  AABB type used for all collision volumes.
 *  min/max are world-space corners.
 * ────────────────────────────────────────────── */
export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface CollisionResult {
  grounded: boolean;
  /** The static collider the player is standing on (if any) */
  groundCollider: AABB | null;
  hitCeiling: boolean;
}

/* ──────────────────────────────────────────────
 *  Build an AABB centred at `pos` with the given half-extents.
 * ────────────────────────────────────────────── */
export function makeAABB(pos: THREE.Vector3, half: { x: number; y: number; z: number }): AABB {
  return {
    min: new THREE.Vector3(pos.x - half.x, pos.y - half.y, pos.z - half.z),
    max: new THREE.Vector3(pos.x + half.x, pos.y + half.y, pos.z + half.z),
  };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.z < b.max.z && a.max.z > b.min.z
  );
}

/* ──────────────────────────────────────────────
 *  Integrate velocity & position (semi-implicit Euler).
 * ────────────────────────────────────────────── */
export function integrate(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  acc: THREE.Vector3,
  dt: number,
): void {
  vel.x += acc.x * dt;
  vel.y += acc.y * dt;
  vel.z += acc.z * dt;

  // Terminal velocity clamp (downward only)
  if (vel.y < -cfg.maxFallSpeed) vel.y = -cfg.maxFallSpeed;

  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
  pos.z += vel.z * dt;
}

/* ──────────────────────────────────────────────
 *  Resolve player AABB against an array of static AABBs.
 *
 *  Strategy: for each overlapping collider, compute the
 *  penetration on every axis and push out along the axis
 *  of *minimum* penetration. This is simple and stable
 *  for axis-aligned boxes.
 * ────────────────────────────────────────────── */
export function resolveCollisions(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  halfExtents: { x: number; y: number; z: number },
  statics: AABB[],
): CollisionResult {
  let grounded = false;
  let groundCollider: AABB | null = null;
  let hitCeiling = false;

  for (const box of statics) {
    const pAABB = makeAABB(pos, halfExtents);

    if (!aabbOverlap(pAABB, box)) continue;

    // Compute overlap on each axis
    const overlapX = Math.min(pAABB.max.x - box.min.x, box.max.x - pAABB.min.x);
    const overlapY = Math.min(pAABB.max.y - box.min.y, box.max.y - pAABB.min.y);
    const overlapZ = Math.min(pAABB.max.z - box.min.z, box.max.z - pAABB.min.z);

    if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) continue;

    // Push out along the axis of minimum penetration
    if (overlapY <= overlapX && overlapY <= overlapZ) {
      // Y axis resolution
      const pushUp = (pAABB.min.y + pAABB.max.y) / 2 < (box.min.y + box.max.y) / 2 ? -overlapY : overlapY;
      pos.y += pushUp;

      if (pushUp > 0) {
        // Landed on top
        grounded = true;
        groundCollider = box;
        if (vel.y < 0) vel.y = 0;
      } else {
        // Hit ceiling
        hitCeiling = true;
        if (vel.y > 0) vel.y = 0;
      }
    } else if (overlapX <= overlapZ) {
      const pushDir = (pAABB.min.x + pAABB.max.x) / 2 < (box.min.x + box.max.x) / 2 ? -overlapX : overlapX;
      pos.x += pushDir;
      vel.x = 0;
    } else {
      const pushDir = (pAABB.min.z + pAABB.max.z) / 2 < (box.min.z + box.max.z) / 2 ? -overlapZ : overlapZ;
      pos.z += pushDir;
      vel.z = 0;
    }
  }

  return { grounded, groundCollider, hitCeiling };
}
