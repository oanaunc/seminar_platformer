import * as THREE from 'three';
import { cfg } from './Config';
import { AABB, makeAABB, aabbOverlap } from './Physics';
import { PlayerController } from './PlayerController';

/* ──────────────────────────────────────────────
 *  Level data types (2D: positions are [x, y])
 * ────────────────────────────────────────────── */

interface PlatformDef {
  pos: [number, number];
  size: [number, number];
  type?: 'grass' | 'dirt' | 'stone' | 'wood' | 'bridge';
}

interface MovingPlatformDef {
  pos: [number, number];
  size: [number, number];
  axis: 'x' | 'y';
  amplitude: number;
  speed: number;
  type?: 'wood' | 'stone';
}

interface HazardDef {
  pos: [number, number];
  size: [number, number];
  type?: 'spikes' | 'water';
}

interface CoinDef {
  pos: [number, number];
}

interface DecorationDef {
  pos: [number, number];
  kind: 'tree' | 'bush' | 'fence' | 'sign' | 'crate' | 'barrel' | 'flower' | 'tallTree' | 'vine';
}

interface LevelDef {
  spawn: [number, number];
  goal: { pos: [number, number]; size: [number, number] };
  platforms: PlatformDef[];
  movingPlatforms: MovingPlatformDef[];
  hazards: HazardDef[];
  coins: CoinDef[];
  decorations: DecorationDef[];
}

/* ──────────────────────────────────────────────
 *  Level 1 — Farm Platformer
 * ────────────────────────────────────────────── */

const LEVEL_1: LevelDef = {
  spawn: [-8, 4],

  goal: { pos: [52, 6.5], size: [1.2, 3] },

  platforms: [
    // ── Ground / underground base (wide, easy start) ──
    { pos: [-4, -2], size: [22, 5], type: 'grass' },
    // Gentle stepping platforms (small height increments, close together)
    { pos: [11, 0], size: [4, 1], type: 'grass' },
    { pos: [16, 1], size: [4, 1], type: 'grass' },
    { pos: [21, 2], size: [3.5, 0.8], type: 'grass' },
    // Upper grassy area
    { pos: [27, 3], size: [10, 1], type: 'grass' },
    // Underground walls beneath upper area
    { pos: [27, -1], size: [10, 7], type: 'stone' },
    // Bridge section (right after upper area, easy to reach)
    { pos: [34, 3.5], size: [4, 0.5], type: 'bridge' },
    // Small landing pad after bridge
    { pos: [39, 3.5], size: [3, 1], type: 'grass' },
    { pos: [39, -0.5], size: [3, 7], type: 'stone' },
    // Far platform (close to where moving platform delivers you)
    { pos: [46, 3.5], size: [6, 1], type: 'grass' },
    // Underground fill at far end
    { pos: [46, -1.5], size: [6, 8], type: 'stone' },
    // Goal platform
    { pos: [52, 4], size: [5, 1], type: 'grass' },
    { pos: [52, -0.5], size: [5, 8], type: 'dirt' },
    // Floating bonus platforms
    { pos: [15, 5], size: [2.5, 0.5], type: 'wood' },
    { pos: [30, 6], size: [3, 0.5], type: 'wood' },
  ],

  movingPlatforms: [
    // Horizontal shuttle from landing pad to far platform (short gap, easy to ride)
    { pos: [43, 4.5], size: [3, 0.5], axis: 'x', amplitude: 2, speed: 1.5, type: 'wood' },
    // Vertical elevator near upper area
    { pos: [24, 4.5], size: [2.2, 0.5], axis: 'y', amplitude: 2, speed: 1.2, type: 'stone' },
  ],

  hazards: [
    // Spikes below the gap (between landing pad and far platform)
    { pos: [43, -1], size: [4, 0.5], type: 'spikes' },
    // Water at the very bottom
    { pos: [43, -5.5], size: [12, 2], type: 'water' },
  ],

  coins: [
    { pos: [-2, 2] },
    { pos: [3, 2] },
    { pos: [11, 2] },
    { pos: [15, 6.5] },
    { pos: [16, 3] },
    { pos: [24, 5] },
    { pos: [30, 7.5] },
    { pos: [34, 5] },
    { pos: [43, 6] },
    { pos: [50, 6] },
  ],

  decorations: [
    { pos: [-12, 1.5], kind: 'tallTree' },
    { pos: [-6, 0.8], kind: 'fence' },
    { pos: [-2, 0.5], kind: 'bush' },
    { pos: [2, 0.8], kind: 'fence' },
    { pos: [5, 1.5], kind: 'tree' },
    { pos: [-9, 0.7], kind: 'flower' },
    { pos: [0, 0.7], kind: 'flower' },
    { pos: [8, 0.5], kind: 'sign' },
    { pos: [20, 2.8], kind: 'bush' },
    { pos: [25, 4.2], kind: 'fence' },
    { pos: [29, 4.2], kind: 'bush' },
    { pos: [31, 4.5], kind: 'tree' },
    { pos: [46, 4.2], kind: 'crate' },
    { pos: [48, 4.2], kind: 'barrel' },
    { pos: [54, 5.5], kind: 'tallTree' },
    { pos: [50, 4.7], kind: 'flower' },
    { pos: [39, 4.8], kind: 'fence' },
  ],
};

