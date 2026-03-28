import * as THREE from 'three';
import { cfg } from './Config';
import { AABB, makeAABB, aabbOverlap } from './Physics';
import { PlayerController } from './PlayerController';

/* ──────────────────────────────────────────────
 *  Level data types
 * ────────────────────────────────────────────── */

interface PlatformDef {
  pos: [number, number, number];
  size: [number, number, number];
  color?: number;
}

interface MovingPlatformDef extends PlatformDef {
  axis: 'x' | 'y' | 'z';
  amplitude: number;
  speed: number;
}

interface HazardDef {
  pos: [number, number, number];
  size: [number, number, number];
}

interface CoinDef {
  pos: [number, number, number];
}

interface LevelDef {
  spawn: [number, number, number];
  goal: { pos: [number, number, number]; size: [number, number, number] };
  platforms: PlatformDef[];
  movingPlatforms: MovingPlatformDef[];
  hazards: HazardDef[];
  coins: CoinDef[];
}

/* ──────────────────────────────────────────────
 *  Level 1 definition
 * ────────────────────────────────────────────── */

const LEVEL_1: LevelDef = {
  spawn: [0, 2, 0],

  goal: { pos: [48, 5.5, 0], size: [1, 3, 1] },

  platforms: [
    // Start platform
    { pos: [0, 0, 0], size: [6, 1, 4], color: 0x6b8e6b },
    // Stepping stones — increasing height
    { pos: [8, 1, 0], size: [3, 1, 3], color: 0x7a9a7a },
    { pos: [13, 2.2, 0], size: [3, 1, 3], color: 0x7a9a7a },
    { pos: [18, 3.5, 0], size: [3, 1, 3], color: 0x7a9a7a },
    // Long bridge
    { pos: [25, 3.5, 0], size: [8, 0.5, 3], color: 0xb8976a },
    // Pillars / walls beside bridge for decoration
    { pos: [21.5, 5, -1.5], size: [0.5, 3, 0.5], color: 0x888888 },
    { pos: [28.5, 5, -1.5], size: [0.5, 3, 0.5], color: 0x888888 },
    // After hazard gap — safe landing
    { pos: [35, 3.5, 0], size: [4, 1, 3], color: 0x7a9a7a },
    // Moving platform landing pad
    { pos: [44, 4, 0], size: [4, 1, 4], color: 0x6b8e6b },
    // Goal platform
    { pos: [48, 4, 0], size: [4, 1, 4], color: 0x4a9a4a },
  ],

  movingPlatforms: [
    // Horizontal shuttle between landing pad and a gap
    { pos: [39, 5, 0], size: [3, 0.5, 3], color: 0xd4a050, axis: 'x', amplitude: cfg.movingPlatformAmplitude, speed: cfg.movingPlatformSpeed },
    // Small vertical elevator near start for an optional shortcut
    { pos: [5, 2, -4], size: [2, 0.4, 2], color: 0xd4a050, axis: 'y', amplitude: 2, speed: 1.5 },
  ],

  hazards: [
    // Lava pit under the gap between bridge and safe landing
    { pos: [31, 0.1, 0], size: [5, 0.3, 4] },
    // Spike strip on the bridge
    { pos: [25, 4.2, 0], size: [1.2, 0.3, 1.2] },
  ],

  coins: [
    { pos: [8, 2.5, 0] },
    { pos: [13, 3.7, 0] },
    { pos: [18, 5, 0] },
    { pos: [25, 5.5, 0] },
    { pos: [35, 5, 0] },
    { pos: [44, 6, 0] },
  ],
};

/* ──────────────────────────────────────────────
 *  Runtime moving platform state
 * ────────────────────────────────────────────── */

interface MovingPlatformRuntime {
  mesh: THREE.Mesh;
  aabb: AABB;
  def: MovingPlatformDef;
  basePos: THREE.Vector3;
  prevPos: THREE.Vector3;
}

/* ──────────────────────────────────────────────
 *  Level class — builds meshes, exposes AABBs,
 *  updates moving platforms, checks hazards/goal.
 * ────────────────────────────────────────────── */

export class Level {
  readonly spawn = new THREE.Vector3();

