import { WORLD, RADII } from './game/core.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WORLD.width * dpr;
  canvas.height = WORLD.height * dpr;
  ctx.scale(dpr, dpr);

  function wrapped(body, draw, repeat = true) {
    for (const dx of repeat ? [-WORLD.width, 0, WORLD.width] : [0]) {
      for (const dy of repeat ? [-WORLD.height, 0, WORLD.height] : [0]) {
        ctx.save();
        ctx.translate(body.x + dx, body.y + dy);
        ctx.rotate(body.angle || 0);
        draw();
        ctx.restore();
      }
    }
  }

  function drawAsteroid(rock, stroke = '#8ba3b8', fill = '#14223699') {
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let vertex = 0; vertex <= 10; vertex++) {
      const n = vertex % 10;
      const angle = n / 10 * Math.PI * 2;
      const radius = RADII[rock.size] * (0.84 + Math.sin(rock.id * 7 + n * 13) * 0.15);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (vertex === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  return function render(state, thrust = false) {
    ctx.fillStyle = '#080e18';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.strokeStyle = '#172538';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < WORLD.width; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
    }
    for (let y = 0; y < WORLD.height; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
    }
    for (let i = 0; i < 65; i++) {
      ctx.fillStyle = i % 4 === 0 ? '#597287' : '#2e4052';
      ctx.fillRect((i * 137.3) % WORLD.width, (i * 97.7) % WORLD.height, 1.5, 1.5);
    }
    ctx.lineWidth = 1.5;
    for (const rock of state.asteroids) {
      wrapped(rock, () => drawAsteroid(rock), state.settings.mode !== 'survival');
    }
    ctx.fillStyle = '#ffd29a';
    for (const shot of state.bullets) {
      wrapped(shot, () => { ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill(); }, state.settings.mode !== 'survival');
    }
    ctx.fillStyle = '#ff6f72';
    for (const shot of state.enemyBullets) {
      wrapped(shot, () => { ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); });
    }
    for (const drone of state.drones) {
      wrapped(drone, () => {
        ctx.strokeStyle = '#ff8b8e'; ctx.fillStyle = '#481c2a'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-9, -10); ctx.lineTo(-4, 0); ctx.lineTo(-9, 10);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff6f72';
        ctx.beginPath(); ctx.arc(2, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      });
    }
    if (state.status === 'gameover') return;
    if (state.ship.invulnerable > 0 && Math.floor(state.elapsed * 10) % 2 === 0) return;
    if (state.settings.mode === 'drone-escape') {
      wrapped(state.ship, () => {
        if (thrust) {
          ctx.strokeStyle = '#ffbc7c'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, RADII[state.lives] + 6, Math.PI * 0.7, Math.PI * 1.3); ctx.stroke();
        }
        drawAsteroid({ ...state.ship, id: 0, size: state.lives }, '#e0b685', '#3b2b2099');
      });
      return;
    }
    wrapped(state.ship, () => {
      if (thrust) {
        ctx.strokeStyle = '#ffbc7c';
        ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-23 - Math.sin(state.elapsed * 45) * 5, 0); ctx.lineTo(-10, 5); ctx.stroke();
      }
      ctx.strokeStyle = '#8bf2c0'; ctx.fillStyle = '#163c33'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-11, -11); ctx.lineTo(-6, 0); ctx.lineTo(-11, 11); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }, state.settings.mode !== 'survival');
  };
}
