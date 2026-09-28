import { WORLD, RADII } from './game/core.js';
import { RALLY } from './game/rally.js';

const PALETTES = {
  classic: {
    background: '#080e18', grid: '#172538', star: '#597287', faintStar: '#2e4052',
    rock: '#8ba3b8', rockFill: '#14223699', shot: '#ffd29a', flame: '#ffbc7c',
    ship: '#8bf2c0', shipFill: '#163c33',
  },
  pink: {
    background: '#200d29', grid: '#42203f', star: '#ffd0ed', faintStar: '#955482',
    rock: '#eea0d3', rockFill: '#8a2b6744', shot: '#fff0aa', flame: '#ffb5e1',
    ship: '#fff0fa', shipFill: '#ed2595',
  },
};

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

  return function render(state, thrust = false, theme = 'classic') {
    const palette = PALETTES[theme] || PALETTES.classic;
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < WORLD.width; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
    }
    for (let y = 0; y < WORLD.height; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
    }
    for (let i = 0; i < 65; i++) {
      ctx.fillStyle = i % 4 === 0 ? palette.star : palette.faintStar;
      const x = (i * 137.3) % WORLD.width;
      const y = (i * 97.7) % WORLD.height;
      ctx.fillRect(x, y, 1.5, 1.5);
      if (theme === 'pink' && i % 4 === 0) {
        ctx.fillRect(x - 3, y, 7.5, 1.5);
        ctx.fillRect(x, y - 3, 1.5, 7.5);
      }
    }
    if (state.rally) {
      for (const hazard of state.rally.hazards) {
        const active = hazard.age >= 0;
        ctx.fillStyle = active ? '#ff429aaa' : '#ff80cd16';
        ctx.fillRect(0, hazard.y - 18, WORLD.width, 36);
        ctx.strokeStyle = active ? '#fff0fa' : '#ff8ecd';
        ctx.lineWidth = active ? 3 : 1;
        ctx.setLineDash(active ? [] : [12, 10]);
        ctx.beginPath(); ctx.moveTo(0, hazard.y); ctx.lineTo(WORLD.width, hazard.y); ctx.stroke();
        ctx.setLineDash([]);
        if (!active) { ctx.fillStyle = '#ffe1f3'; ctx.font = '12px system-ui'; ctx.fillText('ОСТОРОЖНО: ЛАЗЕР', 18, hazard.y - 26); }
      }
      if (state.rally.phase === 'escape') {
        const gate = RALLY.gate;
        ctx.save(); ctx.translate(gate.x, gate.y);
        ctx.strokeStyle = '#fff0ad'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, gate.radius + Math.sin(state.elapsed * 5) * 3, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ff8ecd44'; ctx.fill();
        ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff0ad';
        ctx.fillText('ДРИМХАУС', 0, -65);
        ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, -21); ctx.lineTo(22, 0); ctx.lineTo(17, 0); ctx.lineTo(17, 22); ctx.lineTo(-17, 22); ctx.lineTo(-17, 0); ctx.closePath(); ctx.stroke();
        ctx.restore();
      }
      for (const heart of state.rally.pickups) {
        ctx.save(); ctx.translate(heart.x, heart.y);
        const pulse = 1 + Math.sin(state.elapsed * 5 + heart.id) * 0.1;
        ctx.scale(pulse, pulse);
        ctx.fillStyle = '#ff4ca7'; ctx.strokeStyle = '#ffe1f3'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 12);
        ctx.bezierCurveTo(-24, -3, -12, -21, 0, -10);
        ctx.bezierCurveTo(12, -21, 24, -3, 0, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.lineWidth = 1.5;
    for (const rock of state.asteroids) {
      wrapped(rock, () => {
        ctx.strokeStyle = palette.rock;
        ctx.fillStyle = palette.rockFill;
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
      }, !['survival', 'dream-rally'].includes(state.settings.mode));
    }
    ctx.fillStyle = palette.shot;
    for (const shot of state.bullets) {
      wrapped(shot, () => { ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill(); }, !['survival', 'dream-rally'].includes(state.settings.mode));
    }
    if (state.status === 'gameover') return;
    if (state.ship.invulnerable > 0 && Math.floor(state.elapsed * 10) % 2 === 0) return;
    wrapped(state.ship, () => {
      if (state.rally?.shields > 0 || state.rally?.dashRemaining > 0) {
        ctx.strokeStyle = state.rally.dashRemaining > 0 ? '#fff0ad' : '#ff8ecd';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 25 + (state.rally.shields > 1 ? 4 : 0), 0, Math.PI * 2); ctx.stroke();
      }
      if (state.rally?.dashRemaining > 0) {
        ctx.strokeStyle = '#fff0ad88'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(-80, -7); ctx.moveTo(-10, 7); ctx.lineTo(-80, 7); ctx.stroke();
      }
      if (thrust) {
        ctx.strokeStyle = palette.flame;
        ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-23 - Math.sin(state.elapsed * 45) * 5, 0); ctx.lineTo(-10, 5); ctx.stroke();
      }
      ctx.strokeStyle = palette.ship; ctx.fillStyle = palette.shipFill; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-11, -11); ctx.lineTo(-6, 0); ctx.lineTo(-11, 11); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }, !['survival', 'dream-rally'].includes(state.settings.mode));
  };
}
