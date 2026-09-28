// Web Audio API Sound Generator & Haptics (0 external audio assets needed)

let audioCtx: AudioContext | null = null;
const SOUND_KEY = 'zenith_sound_enabled';

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(SOUND_KEY);
  return stored === null ? true : stored === 'true';
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_KEY, String(enabled));
}

export function triggerHaptic(duration: number | number[] = 15): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration);
    } catch (e) {}
  }
}

/**
 * Crisp, tactile mechanical click sound for completing a habit
 */
export function playCheckSound(): void {
  if (!isSoundEnabled()) return;
  triggerHaptic(15);

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch (e) {}
}

/**
 * Subtle low-pitched click sound for un-checking a habit
 */
export function playUncheckSound(): void {
  if (!isSoundEnabled()) return;
  triggerHaptic(10);

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.06);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch (e) {}
}

/**
 * Ascending chime chord for hitting milestones or 100% daily completion
 */
export function playMilestoneSound(): void {
  if (!isSoundEnabled()) return;
  triggerHaptic([20, 50, 20]);

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startTime = ctx.currentTime + idx * 0.06;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  } catch (e) {}
}

/**
 * 5-note triumphant fanfare for Leveling Up (G4-C5-E5-G5-C6)
 */
export function playLevelUpSound(): void {
  if (!isSoundEnabled()) return;
  triggerHaptic([30, 60, 30, 100]);

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // G4, C5, E5, G5, C6
    const notes = [
      { freq: 392.00, dur: 0.12, gain: 0.18 },
      { freq: 523.25, dur: 0.12, gain: 0.20 },
      { freq: 659.25, dur: 0.12, gain: 0.22 },
      { freq: 783.99, dur: 0.15, gain: 0.24 },
      { freq: 1046.50, dur: 0.45, gain: 0.28 },
    ];

    let offset = 0;
    notes.forEach((note, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startTime = ctx.currentTime + offset;
      const stopTime = startTime + note.dur;

      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(note.freq, startTime);

      gain.gain.setValueAtTime(note.gain, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, stopTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(stopTime);

      offset += (idx === notes.length - 2 ? 0.14 : 0.09);
    });
  } catch (e) {}
}

/**
 * Dual-bell chime for Achievement Codex unlocks (A5-D6)
 */
export function playAchievementSound(): void {
  if (!isSoundEnabled()) return;
  triggerHaptic([25, 50, 25]);

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const bells = [
      { freq: 880.00, time: 0, dur: 0.35 },    // A5
      { freq: 1174.66, time: 0.10, dur: 0.5 }, // D6
    ];

    bells.forEach((bell) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startTime = ctx.currentTime + bell.time;
      const stopTime = startTime + bell.dur;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(bell.freq, startTime);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, stopTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(stopTime);
    });
  } catch (e) {}
}

