/**
 * Plays a subtle, pleasant chime sound when a badge is unlocked.
 * Uses the Web Audio API — no external files or dependencies needed.
 */
export function playAchievementSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Two-note chime: C5 → E5
    const notes = [
      { freq: 523.25, start: 0, duration: 0.25 },
      { freq: 659.25, start: 0.15, duration: 0.35 },
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.15, now + start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });

    // Clean up context after sound finishes
    setTimeout(() => ctx.close(), 600);
  } catch {
    // Silently ignore if Web Audio API is unavailable
  }
}
