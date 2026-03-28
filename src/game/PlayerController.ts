import * as THREE from 'three';
import { cfg } from './Config';
import { Input } from './Input';
import { AABB, integrate, resolveCollisions } from './Physics';

/**
 * Character controller: reads input, applies movement physics,
 * handles jumping with coyote time & jump buffer, and resolves collisions.
 */
export class PlayerController {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();

  grounded = false;
  /** Reference to the collider the player is standing on (for moving platform carry). */
  groundCollider: AABB | null = null;

  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private wasGrounded = false;
  private jumpHeldThisJump = false;

  /** Visual mesh group — set externally by Level. */
  mesh!: THREE.Group;

  reset(spawn: THREE.Vector3): void {
    this.position.copy(spawn);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.groundCollider = null;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.wasGrounded = false;
    this.jumpHeldThisJump = false;
  }

  update(input: Input, statics: AABB[], dt: number): void {
    // ── 1. Compute desired horizontal acceleration from input ──
    let moveX = 0;
    let moveZ = 0;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;
    if (input.forward) moveZ -= 1;
    if (input.backward) moveZ += 1;

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) { moveX /= len; moveZ /= len; }

    const speed = input.run ? cfg.runSpeed : cfg.moveSpeed;
    const accel = this.grounded ? cfg.accelerationGround : cfg.accelerationAir;

    const targetVx = moveX * speed;
    const targetVz = moveZ * speed;

    // Accelerate toward target velocity
    this.velocity.x += (targetVx - this.velocity.x) * Math.min(accel * dt, 1);
    this.velocity.z += (targetVz - this.velocity.z) * Math.min(accel * dt, 1);

    // Ground friction (only when no input)
    if (this.grounded && len === 0) {
      const friction = Math.min(cfg.frictionGround * dt, 1);
      this.velocity.x *= (1 - friction);
      this.velocity.z *= (1 - friction);
    }

    // ── 2. Coyote time: allow jumping shortly after walking off a ledge ──
    if (this.grounded) {
      this.coyoteTimer = cfg.coyoteTime;
    } else {
      this.coyoteTimer -= dt;
    }

    // ── 3. Jump buffer: remember jump press for a short window ──
    if (input.jump) {
      this.jumpBufferTimer = cfg.jumpBuffer;
    } else {
      this.jumpBufferTimer -= dt;
    }

    // ── 4. Jump execution ──
    const canJump = this.coyoteTimer > 0;
    if (canJump && this.jumpBufferTimer > 0) {
      this.velocity.y = cfg.jumpSpeed;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.grounded = false;
      this.jumpHeldThisJump = true;
    }

    // Variable jump height: cut upward velocity when releasing jump early
    if (this.jumpHeldThisJump && input.jumpReleased && this.velocity.y > 0) {
      this.velocity.y *= cfg.jumpCutMultiplier;
      this.jumpHeldThisJump = false;
    }
    if (!input.jumpHeld) {
      this.jumpHeldThisJump = false;
    }

    // ── 5. Gravity ──
    const acc = new THREE.Vector3(0, -cfg.gravity, 0);

    // ── 6. Integrate ──
    integrate(this.position, this.velocity, acc, dt);

    // ── 7. Collision resolution ──
    this.wasGrounded = this.grounded;
    const result = resolveCollisions(this.position, this.velocity, cfg.playerSize, statics);
    this.grounded = result.grounded;
    this.groundCollider = result.groundCollider;

    // ── 8. Sync visual mesh ──
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      // Rotate to face movement direction
      if (len > 0) {
        const angle = Math.atan2(moveX, moveZ);
        this.mesh.rotation.y = angle;
      }
    }
  }
}
