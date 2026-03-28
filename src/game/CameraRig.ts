import * as THREE from 'three';
import { cfg } from './Config';

/**
 * Third-person follow camera with smooth damping.
 */
export class CameraRig {
  private targetPos = new THREE.Vector3();

  update(camera: THREE.PerspectiveCamera, playerPos: THREE.Vector3, playerVelX: number, dt: number): void {
    // Look-ahead offset based on horizontal movement direction
    const lookAhead = playerVelX * cfg.cameraLookAhead * 0.1;

    this.targetPos.set(
      playerPos.x + cfg.cameraOffset.x + lookAhead,
      playerPos.y + cfg.cameraOffset.y,
      playerPos.z + cfg.cameraOffset.z,
    );

    // Smooth follow via exponential lerp
    const t = 1 - Math.exp(-cfg.cameraLerp * dt);
    camera.position.lerp(this.targetPos, t);

    // Always look at a point slightly above the player
    camera.lookAt(playerPos.x, playerPos.y + 1, playerPos.z);
  }
}
