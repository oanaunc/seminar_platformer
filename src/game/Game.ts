import { cfg } from './Config';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { CameraRig } from './CameraRig';
import { PlayerController } from './PlayerController';
import { Level } from './Level';
import { UI } from './UI';
import { Audio } from './Audio';
import { Debug } from './Debug';

/* ──────────────────────────────────────────────
 *  Game States
 * ────────────────────────────────────────────── */

const enum State {
  StartScreen,
  Playing,
  Paused,
  Dead,
  Won,
}

/* ──────────────────────────────────────────────
 *  Game — orchestrates all modules, owns the
 *  fixed-timestep loop and state machine.
 * ────────────────────────────────────────────── */

export class Game {
  private input = new Input();
  private renderer = new Renderer();
  private camera = new CameraRig();
  private player = new PlayerController();
  private level = new Level();
  private ui = new UI();
  private audio = new Audio();
  private debug = new Debug();

  private state: State = State.StartScreen;
  private playTime = 0;
  private deaths = 0;
  private accumulator = 0;
  private elapsedTime = 0; // global clock for animations (moving platforms)
  private prevCoins = 0;

  constructor() {
    this.level.load(0, this.renderer.scene, this.player);
    this.player.reset(this.level.spawn);
    this.ui.showStart();
  }

  /* ── Main loop entry ─────────────────────── */

  start(): void {
    let lastTime = performance.now();

    const loop = (now: number): void => {
      requestAnimationFrame(loop);

      // Clamp dt to avoid spiral-of-death when tab is backgrounded
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.1);
      lastTime = now;

      this.handleInput();

      if (this.state === State.Playing) {
        this.fixedUpdate(dt);
      }

      this.renderer.render();
      this.input.endFrame();
    };

    requestAnimationFrame(loop);
  }

  /* ── Input → state transitions ───────────── */

  private handleInput(): void {
    // Debug toggle (works in any state)
    if (this.input.debugToggle) {
      this.debug.toggle(this.renderer.scene, this.level.staticAABBs);
    }

    switch (this.state) {
      case State.StartScreen:
        if (this.input.enter) this.transitionTo(State.Playing);
        break;

      case State.Playing:
        if (this.input.pause) this.transitionTo(State.Paused);
        break;

      case State.Paused:
        if (this.input.pause) this.transitionTo(State.Playing);
        break;

      case State.Dead:
        if (this.input.restart || this.input.enter) this.restartLevel();
        break;

      case State.Won:
        if (this.input.restart || this.input.enter) this.restartLevel();
        break;
    }
  }

  /* ── Fixed-timestep physics simulation ───── */

  private fixedUpdate(dt: number): void {
    this.accumulator += dt;
    this.playTime += dt;
    this.elapsedTime += dt;

    const fixedDt = cfg.fixedTimestep;
    let steps = 0;

    while (this.accumulator >= fixedDt && steps < cfg.maxSubSteps) {
      this.stepSimulation(fixedDt);
      this.accumulator -= fixedDt;
      steps++;
    }

    // Update HUD every frame
    this.ui.updateHUD(this.playTime, this.deaths, this.level.coinsCollected, this.level.coinsTotal);

    // Update debug wireframes if active
    if (this.debug.isActive) {
      this.debug.update(this.level.staticAABBs);
    }
  }

  /**
   * One fixed-timestep simulation tick.
   * Order: move platforms → player update → carry → hazards → goal → coins → camera.
   */
  private stepSimulation(dt: number): void {
    // 1. Move platforms first so player resolves against their new position
    this.level.updateMovingPlatforms(this.elapsedTime);

    // 2. Player physics & collision
    this.player.update(this.input, this.level.staticAABBs, dt);

    // 3. Carry player on moving platforms (apply delta after collision)
    this.level.carryPlayer(this.player);

    // 4. Hazard check
    if (this.level.checkHazards(this.player)) {
      this.transitionTo(State.Dead);
      return;
    }

    // 5. Goal check
    if (this.level.checkGoal(this.player)) {
      this.transitionTo(State.Won);
      return;
    }

    // 6. Coins
    this.level.updateCoins(this.player, dt, this.elapsedTime);
    if (this.level.coinsCollected > this.prevCoins) {
      this.audio.coin();
      this.prevCoins = this.level.coinsCollected;
    }

    // 7. Camera follow
    this.camera.update(this.renderer.camera, this.player.position, this.player.velocity.x, dt);
  }

  /* ── State transitions ───────────────────── */

  private transitionTo(newState: State): void {
    this.state = newState;

    switch (newState) {
      case State.Playing:
        this.ui.showPlaying();
        this.ui.hidePause();
        break;

      case State.Paused:
        this.ui.showPause();
        break;

      case State.Dead:
        this.deaths++;
        this.audio.death();
        this.ui.showDead();
        break;

      case State.Won:
        this.audio.win();
        this.ui.showWon(this.playTime);
        break;
    }
  }

  private restartLevel(): void {
    this.level.load(0, this.renderer.scene, this.player);
    this.player.reset(this.level.spawn);
    this.playTime = 0;
    this.accumulator = 0;
    this.elapsedTime = 0;
    this.prevCoins = 0;
    this.transitionTo(State.Playing);
  }
}
