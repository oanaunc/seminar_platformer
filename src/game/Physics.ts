import * as THREE from 'three';
import { cfg } from './Config';

/**
 * AABB collision for 2D side-scroller.
 * We still use 3D vectors but Z is locked; collision only checks X and Y.
 */

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface CollisionResult {
  grounded: boolean;
  groundCollider: AABB | null;
  hitCeiling: boolean;
}

export function makeAABB(pos: THREE.Vector3, half: { x: number; y: number; z: number }): AABB {
  return {
    min: new THREE.Vector3(pos.x - half.x, pos.y - half.y, pos.z - half.z),
    max: new THREE.Vector3(pos.x + half.x, pos.y + half.y, pos.z + half.z),
  };
}

/** 2D overlap check — ignores Z axis. */
export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y
  );
}

export function integrate(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  acc: THREE.Vector3,
  dt: number,
): void {
  vel.x += acc.x * dt;
  vel.y += acc.y * dt;
  // Z is locked for 2D

  if (vel.y < -cfg.maxFallSpeed) vel.y = -cfg.maxFallSpeed;

  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
}

/**
 * Resolve player vs. static colliders on X and Y only.
 * Minimum-penetration-axis push-out.
 */
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

    const overlapX = Math.min(pAABB.max.x - box.min.x, box.max.x - pAABB.min.x);
    const overlapY = Math.min(pAABB.max.y - box.min.y, box.max.y - pAABB.min.y);

    if (overlapX <= 0 || overlapY <= 0) continue;

    if (overlapY <= overlapX) {
      const playerCenterY = (pAABB.min.y + pAABB.max.y) / 2;
      const boxCenterY = (box.min.y + box.max.y) / 2;
      const pushUp = playerCenterY < boxCenterY ? -overlapY : overlapY;
      pos.y += pushUp;

      if (pushUp > 0) {
        grounded = true;
        groundCollider = box;
        if (vel.y < 0) vel.y = 0;
      } else {
        hitCeiling = true;
        if (vel.y > 0) vel.y = 0;
      }
    } else {
      const playerCenterX = (pAABB.min.x + pAABB.max.x) / 2;
      const boxCenterX = (box.min.x + box.max.x) / 2;
      const pushDir = playerCenterX < boxCenterX ? -overlapX : overlapX;
      pos.x += pushDir;
      vel.x = 0;
    }
  }

  return { grounded, groundCollider, hitCeiling };
}
