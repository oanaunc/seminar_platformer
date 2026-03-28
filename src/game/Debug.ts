import * as THREE from 'three';
import { AABB } from './Physics';

/**
 * Debug helper: toggleable wireframe visualization of all collision AABBs.
 */
export class Debug {
  private active = false;
  private helpers: THREE.LineSegments[] = [];
  private scene: THREE.Scene | null = null;

  toggle(scene: THREE.Scene, aabbs: AABB[]): void {
    this.scene = scene;
    this.active = !this.active;

    if (this.active) {
      this.rebuild(aabbs);
    } else {
      this.clear();
    }
  }

  /** Rebuild wireframes from current AABBs. */
  rebuild(aabbs: AABB[]): void {
    if (!this.active || !this.scene) return;
    this.clear();

    for (const aabb of aabbs) {
      const sx = aabb.max.x - aabb.min.x;
      const sy = aabb.max.y - aabb.min.y;
      const sz = aabb.max.z - aabb.min.z;
      const cx = (aabb.min.x + aabb.max.x) / 2;
      const cy = (aabb.min.y + aabb.max.y) / 2;
      const cz = (aabb.min.z + aabb.max.z) / 2;

      const geo = new THREE.BoxGeometry(sx, sy, sz);
      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
      line.position.set(cx, cy, cz);
      this.scene.add(line);
      this.helpers.push(line);
      geo.dispose();
    }
  }

  /** Update wireframe positions for moving platforms. */
  update(aabbs: AABB[]): void {
    if (!this.active) return;
    // For simplicity, rebuild each frame when active
    this.rebuild(aabbs);
  }

  private clear(): void {
    for (const h of this.helpers) {
      this.scene?.remove(h);
      h.geometry.dispose();
      (h.material as THREE.Material).dispose();
    }
    this.helpers = [];
  }

  get isActive(): boolean {
    return this.active;
  }
}
