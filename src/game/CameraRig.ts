import * as THREE from 'three';
import { cfg } from './Config';

/**
 * 2D side-scrolling camera: follows player on X with look-ahead,
 * gently follows Y with a floor clamp.
 */
export class CameraRig {
  update(camera: THREE.OrthographicCamera, playerPos: THREE.Vector3, playerVelX: number, dt: number): void {
    const lookAheadX = playerVelX > 0.5 ? cfg.cameraLookAheadX : playerVelX < -0.5 ? -cfg.cameraLookAheadX : 0;
    const targetX = playerPos.x + lookAheadX;
    const targetY = Math.max(playerPos.y + cfg.cameraLookAheadY, cfg.cameraMinY);

    const t = 1 - Math.exp(-cfg.cameraLerp * dt);
    camera.position.x += (targetX - camera.position.x) * t;
    camera.position.y += (targetY - camera.position.y) * t;
  }
}
