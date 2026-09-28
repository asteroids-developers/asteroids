import { GOBLIN_MAX_HP, GOBLIN_RADIUS, WORLD, RADII } from './game/core.js';

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
      wrapped(rock, () => {
        ctx.strokeStyle = '#8ba3b8';
        ctx.fillStyle = '#14223699';
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
      }, state.settings.mode !== 'survival');
    }
    if (state.goblin) {
      wrapped(state.goblin, () => {
        ctx.lineWidth = 2;
        ctx.fillStyle = '#234832';
        ctx.strokeStyle = '#8bf2c0';
        ctx.beginPath();
        ctx.ellipse(0, 3, GOBLIN_RADIUS * 0.82, GOBLIN_RADIUS, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1d3a2b';
        ctx.strokeStyle = '#6ac690';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(side * 18, -9);
          ctx.lineTo(side * 39, -23);
          ctx.lineTo(side * 27, 5);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = '#d6ff9a';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(side * 9, -6, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#07130c';
          ctx.beginPath();
          ctx.arc(side * 10, -5, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#d6ff9a';
        }
        ctx.strokeStyle = '#b6ffdb';
        ctx.beginPath();
        ctx.moveTo(-13, -15); ctx.lineTo(-4, -12);
        ctx.moveTo(4, -12); ctx.lineTo(13, -15);
        ctx.stroke();
        ctx.fillStyle = '#ffd29a';
        ctx.beginPath();
        ctx.moveTo(0, -1); ctx.lineTo(-4, 7); ctx.lineTo(4, 7);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#d6ff9a';
        ctx.beginPath();
        ctx.arc(0, 10, 11, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      });
      const hp = Math.max(0, Math.min(GOBLIN_MAX_HP, state.goblin.hp ?? GOBLIN_MAX_HP));
      const width = 58;
      const height = 5;
      for (const dx of [-WORLD.width, 0, WORLD.width]) {
        for (const dy of [-WORLD.height, 0, WORLD.height]) {
          const x = state.goblin.x + dx - width / 2;
          const y = state.goblin.y + dy - GOBLIN_RADIUS - 15;
          ctx.fillStyle = '#172538';
          ctx.fillRect(x, y, width, height);
          ctx.fillStyle = '#8bf2c0';
          ctx.fillRect(x, y, width * hp / GOBLIN_MAX_HP, height);
          ctx.strokeStyle = '#d6ff9a';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
        }
      }
    }
    ctx.fillStyle = '#ffd29a';
    for (const shot of state.bullets) {
      wrapped(shot, () => { ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill(); }, state.settings.mode !== 'survival');
    }
    if (state.status === 'gameover') return;
    if (state.ship.invulnerable > 0 && Math.floor(state.elapsed * 10) % 2 === 0) return;
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