/* ──────────────────────────────────────────────
 *  Runtime types
 * ────────────────────────────────────────────── */

interface MovingPlatformRuntime {
  mesh: THREE.Object3D;
  aabb: AABB;
  def: MovingPlatformDef;
  basePos: THREE.Vector3;
  prevPos: THREE.Vector3;
}

/* ──────────────────────────────────────────────
 *  Level class
 * ────────────────────────────────────────────── */

export class Level {
  readonly spawn = new THREE.Vector3();
  readonly staticAABBs: AABB[] = [];
  readonly movingPlatforms: MovingPlatformRuntime[] = [];

  private hazardAABBs: AABB[] = [];
  private goalAABB!: AABB;

  private coinMeshes: THREE.Object3D[] = [];
  private coinBaseY: number[] = [];
  private coinCollected: boolean[] = [];
  coinsCollected = 0;
  coinsTotal = 0;

  private sceneRef!: THREE.Scene;
  private allObjects: THREE.Object3D[] = [];

  load(index: number, scene: THREE.Scene, player: PlayerController): void {
    this.sceneRef = scene;
    const def = index === 0 ? LEVEL_1 : LEVEL_1;

    this.spawn.set(def.spawn[0], def.spawn[1], 0);
    this.dispose();

    const C = cfg.colors;

    // ── Background layers (far behind game at negative Z) ──
    this.buildBackground(scene, C);

    // ── Static platforms ──
    for (const p of def.platforms) {
      const group = this.buildPlatformMesh(p, C);
      scene.add(group);
      this.allObjects.push(group);

      const half = { x: p.size[0] / 2, y: p.size[1] / 2, z: 1 };
      this.staticAABBs.push(makeAABB(new THREE.Vector3(p.pos[0], p.pos[1], 0), half));
    }

    // ── Moving platforms ──
    for (const mp of def.movingPlatforms) {
      const group = this.buildMovingPlatformMesh(mp, C);
      scene.add(group);
      this.allObjects.push(group);

      const half = { x: mp.size[0] / 2, y: mp.size[1] / 2, z: 1 };
      const aabb = makeAABB(new THREE.Vector3(mp.pos[0], mp.pos[1], 0), half);
      this.staticAABBs.push(aabb);

      this.movingPlatforms.push({
        mesh: group,
        aabb,
        def: mp,
        basePos: new THREE.Vector3(mp.pos[0], mp.pos[1], 0),
        prevPos: new THREE.Vector3(mp.pos[0], mp.pos[1], 0),
      });
    }

    // ── Hazards ──
    for (const h of def.hazards) {
      const mesh = this.buildHazardMesh(h, C);
      scene.add(mesh);
      this.allObjects.push(mesh);

      const half = { x: h.size[0] / 2, y: h.size[1] / 2, z: 1 };
      this.hazardAABBs.push(makeAABB(new THREE.Vector3(h.pos[0], h.pos[1], 0), half));
    }

    // ── Goal ──
    {
      const g = def.goal;
      const goalGroup = this.buildGoalMesh(g, C);
      scene.add(goalGroup);
      this.allObjects.push(goalGroup);

      const half = { x: g.size[0] / 2, y: g.size[1] / 2, z: 1 };
      this.goalAABB = makeAABB(new THREE.Vector3(g.pos[0], g.pos[1], 0), half);
    }

    // ── Coins ──
    this.coinsTotal = def.coins.length;
    this.coinsCollected = 0;
    this.coinCollected = new Array(def.coins.length).fill(false);
    this.coinMeshes = [];
    this.coinBaseY = [];
    for (const c of def.coins) {
      const coin = this.buildCoinMesh(C);
      coin.position.set(c.pos[0], c.pos[1], 2);
      scene.add(coin);
      this.allObjects.push(coin);
      this.coinMeshes.push(coin);
      this.coinBaseY.push(c.pos[1]);
    }

    // ── Decorations ──
    for (const d of def.decorations) {
      const obj = this.buildDecoration(d, C);
      if (obj) {
        scene.add(obj);
        this.allObjects.push(obj);
      }
    }

    // ── Player mesh ──
    this.buildPlayerMesh(scene, player);
  }

