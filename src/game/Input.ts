/**
 * Keyboard input manager.
 * Tracks which keys are currently held, plus one-shot "just pressed" queries.
 */

export class Input {
  private held = new Set<string>();
  private justPressedSet = new Set<string>();
  private justReleasedSet = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.held.has(e.code)) {
        this.justPressedSet.add(e.code);
      }
      this.held.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
      this.justReleasedSet.add(e.code);
    });
  }

  isHeld(code: string): boolean {
    return this.held.has(code);
  }

  justPressed(code: string): boolean {
    return this.justPressedSet.has(code);
  }

  justReleased(code: string): boolean {
    return this.justReleasedSet.has(code);
  }

  /** Call once per frame AFTER all game logic has read input. */
  endFrame(): void {
    this.justPressedSet.clear();
    this.justReleasedSet.clear();
  }

  // Convenience helpers
  get left(): boolean {
    return this.isHeld('ArrowLeft') || this.isHeld('KeyA');
  }
  get right(): boolean {
    return this.isHeld('ArrowRight') || this.isHeld('KeyD');
  }
  get forward(): boolean {
    return this.isHeld('ArrowUp') || this.isHeld('KeyW');
  }
  get backward(): boolean {
    return this.isHeld('ArrowDown') || this.isHeld('KeyS');
  }
  get jump(): boolean {
    return this.justPressed('Space');
  }
  get jumpHeld(): boolean {
    return this.isHeld('Space');
  }
  get jumpReleased(): boolean {
    return this.justReleased('Space');
  }
  get run(): boolean {
    return this.isHeld('ShiftLeft') || this.isHeld('ShiftRight');
  }
  get pause(): boolean {
    return this.justPressed('Escape');
  }
  get enter(): boolean {
    return this.justPressed('Enter');
  }
  get restart(): boolean {
    return this.justPressed('KeyR');
  }
  get debugToggle(): boolean {
    return this.justPressed('F1');
  }
}