  /** All collidable static AABBs (platforms + moving treated as static each frame). */
  readonly staticAABBs: AABB[] = [];
  readonly movingPlatforms: MovingPlatformRuntime[] = [];

  private hazardAABBs: AABB[] = [];
  private goalAABB!: AABB;

  private coinMeshes: THREE.Mesh[] = [];
  private coinCollected: boolean[] = [];
  coinsCollected = 0;
  coinsTotal = 0;

  private sceneRef!: THREE.Scene;
  private allMeshes: THREE.Object3D[] = [];

  /** Load a level by index (currently only 0). */
  load(index: number, scene: THREE.Scene, player: PlayerController): void {
    this.sceneRef = scene;
    const def = index === 0 ? LEVEL_1 : LEVEL_1; // extendable

    this.spawn.set(...def.spawn);

    // Clear previous
    this.dispose();

    // ── Ground plane (decorative, non-collidable — the kill plane handles death) ──
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7a4a });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);
    this.allMeshes.push(ground);

    // ── Static platforms ──
    for (const p of def.platforms) {
      const geo = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
      const mat = new THREE.MeshStandardMaterial({ color: p.color ?? 0x888888 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...p.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.allMeshes.push(mesh);

      const half = { x: p.size[0] / 2, y: p.size[1] / 2, z: p.size[2] / 2 };
      this.staticAABBs.push(makeAABB(new THREE.Vector3(...p.pos), half));
    }

    // ── Moving platforms ──
    for (const mp of def.movingPlatforms) {
      const geo = new THREE.BoxGeometry(mp.size[0], mp.size[1], mp.size[2]);
      const mat = new THREE.MeshStandardMaterial({ color: mp.color ?? 0xd4a050 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...mp.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.allMeshes.push(mesh);

      const half = { x: mp.size[0] / 2, y: mp.size[1] / 2, z: mp.size[2] / 2 };
      const aabb = makeAABB(new THREE.Vector3(...mp.pos), half);
      this.staticAABBs.push(aabb);

      this.movingPlatforms.push({
        mesh,
        aabb,
        def: mp,
        basePos: new THREE.Vector3(...mp.pos),
        prevPos: new THREE.Vector3(...mp.pos),
      });
    }

    // ── Hazards ──
    for (const h of def.hazards) {
      const geo = new THREE.BoxGeometry(h.size[0], h.size[1], h.size[2]);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xcc2222,
        emissive: 0x991111,
        emissiveIntensity: 0.6,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...h.pos);
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.allMeshes.push(mesh);

      const half = { x: h.size[0] / 2, y: h.size[1] / 2, z: h.size[2] / 2 };
      this.hazardAABBs.push(makeAABB(new THREE.Vector3(...h.pos), half));
    }

    // ── Goal ──
    {
      const g = def.goal;
      const geo = new THREE.CylinderGeometry(0.5, 0.5, g.size[1], 16);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x22dd44,
        emissive: 0x11aa22,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.8,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...g.pos);
      mesh.castShadow = true;
      scene.add(mesh);
      this.allMeshes.push(mesh);

      // Flag pole
      const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, g.size[1] + 2, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(g.pos[0], g.pos[1] + 1, g.pos[2]);
      scene.add(pole);
      this.allMeshes.push(pole);

      // Flag
      const flagGeo = new THREE.PlaneGeometry(1.2, 0.8);
      const flagMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        side: THREE.DoubleSide,
        emissive: 0xffaa00,
        emissiveIntensity: 0.3,
      });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(g.pos[0] + 0.6, g.pos[1] + 2.8, g.pos[2]);
      scene.add(flag);
      this.allMeshes.push(flag);

      const half = { x: g.size[0] / 2, y: g.size[1] / 2, z: g.size[2] / 2 };
      this.goalAABB = makeAABB(new THREE.Vector3(...g.pos), half);
    }

    // ── Coins ──
    this.coinsTotal = def.coins.length;
    this.coinsCollected = 0;
    this.coinCollected = new Array(def.coins.length).fill(false);
    this.coinMeshes = [];
    for (const c of def.coins) {
      const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffaa00,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...c.pos);
      mesh.rotation.x = Math.PI / 2;
      mesh.castShadow = true;
      scene.add(mesh);
      this.allMeshes.push(mesh);
      this.coinMeshes.push(mesh);
    }

    // ── Player mesh ──
    this.buildPlayerMesh(scene, player);
  }

  /** Simple capsule-ish character: body + head. */
  private buildPlayerMesh(scene: THREE.Scene, player: PlayerController): void {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.7, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe04040 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffd4a0 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.55;
    head.castShadow = true;
    group.add(head);

    // Hat (like Mario's cap)
    const hatGeo = new THREE.CylinderGeometry(0.32, 0.35, 0.15, 16);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xcc2222 });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 0.78;
    hat.castShadow = true;
    group.add(hat);

    // Hat brim
    const brimGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.04, 16);
    const brimMat = new THREE.MeshStandardMaterial({ color: 0xcc2222 });
    const brim = new THREE.Mesh(brimGeo, brimMat);
    brim.position.set(0, 0.72, 0.15);
    brim.castShadow = true;
    group.add(brim);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.1, 0.6, 0.25);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.1, 0.6, 0.25);
    group.add(eyeR);

    scene.add(group);
    this.allMeshes.push(group);
    player.mesh = group;
  }

  /* ── Per-frame updates ────────────────────── */

  updateMovingPlatforms(time: number): void {
    for (const mp of this.movingPlatforms) {
      mp.prevPos.copy(mp.mesh.position);

      const offset = Math.sin(time * mp.def.speed) * mp.def.amplitude;
      const newPos = mp.basePos.clone();
      if (mp.def.axis === 'x') newPos.x += offset;
      else if (mp.def.axis === 'y') newPos.y += offset;
      else newPos.z += offset;

      mp.mesh.position.copy(newPos);

      // Update AABB in place
      const half = { x: mp.def.size[0] / 2, y: mp.def.size[1] / 2, z: mp.def.size[2] / 2 };
      mp.aabb.min.set(newPos.x - half.x, newPos.y - half.y, newPos.z - half.z);
      mp.aabb.max.set(newPos.x + half.x, newPos.y + half.y, newPos.z + half.z);
    }
  }

  /**
   * If the player is standing on a moving platform,
   * carry them by the platform's delta this frame.
   */
  carryPlayer(player: PlayerController): void {
    if (!player.grounded || !player.groundCollider) return;

    for (const mp of this.movingPlatforms) {
      if (player.groundCollider === mp.aabb) {
        const delta = mp.mesh.position.clone().sub(mp.prevPos);
        player.position.add(delta);
        break;
      }
    }
  }

  /** Spin coins, check collection. */
  updateCoins(player: PlayerController, _dt: number, time: number): void {
    const pHalf = cfg.playerSize;
    for (let i = 0; i < this.coinMeshes.length; i++) {
      if (this.coinCollected[i]) continue;
      const mesh = this.coinMeshes[i];
      // Spin + bob
      mesh.rotation.z = time * 3;
      mesh.position.y += Math.sin(time * 4 + i) * 0.002;

      const coinAABB = makeAABB(mesh.position, { x: 0.3, y: 0.3, z: 0.3 });
      const playerAABB = makeAABB(player.position, pHalf);
      if (aabbOverlap(playerAABB, coinAABB)) {
        this.coinCollected[i] = true;
        this.coinsCollected++;
        mesh.visible = false;
      }
    }
  }

  checkHazards(player: PlayerController): boolean {
    const playerAABB = makeAABB(player.position, cfg.playerSize);
    for (const h of this.hazardAABBs) {
      if (aabbOverlap(playerAABB, h)) return true;
    }
    // Kill plane
    if (player.position.y < cfg.killPlaneY) return true;
    return false;
  }

  checkGoal(player: PlayerController): boolean {
    const playerAABB = makeAABB(player.position, cfg.playerSize);
    return aabbOverlap(playerAABB, this.goalAABB);
  }

  dispose(): void {
    for (const obj of this.allMeshes) {
      this.sceneRef?.remove(obj);
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
    }
    this.allMeshes = [];
    this.staticAABBs.length = 0;
    this.movingPlatforms.length = 0;
    this.hazardAABBs = [];
    this.coinMeshes = [];
    this.coinCollected = [];
  }
}