  /* ── Mesh builders ───────────────────────── */

  private buildPlatformMesh(p: PlatformDef, C: typeof cfg.colors): THREE.Group {
    const group = new THREE.Group();
    const [w, h] = p.size;
    const type = p.type ?? 'grass';

    if (type === 'grass') {
      // Dirt body
      const dirt = this.box(w, h, 1, C.dirt);
      group.add(dirt);
      // Grass strip on top
      const grassH = Math.min(0.3, h * 0.3);
      const grass = this.box(w, grassH, 1.01, C.grassTop);
      grass.position.y = h / 2 - grassH / 2;
      group.add(grass);
      // Darker dirt bottom edge
      const edgeH = Math.min(0.15, h * 0.15);
      const edge = this.box(w, edgeH, 1, C.dirtDark);
      edge.position.y = -h / 2 + edgeH / 2;
      group.add(edge);
    } else if (type === 'dirt') {
      const body = this.box(w, h, 1, C.dirt);
      group.add(body);
      const edge = this.box(w, 0.12, 1, C.dirtDark);
      edge.position.y = h / 2 - 0.06;
      group.add(edge);
    } else if (type === 'stone') {
      const body = this.box(w, h, 1, C.stone);
      group.add(body);
      // Stone line details
      for (let row = 0; row < Math.floor(h / 1.2); row++) {
        const lineY = -h / 2 + 0.6 + row * 1.2;
        const line = this.box(w, 0.04, 1.01, C.stoneDark);
        line.position.y = lineY;
        group.add(line);
      }
    } else if (type === 'wood' || type === 'bridge') {
      const body = this.box(w, h, 1, C.wood);
      group.add(body);
      const top = this.box(w + 0.2, Math.min(h * 0.3, 0.15), 1.01, C.woodDark);
      top.position.y = h / 2 - 0.05;
      group.add(top);
    }

    group.position.set(p.pos[0], p.pos[1], 0);
    return group;
  }

  private buildMovingPlatformMesh(mp: MovingPlatformDef, C: typeof cfg.colors): THREE.Group {
    const group = new THREE.Group();
    const [w, h] = mp.size;
    const color = mp.type === 'stone' ? C.stone : C.wood;
    const body = this.box(w, h, 1, color);
    group.add(body);
    // Arrows / rails indicator
    const rail = this.box(w * 0.6, 0.06, 1.01, C.woodDark);
    group.add(rail);
    group.position.set(mp.pos[0], mp.pos[1], 0.5);
    return group;
  }

