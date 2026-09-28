import { WORLD } from './world.js';

const UFO_RADIUS = 25;
const RESPAWN_SECONDS = 5;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Enemies cross the visible field; neither they nor their shots wrap at the edges.
export function updateUfo(state, dt) {
  if (!state.settings.ufoEnabled) return;
  for (const shot of state.enemyBullets) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.ttl -= dt;
  }
  state.enemyBullets = state.enemyBullets.filter(s => s.ttl > 0
    && s.x >= -5 && s.x <= WORLD.width + 5 && s.y >= -5 && s.y <= WORLD.height + 5);
  if (!state.ufo) {
    state.ufoCountdown -= dt;
    if (state.ufoCountdown > 0) return;
    const y = state.ship.y < WORLD.height / 2 ? WORLD.height - 100 : 100;
    state.ufo = { id: state.nextId++, x: -UFO_RADIUS, y, vx: 110, cooldown: 1.5 };
  }
  const ufo = state.ufo;
  ufo.x += ufo.vx * dt;
  if (ufo.x > WORLD.width + UFO_RADIUS) {
    state.ufo = null;
    state.ufoCountdown = RESPAWN_SECONDS;
    return;
  }
  ufo.cooldown -= dt;
  if (ufo.cooldown <= 0 && ufo.x >= UFO_RADIUS && ufo.x <= WORLD.width - UFO_RADIUS) {
    const angle = Math.atan2(state.ship.y - ufo.y, state.ship.x - ufo.x);
    state.enemyBullets.push({ id: state.nextId++, x: ufo.x, y: ufo.y,
      vx: Math.cos(angle) * 210, vy: Math.sin(angle) * 210, ttl: 5 });
    ufo.cooldown = 1.5;
  }
}

export function resolveUfoHits(state) {
  if (!state.settings.ufoEnabled) return false;
  if (state.ufo) {
    const shot = state.bullets.find(s => distance(s, state.ufo) <= UFO_RADIUS + 2);
    if (shot) {
      state.bullets = state.bullets.filter(s => s.id !== shot.id);
      state.ufo = null;
      state.ufoCountdown = RESPAWN_SECONDS;
      state.score += 200;
      state.ufosDestroyed++;
    }
  }
  const hits = state.enemyBullets.filter(s => distance(s, state.ship) < 17);
  const spent = new Set(hits.map(s => s.id));
  state.enemyBullets = state.enemyBullets.filter(s => !spent.has(s.id));
  return hits.length > 0 || Boolean(state.ufo && distance(state.ufo, state.ship) < UFO_RADIUS + 12);
}
