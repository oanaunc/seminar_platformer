import * as THREE from 'three';
import { cfg } from './Config';
import { Input } from './Input';
import { AABB, integrate, resolveCollisions } from './Physics';

/**
 * 2D Character controller: left/right + jump only.
 * Z position is always 0.
 */
export class PlayerController {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();

  grounded = false;
  groundCollider: AABB | null = null;
  facingRight = true;

  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private jumpHeldThisJump = false;

  mesh!: THREE.Group;

  reset(spawn: THREE.Vector3): void {
    this.position.copy(spawn);
    this.position.z = 0;
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.groundCollider = null;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpHeldThisJump = false;
    this.facingRight = true;
  }

  update(input: Input, statics: AABB[], dt: number): void {
    // ── Horizontal input ──
    let moveX = 0;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    const speed = input.run ? cfg.runSpeed : cfg.moveSpeed;
    const accel = this.grounded ? cfg.accelerationGround : cfg.accelerationAir;
    const targetVx = moveX * speed;

    this.velocity.x += (targetVx - this.velocity.x) * Math.min(accel * dt, 1);

    if (this.grounded && moveX === 0) {
      const friction = Math.min(cfg.frictionGround * dt, 1);
      this.velocity.x *= (1 - friction);
    }

    // Track facing direction for sprite flip
    if (moveX > 0) this.facingRight = true;
    else if (moveX < 0) this.facingRight = false;

    // ── Coyote time ──
    if (this.grounded) {
      this.coyoteTimer = cfg.coyoteTime;
    } else {
      this.coyoteTimer -= dt;
    }

    // ── Jump buffer ──
    if (input.jump) {
      this.jumpBufferTimer = cfg.jumpBuffer;
    } else {
      this.jumpBufferTimer -= dt;
    }

    // ── Jump execution ──
    if (this.coyoteTimer > 0 && this.jumpBufferTimer > 0) {
      this.velocity.y = cfg.jumpSpeed;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.grounded = false;
      this.jumpHeldThisJump = true;
    }

    // Variable jump height
    if (this.jumpHeldThisJump && input.jumpReleased && this.velocity.y > 0) {
      this.velocity.y *= cfg.jumpCutMultiplier;
      this.jumpHeldThisJump = false;
    }
    if (!input.jumpHeld) this.jumpHeldThisJump = false;

    // ── Gravity + integrate ──
    const acc = new THREE.Vector3(0, -cfg.gravity, 0);
    integrate(this.position, this.velocity, acc, dt);

    // Lock Z to 0
    this.position.z = 0;
    this.velocity.z = 0;

    // ── Collision ──
    const result = resolveCollisions(this.position, this.velocity, cfg.playerSize, statics);
    this.grounded = result.grounded;
    this.groundCollider = result.groundCollider;

    // ── Sync visual mesh ──
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, 1); // Z=1 so player is in front
      this.mesh.scale.x = this.facingRight ? 1 : -1;
    }
  }
}