  private buildHazardMesh(h: HazardDef, C: typeof cfg.colors): THREE.Group {
    const group = new THREE.Group();
    const [w, hh] = h.size;
    const type = h.type ?? 'spikes';

    if (type === 'water') {
      const water = this.box(w, hh, 1, C.water);
      (water.material as THREE.MeshStandardMaterial).transparent = true;
      (water.material as THREE.MeshStandardMaterial).opacity = 0.7;
      group.add(water);
      // Surface line
      const surface = this.box(w, 0.1, 1.01, 0x5ab0e8);
      surface.position.y = hh / 2 - 0.05;
      group.add(surface);
    } else {
      // Spikes as triangular prism shapes
      const spikeCount = Math.max(1, Math.floor(w / 0.4));
      const spikeW = w / spikeCount;
      for (let i = 0; i < spikeCount; i++) {
        const shape = new THREE.Shape();
        shape.moveTo(-spikeW / 2, 0);
        shape.lineTo(0, hh);
        shape.lineTo(spikeW / 2, 0);
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        const mat = new THREE.MeshStandardMaterial({ color: C.hazardRed, side: THREE.DoubleSide });
        const spike = new THREE.Mesh(geo, mat);
        spike.position.x = -w / 2 + spikeW / 2 + i * spikeW;
        spike.position.y = -hh / 2;
        group.add(spike);
      }
    }

    group.position.set(h.pos[0], h.pos[1], 0.5);
    return group;
  }

