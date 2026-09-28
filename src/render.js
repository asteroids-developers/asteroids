import { WORLD, RADII } from './game/core.js';
import { BOSS_RADIUS, LASER_HALF_WIDTH } from './game/boss.js';

const PHASE_COLORS = ['#8bf2c0', '#f0c06d', '#ff7489'];

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

  function drawLaser(state) {
    const attack = state.boss.attack;
    if (attack?.kind !== 'laser') return;
    const x = attack.laneX;
    const top = state.boss.y + 52;
    const height = WORLD.height - top;
    ctx.save();
    if (attack.stage === 'warning') {
      const pulse = 0.35 + Math.sin(state.elapsed * 22) * 0.15;
      ctx.fillStyle = `rgba(255, 116, 137, ${pulse * 0.32})`;
      ctx.fillRect(x - LASER_HALF_WIDTH, top, LASER_HALF_WIDTH * 2, height);
      ctx.strokeStyle = `rgba(255, 174, 133, ${pulse + 0.25})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.strokeRect(x - LASER_HALF_WIDTH, top, LASER_HALF_WIDTH * 2, height);
      ctx.setLineDash([]);
    } else {
      const glow = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
      glow.addColorStop(0, '#ff748900');
      glow.addColorStop(0.35, '#ff748985');
      glow.addColorStop(0.5, '#ffe5d9ef');
      glow.addColorStop(0.65, '#ff748985');
      glow.addColorStop(1, '#ff748900');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 90, top, 180, height);
      ctx.fillStyle = '#fff1dd99';
      ctx.fillRect(x - 12 + Math.sin(state.elapsed * 38) * 3, top, 24, height);
      ctx.strokeStyle = '#ff839e';
      ctx.lineWidth = 2;
      for (let y = top + (state.elapsed * 240) % 52; y < WORLD.height; y += 52) {
        ctx.beginPath(); ctx.moveTo(x - 56, y); ctx.lineTo(x + 56, y); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawBoss(state) {
    const boss = state.boss;
    const color = PHASE_COLORS[boss.phase - 1];
    const charge = boss.attack?.stage === 'warning';
    const pulse = Math.sin(state.elapsed * 5);
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(Math.sin(state.elapsed * 1.4) * 0.045);
    ctx.shadowColor = color;
    ctx.shadowBlur = 17 + (charge ? 15 : 0) + pulse * 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    // The broken shield ring, armored wings, guns and pointed bow read as one ship.
    ctx.save();
    ctx.rotate(state.elapsed * (boss.phase === 3 ? -1.3 : 0.8));
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath(); ctx.arc(0, 0, BOSS_RADIUS + 27, -0.17, 0.17); ctx.stroke();
    }
    ctx.restore();
    // Twin exhausts give the enemy a clear direction and pulse while it moves.
    for (const side of [-1, 1]) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.38 + Math.sin(state.elapsed * 26 + side) * 0.16;
      ctx.beginPath();
      ctx.moveTo(side * 34 - 8, -46);
      ctx.lineTo(side * 34 + 8, -46);
      ctx.lineTo(side * 34, -78 - Math.sin(state.elapsed * 32 + side) * 10);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = boss.hitFlash > 0 ? '#fff4e8' : '#17283b';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.lineTo(37, -32);
    ctx.lineTo(100, -35);
    ctx.lineTo(82, 14);
    ctx.lineTo(43, 21);
    ctx.lineTo(18, 57);
    ctx.lineTo(0, 68);
    ctx.lineTo(-18, 57);
    ctx.lineTo(-43, 21);
    ctx.lineTo(-82, 14);
    ctx.lineTo(-100, -35);
    ctx.lineTo(-37, -32);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8193a6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-88, -17); ctx.lineTo(-44, 2); ctx.lineTo(-18, 48);
    ctx.moveTo(88, -17); ctx.lineTo(44, 2); ctx.lineTo(18, 48);
    ctx.moveTo(-29, -31); ctx.lineTo(0, -16); ctx.lineTo(29, -31);
    ctx.stroke();
    // Two forward cannons and a lit cockpit react to each phase.
    ctx.fillStyle = color;
    ctx.fillRect(-55, 13, 10, 24);
    ctx.fillRect(45, 13, 10, 24);
    ctx.shadowColor = color;
    ctx.shadowBlur = 17;
    ctx.fillStyle = boss.hitFlash > 0 ? '#fff4e8' : color;
    ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(25, 0); ctx.lineTo(0, 32); ctx.lineTo(-25, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0c1925';
    ctx.beginPath(); ctx.arc(0, 0, 8 + pulse * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55 + pulse * 0.1;
    ctx.fillRect(-75, -20, 18, 5);
    ctx.fillRect(57, -20, 18, 5);
    ctx.globalAlpha = 1;
    if (charge) {
      const bounce = Math.sin(state.elapsed * 20) * 6;
      ctx.fillStyle = '#ffcf9c';
      ctx.font = 'bold 42px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -BOSS_RADIUS - 35 + bounce);
      ctx.strokeStyle = '#ffcf9c99';
      ctx.beginPath(); ctx.arc(0, 0, BOSS_RADIUS + 37 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
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
    if (state.boss) drawLaser(state);
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
      }, !['survival', 'boss'].includes(state.settings.mode));
    }
    ctx.fillStyle = '#ffd29a';
    for (const shot of state.bullets) {
      wrapped(shot, () => { ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill(); }, !['survival', 'boss'].includes(state.settings.mode));
    }
    if (state.boss && state.boss.hp > 0) drawBoss(state);
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
    }, !['survival', 'boss'].includes(state.settings.mode));
  };
}
