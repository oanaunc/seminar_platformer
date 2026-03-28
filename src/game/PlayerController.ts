import * as THREE from 'three';
import { cfg } from './Config';
import { Input } from './Input';
import { AABB, integrate, resolveCollisions } from './Physics';

/**
 * 2D Character controller with side-view animated character.
 * Handles movement, physics, and procedural animation.
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
  private animTime = 0;
  private isMoving = false;

  mesh!: THREE.Group;

  // Animated parts (set by buildPlayerMesh in Level)
  legBack!: THREE.Object3D;
  legFront!: THREE.Object3D;
  armBack!: THREE.Object3D;
  armFront!: THREE.Object3D;
  bodyGroup!: THREE.Group;
  eyePupil!: THREE.Object3D;

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
    this.animTime = 0;
    this.isMoving = false;
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

    if (moveX > 0) this.facingRight = true;
    else if (moveX < 0) this.facingRight = false;

    this.isMoving = Math.abs(this.velocity.x) > 0.5;

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

    if (this.jumpHeldThisJump && input.jumpReleased && this.velocity.y > 0) {
      this.velocity.y *= cfg.jumpCutMultiplier;
      this.jumpHeldThisJump = false;
    }
    if (!input.jumpHeld) this.jumpHeldThisJump = false;

    // ── Gravity + integrate ──
    const acc = new THREE.Vector3(0, -cfg.gravity, 0);
    integrate(this.position, this.velocity, acc, dt);

    this.position.z = 0;
    this.velocity.z = 0;

    // ── Collision ──
    const result = resolveCollisions(this.position, this.velocity, cfg.playerSize, statics);
    this.grounded = result.grounded;
    this.groundCollider = result.groundCollider;

    // ── Animation ──
    this.animTime += dt;
    this.animate(dt);
  }

  /** Procedural animation: walk cycle, idle breathing, jump squash/stretch. */
  private animate(_dt: number): void {
    if (!this.mesh) return;

    this.mesh.position.set(this.position.x, this.position.y, 1);
    this.mesh.scale.x = this.facingRight ? 1 : -1;

    const runMult = Math.abs(this.velocity.x) > cfg.moveSpeed + 1 ? 1.4 : 1;

    if (!this.grounded) {
      // ── In-air pose ──
      // Squash/stretch based on vertical velocity
      const vyNorm = Math.max(-1, Math.min(1, this.velocity.y / cfg.jumpSpeed));
      const stretchY = 1 + vyNorm * 0.12;
      const squashX = 1 - vyNorm * 0.08;
      this.bodyGroup.scale.set(squashX, stretchY, 1);

      // Legs tucked when rising, extended when falling
      const legAngle = vyNorm > 0 ? 0.4 : -0.2;
      this.legBack.rotation.z = legAngle;
      this.legFront.rotation.z = -legAngle * 0.5;

      // Arms up when rising
      this.armBack.rotation.z = vyNorm > 0 ? 0.5 : -0.15;
      this.armFront.rotation.z = vyNorm > 0 ? -0.3 : 0.1;

    } else if (this.isMoving) {
      // ── Walk / run cycle ──
      const freq = 10 * runMult;
      const t = this.animTime * freq;
      const legSwing = Math.sin(t) * 0.5 * runMult;

      this.bodyGroup.scale.set(1, 1, 1);
      // Body bob
      this.bodyGroup.position.y = Math.abs(Math.sin(t)) * 0.04;

      // Legs swing opposite to each other (pivoting from hip)
      this.legBack.rotation.z = legSwing;
      this.legFront.rotation.z = -legSwing;

      // Arms swing opposite to legs
      this.armBack.rotation.z = -legSwing * 0.6;
      this.armFront.rotation.z = legSwing * 0.6;

    } else {
      // ── Idle breathing ──
      const t = this.animTime * 2;
      const breathe = Math.sin(t) * 0.02;

      this.bodyGroup.scale.set(1 - breathe, 1 + breathe, 1);
      this.bodyGroup.position.y = 0;

      this.legBack.rotation.z = 0;
      this.legFront.rotation.z = 0;
      this.armBack.rotation.z = Math.sin(t) * 0.05;
      this.armFront.rotation.z = -Math.sin(t) * 0.05;
    }

    // Eye tracking: pupil shifts in facing direction
    if (this.eyePupil) {
      this.eyePupil.position.x = 0.03;
    }
  }
}
