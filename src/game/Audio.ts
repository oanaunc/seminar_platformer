/**
 * Minimal audio manager using Web Audio API.
 * Generates simple synthesized sounds — no external files needed.
 */

export class Audio {
  private ctx: AudioContext | null = null;

  private ensureCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', gain = 0.12): void {
    try {
      const ctx = this.ensureCtx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(g).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch { /* audio not supported — silently ignore */ }
  }

  jump(): void {
    this.playTone(520, 0.15, 'square', 0.08);
    setTimeout(() => this.playTone(680, 0.1, 'square', 0.06), 50);
  }

  death(): void {
    this.playTone(200, 0.3, 'sawtooth', 0.15);
    setTimeout(() => this.playTone(140, 0.4, 'sawtooth', 0.12), 150);
  }

  win(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.25, 'square', 0.1), i * 120);
    });
  }

  coin(): void {
    this.playTone(988, 0.08, 'square', 0.08);
    setTimeout(() => this.playTone(1319, 0.15, 'square', 0.06), 60);
  }
}
