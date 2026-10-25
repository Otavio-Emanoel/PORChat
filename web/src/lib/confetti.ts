/**
 * Zero-dependency Canvas Confetti Engine for Winner Celebrations & Podium
 */

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  alpha: number;
}

const CONFETTI_COLORS = [
  '#FF7675', // Coral
  '#00CEC9', // Mint
  '#FDCB6E', // Sun Yellow
  '#6C5CE7', // Violet
  '#FF6B6B', // Red
  '#48DBFB', // Ocean
  '#FECA57', // Gold
  '#FFFFFF', // White
];

export function launchConfetti(canvas: HTMLCanvasElement | null, durationMs = 4000) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles: Particle[] = [];
  const particleCount = 120;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 300,
      y: canvas.height * 0.6 + (Math.random() - 0.5) * 100,
      size: Math.random() * 8 + 6,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      vx: (Math.random() - 0.5) * 18,
      vy: -(Math.random() * 15 + 10),
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      alpha: 1,
    });
  }

  const startTime = Date.now();

  function render() {
    if (!ctx || !canvas) return;
    const elapsed = Date.now() - startTime;
    if (elapsed > durationMs) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // Gravity
      p.vx *= 0.99; // Air friction
      p.rotation += p.vRot;

      if (elapsed > durationMs - 1000) {
        p.alpha = Math.max(0, (durationMs - elapsed) / 1000);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}
