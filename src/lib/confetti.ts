// Lightweight confetti effect without external dependencies
export function fireConfetti() {
  const colors = ['#0C5BA8', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#F97316'];
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden';
  document.body.appendChild(container);

  for (let i = 0; i < 60; i++) {
    const particle = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 8 + 4;
    const left = Math.random() * 100;
    const delay = Math.random() * 600;
    const duration = Math.random() * 1500 + 1500;
    const rotation = Math.random() * 720 - 360;

    particle.style.cssText = `
      position:absolute;
      width:${size}px;height:${size}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      left:${left}%;top:-10px;
      opacity:1;
      animation:confetti-fall ${duration}ms ${delay}ms ease-in forwards;
    `;
    container.appendChild(particle);
  }

  // Add keyframes if not present
  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => container.remove(), 3000);
}
