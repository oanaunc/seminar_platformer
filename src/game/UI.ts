/**
 * Simple HTML-overlay UI manager.
 * All elements are declared in index.html; this module controls visibility and content.
 */

export class UI {
  private hud = document.getElementById('hud')!;
  private hudTimer = document.getElementById('hud-timer')!;
  private hudDeaths = document.getElementById('hud-deaths')!;
  private hudCoins = document.getElementById('hud-coins')!;
  private overlayStart = document.getElementById('overlay-start')!;
  private overlayPause = document.getElementById('overlay-pause')!;
  private overlayDead = document.getElementById('overlay-dead')!;
  private overlayWon = document.getElementById('overlay-won')!;
  private wonTime = document.getElementById('won-time')!;

  showStart(): void {
    this.hideAll();
    this.overlayStart.classList.remove('hidden');
    this.hud.classList.add('hidden');
  }

  showPlaying(): void {
    this.hideAll();
    this.hud.classList.remove('hidden');
  }

  showPause(): void {
    this.overlayPause.classList.remove('hidden');
  }

  hidePause(): void {
    this.overlayPause.classList.add('hidden');
  }

  showDead(): void {
    this.hideAll();
    this.overlayDead.classList.remove('hidden');
    this.hud.classList.remove('hidden');
  }

  showWon(time: number): void {
    this.hideAll();
    this.wonTime.textContent = `Time: ${time.toFixed(1)}s`;
    this.overlayWon.classList.remove('hidden');
    this.hud.classList.remove('hidden');
  }

  updateHUD(time: number, deaths: number, coins: number, coinsTotal: number): void {
    this.hudTimer.textContent = `Time: ${time.toFixed(1)}s`;
    this.hudDeaths.textContent = `Deaths: ${deaths}`;
    this.hudCoins.textContent = `Coins: ${coins}/${coinsTotal}`;
  }

  private hideAll(): void {
    this.overlayStart.classList.add('hidden');
    this.overlayPause.classList.add('hidden');
    this.overlayDead.classList.add('hidden');
    this.overlayWon.classList.add('hidden');
  }
}
