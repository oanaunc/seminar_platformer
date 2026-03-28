/**
 * Keyboard input manager — 2D side-scroller version.
 * Only left/right horizontal + jump. No forward/backward.
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

  isHeld(code: string): boolean { return this.held.has(code); }
  justPressed(code: string): boolean { return this.justPressedSet.has(code); }
  justReleased(code: string): boolean { return this.justReleasedSet.has(code); }

  endFrame(): void {
    this.justPressedSet.clear();
    this.justReleasedSet.clear();
  }

  get left(): boolean { return this.isHeld('ArrowLeft') || this.isHeld('KeyA'); }
  get right(): boolean { return this.isHeld('ArrowRight') || this.isHeld('KeyD'); }
  get jump(): boolean { return this.justPressed('Space') || this.justPressed('ArrowUp') || this.justPressed('KeyW'); }
  get jumpHeld(): boolean { return this.isHeld('Space') || this.isHeld('ArrowUp') || this.isHeld('KeyW'); }
  get jumpReleased(): boolean { return this.justReleased('Space') || this.justReleased('ArrowUp') || this.justReleased('KeyW'); }
  get run(): boolean { return this.isHeld('ShiftLeft') || this.isHeld('ShiftRight'); }
  get pause(): boolean { return this.justPressed('Escape'); }
  get enter(): boolean { return this.justPressed('Enter'); }
  get restart(): boolean { return this.justPressed('KeyR'); }
  get debugToggle(): boolean { return this.justPressed('F1'); }
}
