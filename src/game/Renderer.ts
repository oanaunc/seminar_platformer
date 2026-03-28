import * as THREE from 'three';
import { cfg } from './Config';

/**
 * 2D side-view renderer using an orthographic camera.
 * The game world lives on the XY plane; Z is used only for layering.
 */
export class Renderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(cfg.colors.sky);

    // Orthographic camera sized to view height, aspect-corrected width
    const aspect = window.innerWidth / window.innerHeight;
    const halfH = cfg.cameraViewHeight / 2;
    const halfW = halfH * aspect;
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 100);
    this.camera.position.set(0, 0, 50);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Bright, even lighting for cartoon look
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xfff8e8, 0.6);
    dir.position.set(5, 15, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 100;
    dir.shadow.camera.left = -40;
    dir.shadow.camera.right = 40;
    dir.shadow.camera.top = 30;
    dir.shadow.camera.bottom = -20;
    dir.shadow.bias = -0.001;
    this.scene.add(dir);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    const aspect = window.innerWidth / window.innerHeight;
    const halfH = cfg.cameraViewHeight / 2;
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