  private buildGoalMesh(g: { pos: [number, number]; size: [number, number] }, C: typeof cfg.colors): THREE.Group {
    const group = new THREE.Group();

    // Pole
    const pole = this.box(0.12, g.size[1] + 2, 0.12, 0xdddddd);
    pole.position.y = 1;
    group.add(pole);

    // Flag
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(1.4, 0.3);
    flagShape.lineTo(0, 0.8);
    flagShape.closePath();
    const flagGeo = new THREE.ShapeGeometry(flagShape);
    const flagMat = new THREE.MeshStandardMaterial({
      color: C.goalGreen,
      emissive: C.goalGreen,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.06, g.size[1] / 2 + 1.2, 0.1);
    group.add(flag);

    // Glowing base
    const base = this.box(0.6, 0.3, 0.6, C.goalGreen);
    (base.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(C.goalGreen);
    (base.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
    base.position.y = -g.size[1] / 2 + 0.15;
    group.add(base);

    group.position.set(g.pos[0], g.pos[1], 1.5);
    return group;
  }

  private buildCoinMesh(C: typeof cfg.colors): THREE.Group {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.3, 16),
      new THREE.MeshStandardMaterial({
        color: C.coinGold,
        emissive: 0xffaa00,
        emissiveIntensity: 0.4,
        side: THREE.DoubleSide,
      }),
    );
    group.add(ring);
    // Inner circle
    const center = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffee88,
        emissive: 0xffcc44,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide,
      }),
    );
    group.add(center);
    return group;
  }

  private buildDecoration(d: DecorationDef, C: typeof cfg.colors): THREE.Group | null {
    const group = new THREE.Group();
    const z = -0.5; // decorations sit behind platforms

    switch (d.kind) {
      case 'tree': {
        const trunk = this.box(0.4, 1.4, 0.4, C.treeTrunk);
        trunk.position.y = 0.7;
        group.add(trunk);
        // Canopy layers (rounded look with overlapping circles)
        for (const [dx, dy, r] of [[0, 2, 0.9], [-0.3, 1.7, 0.6], [0.35, 1.8, 0.65]] as [number, number, number][]) {
          const canopy = new THREE.Mesh(
            new THREE.CircleGeometry(r, 16),
            new THREE.MeshStandardMaterial({ color: C.treeLeaves, side: THREE.DoubleSide }),
          );
          canopy.position.set(dx, dy, 0.01);
          group.add(canopy);
        }
        // Brighter highlight
        const highlight = new THREE.Mesh(
          new THREE.CircleGeometry(0.5, 16),
          new THREE.MeshStandardMaterial({ color: C.treeLeavesBright, side: THREE.DoubleSide }),
        );
        highlight.position.set(0.1, 2.2, 0.02);
        group.add(highlight);
        break;
      }
      case 'tallTree': {
        const trunk = this.box(0.5, 2.5, 0.5, C.treeTrunk);
        trunk.position.y = 1.25;
        group.add(trunk);
        for (const [dx, dy, r] of [[0, 3.4, 1.3], [-0.5, 2.8, 0.9], [0.5, 3.0, 0.95], [0, 4.0, 0.8]] as [number, number, number][]) {
          const canopy = new THREE.Mesh(
            new THREE.CircleGeometry(r, 20),
            new THREE.MeshStandardMaterial({ color: C.treeLeaves, side: THREE.DoubleSide }),
          );
          canopy.position.set(dx, dy, 0.01);
          group.add(canopy);
        }
        const highlight = new THREE.Mesh(
          new THREE.CircleGeometry(0.7, 16),
          new THREE.MeshStandardMaterial({ color: C.treeLeavesBright, side: THREE.DoubleSide }),
        );
        highlight.position.set(0.15, 3.7, 0.02);
        group.add(highlight);
        break;
      }
      case 'bush': {
        for (const [dx, dy, r] of [[0, 0.3, 0.5], [-0.3, 0.2, 0.35], [0.3, 0.2, 0.4]] as [number, number, number][]) {
          const leaf = new THREE.Mesh(
            new THREE.CircleGeometry(r, 12),
            new THREE.MeshStandardMaterial({ color: C.treeLeaves, side: THREE.DoubleSide }),
          );
          leaf.position.set(dx, dy, 0.01);
          group.add(leaf);
        }
        break;
      }
      case 'fence': {
        const rail = this.box(2.5, 0.1, 0.1, C.fenceWood);
        rail.position.y = 0.5;
        group.add(rail);
        const rail2 = this.box(2.5, 0.1, 0.1, C.fenceWood);
        rail2.position.y = 0.25;
        group.add(rail2);
        for (let i = -1; i <= 1; i++) {
          const post = this.box(0.12, 0.8, 0.12, C.woodDark);
          post.position.set(i * 1, 0.4, 0);
          group.add(post);
        }
        break;
      }
      case 'sign': {
        const post = this.box(0.12, 0.9, 0.12, C.woodDark);
        post.position.y = 0.45;
        group.add(post);
        const board = this.box(0.8, 0.5, 0.08, C.fenceWood);
        board.position.y = 0.9;
        group.add(board);
        // Arrow
        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(0.15, 0.3, 3),
          new THREE.MeshStandardMaterial({ color: 0xffffff }),
        );
        arrow.rotation.z = -Math.PI / 2;
        arrow.position.set(0.15, 0.9, 0.06);
        group.add(arrow);
        break;
      }
      case 'crate': {
        const body = this.box(0.7, 0.7, 0.7, C.wood);
        body.position.y = 0.35;
        group.add(body);
        const cross1 = this.box(0.9, 0.06, 0.72, C.woodDark);
        cross1.position.y = 0.35;
        cross1.rotation.z = Math.PI / 4;
        group.add(cross1);
        break;
      }
      case 'barrel': {
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 0.8, 12),
          new THREE.MeshStandardMaterial({ color: C.wood }),
        );
        body.position.y = 0.4;
        group.add(body);
        const band = new THREE.Mesh(
          new THREE.TorusGeometry(0.35, 0.03, 8, 16),
          new THREE.MeshStandardMaterial({ color: C.woodDark }),
        );
        band.position.y = 0.5;
        band.rotation.x = Math.PI / 2;
        group.add(band);
        break;
      }
      case 'flower': {
        const stem = this.box(0.04, 0.35, 0.04, 0x2d8a4e);
        stem.position.y = 0.175;
        group.add(stem);
        const petalColors = [0xff6b6b, 0xffcc33, 0xff88dd, 0xff5533, 0xaa66ff];
        const color = petalColors[Math.floor(Math.random() * petalColors.length)];
        const flower = new THREE.Mesh(
          new THREE.CircleGeometry(0.15, 8),
          new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }),
        );
        flower.position.set(0, 0.4, 0.01);
        group.add(flower);
        const center = new THREE.Mesh(
          new THREE.CircleGeometry(0.06, 8),
          new THREE.MeshStandardMaterial({ color: 0xffee44, side: THREE.DoubleSide }),
        );
        center.position.set(0, 0.4, 0.02);
        group.add(center);
        break;
      }
      case 'vine': {
        for (let i = 0; i < 6; i++) {
          const seg = this.box(0.12, 0.6, 0.1, 0x2d8a4e);
          seg.position.y = i * 0.55;
          seg.position.x = Math.sin(i * 0.8) * 0.1;
          group.add(seg);
          if (i % 2 === 0) {
            const leaf = new THREE.Mesh(
              new THREE.CircleGeometry(0.15, 6),
              new THREE.MeshStandardMaterial({ color: C.treeLeavesBright, side: THREE.DoubleSide }),
            );
            leaf.position.set(0.2, i * 0.55, 0.01);
            group.add(leaf);
          }
        }
        break;
      }
      default:
        return null;
    }

    group.position.set(d.pos[0], d.pos[1], z);
    return group;
  }

  /**
   * Build a side-view character with separate limbs for animation.
   * Default pose faces right. PlayerController flips via scale.x.
   *
   * Structure (all in XY plane):
   *   group (root — positioned at player.position)
   *     bodyGroup (holds torso, head, hat — scales for squash/stretch)
   *       torso, shirt, head, hat, eye, pupil
   *     legBack  (pivot at hip — rotates for walk cycle)
   *     legFront
   *     armBack  (pivot at shoulder — swings for walk)
   *     armFront
   */
  private buildPlayerMesh(scene: THREE.Scene, player: PlayerController): void {
    const DS = THREE.DoubleSide;
    const mat = (color: number) => new THREE.MeshStandardMaterial({ color, side: DS });
    const circle = (r: number, color: number) =>
      new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat(color));
    const roundedRect = (w: number, h: number, color: number) => {
      const shape = new THREE.Shape();
      const r = Math.min(w, h) * 0.25;
      shape.moveTo(-w / 2 + r, -h / 2);
      shape.lineTo(w / 2 - r, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      shape.lineTo(w / 2, h / 2 - r);
      shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      shape.lineTo(-w / 2 + r, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      shape.lineTo(-w / 2, -h / 2 + r);
      shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      return new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(color));
    };

    const group = new THREE.Group();

    // ── Legs (behind body, pivoted at hip) ──

    // Back leg (drawn at z = -0.02 so it's behind)
    const legBack = new THREE.Group();
    const legBackThigh = roundedRect(0.18, 0.28, 0x3366aa);
    legBackThigh.position.y = -0.14;
    legBack.add(legBackThigh);
    const legBackBoot = roundedRect(0.22, 0.14, 0x6b4226);
    legBackBoot.position.y = -0.34;
    legBack.add(legBackBoot);
    legBack.position.set(0.02, -0.28, -0.02);
    group.add(legBack);

    // Front leg (z = 0.02 so it's in front)
    const legFront = new THREE.Group();
    const legFrontThigh = roundedRect(0.18, 0.28, 0x4488cc);
    legFrontThigh.position.y = -0.14;
    legFront.add(legFrontThigh);
    const legFrontBoot = roundedRect(0.22, 0.14, 0x7a5232);
    legFrontBoot.position.y = -0.34;
    legFront.add(legFrontBoot);
    legFront.position.set(0.02, -0.28, 0.02);
    group.add(legFront);

    // ── Back arm (behind body) ──
    const armBack = new THREE.Group();
    const armBackUpper = roundedRect(0.12, 0.26, 0xc03030);
    armBackUpper.position.y = -0.13;
    armBack.add(armBackUpper);
    const armBackHand = circle(0.07, 0xffd4a0);
    armBackHand.position.set(0, -0.28, 0.01);
    armBack.add(armBackHand);
    armBack.position.set(-0.02, 0.2, -0.03);
    group.add(armBack);

    // ── Body group (torso + head + hat — animated for squash/stretch) ──
    const bodyGroup = new THREE.Group();

    // Torso — overalls
    const torso = roundedRect(0.5, 0.42, 0x4488cc);
    torso.position.y = -0.03;
    bodyGroup.add(torso);

    // Overall strap lines
    const strapL = roundedRect(0.06, 0.18, 0x3366aa);
    strapL.position.set(-0.12, 0.12, 0.01);
    bodyGroup.add(strapL);
    const strapR = roundedRect(0.06, 0.18, 0x3366aa);
    strapR.position.set(0.12, 0.12, 0.01);
    bodyGroup.add(strapR);

    // Overall button
    const button = circle(0.03, 0xffcc00);
    button.position.set(0, 0.05, 0.02);
    bodyGroup.add(button);

    // Shirt (visible above overalls)
    const shirt = roundedRect(0.5, 0.18, 0xe04040);
    shirt.position.y = 0.25;
    bodyGroup.add(shirt);

    // Neck
    const neck = roundedRect(0.14, 0.08, 0xffd4a0);
    neck.position.y = 0.36;
    bodyGroup.add(neck);

    // Head
    const head = circle(0.3, 0xffd4a0);
    head.position.set(0.02, 0.55, 0.01);
    bodyGroup.add(head);

    // Ear (back)
    const ear = circle(0.07, 0xeebb88);
    ear.position.set(-0.22, 0.52, -0.01);
    bodyGroup.add(ear);

    // Nose (side-view bump)
    const nose = circle(0.05, 0xeebb88);
    nose.position.set(0.24, 0.5, 0.02);
    bodyGroup.add(nose);

    // Eye white
    const eyeWhite = circle(0.1, 0xffffff);
    eyeWhite.position.set(0.1, 0.58, 0.02);
    bodyGroup.add(eyeWhite);

    // Pupil
    const eyePupil = circle(0.055, 0x222222);
    eyePupil.position.set(0.13, 0.57, 0.03);
    bodyGroup.add(eyePupil);

    // Eye highlight
    const eyeHighlight = circle(0.025, 0xffffff);
    eyeHighlight.position.set(0.15, 0.6, 0.04);
    bodyGroup.add(eyeHighlight);

    // Mouth (small curve approximated by a thin arc)
    const mouthShape = new THREE.Shape();
    mouthShape.absarc(0, 0, 0.06, Math.PI * 0.1, Math.PI * 0.9, false);
    mouthShape.absarc(0, 0.01, 0.04, Math.PI * 0.9, Math.PI * 0.1, true);
    const mouth = new THREE.Mesh(
      new THREE.ShapeGeometry(mouthShape),
      mat(0xcc5544),
    );
    mouth.position.set(0.15, 0.42, 0.02);
    bodyGroup.add(mouth);

    // Hat
    const hatBody = roundedRect(0.58, 0.2, 0xcc2222);
    hatBody.position.set(0, 0.76, 0.02);
    bodyGroup.add(hatBody);
    // Hat brim (extends forward for side-view)
    const hatBrim = roundedRect(0.36, 0.07, 0xaa1818);
    hatBrim.position.set(0.22, 0.68, 0.03);
    bodyGroup.add(hatBrim);
    // Hat highlight
    const hatHighlight = roundedRect(0.15, 0.06, 0xdd4444);
    hatHighlight.position.set(0.05, 0.8, 0.03);
    bodyGroup.add(hatHighlight);

    // "M" emblem on hat (simple circle badge)
    const emblem = circle(0.06, 0xffffff);
    emblem.position.set(0.15, 0.74, 0.04);
    bodyGroup.add(emblem);

    group.add(bodyGroup);

    // ── Front arm (in front of body) ──
    const armFront = new THREE.Group();
    const armFrontUpper = roundedRect(0.13, 0.26, 0xe04040);
    armFrontUpper.position.y = -0.13;
    armFront.add(armFrontUpper);
    const armFrontHand = circle(0.08, 0xffd4a0);
    armFrontHand.position.set(0, -0.28, 0.01);
    armFront.add(armFrontHand);
    armFront.position.set(0.02, 0.2, 0.03);
    group.add(armFront);

    scene.add(group);
    this.allObjects.push(group);

    // Store references for animation
    player.mesh = group;
    player.bodyGroup = bodyGroup;
    player.legBack = legBack;
    player.legFront = legFront;
    player.armBack = armBack;
    player.armFront = armFront;
    player.eyePupil = eyePupil;
  }

  /* ── Background ──────────────────────────── */

  private buildBackground(scene: THREE.Scene, C: typeof cfg.colors): void {
    // Far hills (parallax layer at z = -10)
    for (const [x, y, r, color] of [
      [-15, -1, 8, C.hillFar],
      [5, -2, 10, C.hillFar],
      [25, -1, 9, C.hillFar],
      [45, -2, 8, C.hillFar],
      [60, -1, 7, C.hillFar],
    ] as [number, number, number, number][]) {
      const hill = new THREE.Mesh(
        new THREE.CircleGeometry(r, 32),
        new THREE.MeshStandardMaterial({ color }),
      );
      hill.position.set(x, y, -10);
      scene.add(hill);
      this.allObjects.push(hill);
    }

    // Near hills (z = -5)
    for (const [x, y, r, color] of [
      [-10, -3, 6, C.hillNear],
      [10, -4, 7, C.hillNear],
      [30, -3, 5, C.hillNear],
      [50, -4, 6, C.hillNear],
    ] as [number, number, number, number][]) {
      const hill = new THREE.Mesh(
        new THREE.CircleGeometry(r, 32),
        new THREE.MeshStandardMaterial({ color }),
      );
      hill.position.set(x, y, -5);
      scene.add(hill);
      this.allObjects.push(hill);
    }

    // Clouds (z = -8)
    for (const [x, y] of [[- 8, 10], [5, 11], [20, 9.5], [35, 11], [50, 10], [65, 9]]) {
      const cloud = this.buildCloud(C);
      cloud.position.set(x, y, -8);
      scene.add(cloud);
      this.allObjects.push(cloud);
    }
  }

  private buildCloud(C: typeof cfg.colors): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: C.cloud });
    for (const [dx, dy, r] of [[0, 0, 0.8], [0.7, 0.1, 0.6], [-0.6, 0.05, 0.55], [0.3, 0.3, 0.5], [-0.2, 0.25, 0.45]] as [number, number, number][]) {
      const puff = new THREE.Mesh(new THREE.CircleGeometry(r, 16), mat);
      puff.position.set(dx, dy, 0);
      group.add(puff);
    }
    return group;
  }

  /* ── Per-frame updates ───────────────────── */

  updateMovingPlatforms(time: number): void {
    for (const mp of this.movingPlatforms) {
      mp.prevPos.copy(mp.mesh.position);

      const offset = Math.sin(time * mp.def.speed) * mp.def.amplitude;
      const newX = mp.def.axis === 'x' ? mp.basePos.x + offset : mp.basePos.x;
      const newY = mp.def.axis === 'y' ? mp.basePos.y + offset : mp.basePos.y;

      mp.mesh.position.set(newX, newY, mp.mesh.position.z);

      const half = { x: mp.def.size[0] / 2, y: mp.def.size[1] / 2, z: 1 };
      mp.aabb.min.set(newX - half.x, newY - half.y, -1);
      mp.aabb.max.set(newX + half.x, newY + half.y, 1);
    }
  }

  carryPlayer(player: PlayerController): void {
    if (!player.grounded || !player.groundCollider) return;
    for (const mp of this.movingPlatforms) {
      if (player.groundCollider === mp.aabb) {
        const delta = mp.mesh.position.clone().sub(mp.prevPos);
        player.position.x += delta.x;
        player.position.y += delta.y;
        break;
      }
    }
  }

  updateCoins(player: PlayerController, _dt: number, time: number): void {
    for (let i = 0; i < this.coinMeshes.length; i++) {
      if (this.coinCollected[i]) continue;
      const mesh = this.coinMeshes[i];
      // Bob animation
      mesh.position.y = this.coinBaseY[i] + Math.sin(time * 3 + i * 1.5) * 0.15;

      const coinAABB = makeAABB(new THREE.Vector3(mesh.position.x, mesh.position.y, 0), { x: 0.3, y: 0.3, z: 1 });
      const playerAABB = makeAABB(player.position, cfg.playerSize);
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
    if (player.position.y < cfg.killPlaneY) return true;
    return false;
  }

  checkGoal(player: PlayerController): boolean {
    const playerAABB = makeAABB(player.position, cfg.playerSize);
    return aabbOverlap(playerAABB, this.goalAABB);
  }

  /* ── Helpers ─────────────────────────────── */

  private box(w: number, h: number, d: number, color: number): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color }),
    );
  }

  dispose(): void {
    for (const obj of this.allObjects) {
      this.sceneRef?.remove(obj);
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
    }
    this.allObjects = [];
    this.staticAABBs.length = 0;
    this.movingPlatforms.length = 0;
    this.hazardAABBs = [];
    this.coinMeshes = [];
    this.coinBaseY = [];
    this.coinCollected = [];
  }
}
