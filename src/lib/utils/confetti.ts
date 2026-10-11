import confetti from 'canvas-confetti';

export function triggerDailyCelebration() {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    colors: ['#FF3B30', '#E02D24', '#FF6961'],
  });

  fire(0.2, {
    spread: 60,
    colors: ['#6366F1', '#818CF8', '#A5B4FC'],
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    colors: ['#F59E0B', '#FBBF24', '#FCD34D'],
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    colors: ['#EC4899', '#F472B6'],
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    colors: ['#06B6D4', '#22D3EE'],
  });
}
