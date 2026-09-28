// Simulation uses seconds and logical pixels; browser rendering is a separate adapter.
import { WORLD, RADII, wrap, toroidalDistance } from './world.js';
import { makeAsteroid, spawnWave, spawnIncoming } from './spawn.js';
export { WORLD, RADII, toroidalDistance } from './world.js';
const POINTS = { 1: 100, 2: 50, 3: 20 };
const SHIP_RADIUS = 12;
const ENEMY_RADIUS = 14;
const BOSS_RADIUS = 28;
const ENEMY_POSITIONS = [[120, 120], [840, 120], [120, 520]];

export function validateSettings({
  seed, asteroidCount, asteroidSpeed, mode = 'waves',
  durationSeconds = 60, spawnIntervalSeconds = 1.25, enemyCount = 0, bossLives = 0,
}) {
  if (!['waves', 'clear', 'survival', 'combat'].includes(mode)) throw new TypeError('unknown mission mode');
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 600) {
    throw new RangeError('durationSeconds must be between 1 and 600');
  }
  if (!Number.isFinite(spawnIntervalSeconds) || spawnIntervalSeconds < 0.25 || spawnIntervalSeconds > 10) {
    throw new RangeError('spawnIntervalSeconds must be between 0.25 and 10');
  }
  if (!Number.isSafeInteger(seed)) throw new TypeError('seed must be a safe integer');
  if (!Number.isInteger(asteroidCount) || asteroidCount < (mode === 'combat' ? 0 : 1) || asteroidCount > 30) {
    throw new RangeError('asteroidCount must be between 0 and 30 in combat, or 1 and 30 otherwise');
  }
  if (!Number.isInteger(enemyCount) || enemyCount < 0 || enemyCount > 3 || (mode === 'combat' && enemyCount < 1) || (mode !== 'combat' && enemyCount !== 0)) {
    throw new RangeError('enemyCount must be 1 to 3 in combat and 0 otherwise');
  }
  if (!Number.isInteger(bossLives) || bossLives < 0 || bossLives > 20 || (mode !== 'combat' && bossLives !== 0)) {
    throw new RangeError('bossLives must be 0 to 20 in combat and 0 otherwise');
  }
  if (!Number.isFinite(asteroidSpeed) || asteroidSpeed <= 0) {
    throw new RangeError('asteroidSpeed must be finite and positive');
  }
}

export function createGame({
  seed = 1, asteroidCount = 5, asteroidSpeed = 1, mode = 'waves',
  durationSeconds = 60, spawnIntervalSeconds = 1.25, enemyCount = 0, bossLives = 0,
} = {}) {
  const settings = { seed, asteroidCount, asteroidSpeed, mode, durationSeconds, spawnIntervalSeconds, enemyCount, bossLives };
  validateSettings(settings);
  const state = {
    status: 'playing', score: 0, lives: 3, wave: 1, elapsed: 0, destroyed: 0,
    spawnCountdown: spawnIntervalSeconds,
    settings, rng: seed >>> 0, nextId: 1, ship: newShip(),
    asteroids: [], bullets: [], enemies: [], enemyBullets: [], enemiesDestroyed: 0,
    boss: null, bossHits: 0,
  };
  if (asteroidCount > 0) spawnWave(state);
  if (mode === 'combat') state.enemies = ENEMY_POSITIONS.slice(0, enemyCount).map(([x, y]) => ({
    id: state.nextId++, x, y, angle: 0, cooldown: 1.5,
  }));
  if (bossLives > 0) state.boss = { id: state.nextId++, x: 840, y: 520,
    angle: 0, cooldown: 2, lives: bossLives };
  return state;
}

function newShip() {
  return {
    x: WORLD.width / 2, y: WORLD.height / 2, vx: 0, vy: 0,
    angle: -Math.PI / 2, cooldown: 0, invulnerable: 0,
  };
}

function distanceToRock(state, body, rock) {
  return state.settings.mode === 'survival'
    ? Math.hypot(body.x - rock.x, body.y - rock.y)
    : toroidalDistance(body, rock);
}

function move(body, dt) {
  body.x = wrap(body.x + body.vx * dt, WORLD.width);
  body.y = wrap(body.y + body.vy * dt, WORLD.height);
}

function toward(from, to) {
  const dx = ((to.x - from.x + WORLD.width * 1.5) % WORLD.width) - WORLD.width / 2;
  const dy = ((to.y - from.y + WORLD.height * 1.5) % WORLD.height) - WORLD.height / 2;
  return Math.atan2(dy, dx);
}

function advanceEnemies(state, dt) {
  for (const enemy of state.enemies) {
    enemy.angle = toward(enemy, state.ship);
    enemy.x = wrap(enemy.x + Math.cos(enemy.angle) * 55 * dt, WORLD.width);
    enemy.y = wrap(enemy.y + Math.sin(enemy.angle) * 55 * dt, WORLD.height);
    enemy.cooldown -= dt;
    if (enemy.cooldown <= 0) {
      state.enemyBullets.push({ id: state.nextId++, x: enemy.x, y: enemy.y,
        vx: Math.cos(enemy.angle) * 190, vy: Math.sin(enemy.angle) * 190, ttl: 2.5 });
      enemy.cooldown += 1.5;
    }
  }
  if (state.boss) {
    const boss = state.boss;
    boss.angle = toward(boss, state.ship);
    boss.x = wrap(boss.x + Math.cos(boss.angle) * 35 * dt, WORLD.width);
    boss.y = wrap(boss.y + Math.sin(boss.angle) * 35 * dt, WORLD.height);
    boss.cooldown -= dt;
    if (boss.cooldown <= 0) {
      state.enemyBullets.push({ id: state.nextId++, x: boss.x, y: boss.y,
        vx: Math.cos(boss.angle) * 220, vy: Math.sin(boss.angle) * 220, ttl: 2.5 });
      boss.cooldown += 1.2;
    }
  }
  for (const shot of state.enemyBullets) { move(shot, dt); shot.ttl -= dt; }
  state.enemyBullets = state.enemyBullets.filter(shot => shot.ttl > 0);
}

function steer(state, input, dt) {
  const ship = state.ship;
  ship.invulnerable = Math.max(0, ship.invulnerable - dt);
  ship.cooldown = Math.max(0, ship.cooldown - dt);
  ship.angle += (Number(Boolean(input.right)) - Number(Boolean(input.left))) * 3.6 * dt;
  if (input.thrust) {
    ship.vx += Math.cos(ship.angle) * 230 * dt;
    ship.vy += Math.sin(ship.angle) * 230 * dt;
  }
  const speed = Math.hypot(ship.vx, ship.vy);
  const scale = speed > 340 ? 340 / speed : 1;
  ship.vx *= scale * Math.exp(-0.12 * dt);
  ship.vy *= scale * Math.exp(-0.12 * dt);
  move(ship, dt);
  if (input.fire && ship.cooldown <= 0) {
    ship.cooldown = 0.18;
    state.bullets.push({
      id: state.nextId++,
      x: wrap(ship.x + Math.cos(ship.angle) * 19, WORLD.width),
      y: wrap(ship.y + Math.sin(ship.angle) * 19, WORLD.height),
      vx: Math.cos(ship.angle) * 550 + ship.vx,
      vy: Math.sin(ship.angle) * 550 + ship.vy,
      ttl: 1.25,
    });
  }
}

function resolveHits(state) {
  const destroyed = new Set();
  const spent = new Set();
  const defeated = new Set();
  const fragments = [];
  for (const shot of state.bullets) {
    for (const enemy of state.enemies) {
      if (defeated.has(enemy.id) || toroidalDistance(shot, enemy) > ENEMY_RADIUS + 2) continue;
      defeated.add(enemy.id);
      spent.add(shot.id);
      state.enemiesDestroyed++;
      state.score += 200;
      break;
    }
    if (spent.has(shot.id)) continue;
    if (state.boss && toroidalDistance(shot, state.boss) <= BOSS_RADIUS + 2) {
      state.boss.lives--;
      state.bossHits++;
      spent.add(shot.id);
      if (state.boss.lives === 0) {
        state.boss = null;
        state.score += 500;
      }
      continue;
    }
    for (const rock of state.asteroids) {
      if (destroyed.has(rock.id)) continue;
      if (distanceToRock(state, shot, rock) > RADII[rock.size] + 2) continue;
      destroyed.add(rock.id);
      spent.add(shot.id);
      state.score += POINTS[rock.size];
      state.destroyed++;
      if (rock.size > 1) {
        fragments.push(makeAsteroid(state, rock.x, rock.y, rock.size - 1));
        fragments.push(makeAsteroid(state, rock.x, rock.y, rock.size - 1));
      }
      break;
    }
  }
  state.bullets = state.bullets.filter(shot => !spent.has(shot.id));
  state.enemies = state.enemies.filter(enemy => !defeated.has(enemy.id));
  state.asteroids = state.asteroids.filter(rock => !destroyed.has(rock.id)).concat(fragments);
  if (state.ship.invulnerable > 0) return;
  const hit = state.asteroids.some(rock =>
    distanceToRock(state, state.ship, rock) < SHIP_RADIUS + RADII[rock.size])
    || state.enemies.some(enemy => toroidalDistance(state.ship, enemy) < SHIP_RADIUS + ENEMY_RADIUS)
    || (state.boss && toroidalDistance(state.ship, state.boss) < SHIP_RADIUS + BOSS_RADIUS)
    || state.enemyBullets.some(shot => toroidalDistance(state.ship, shot) < SHIP_RADIUS + 3);
  if (!hit) return;
  state.lives--;
  if (state.lives === 0) {
    state.status = 'gameover';
  } else {
    state.ship = { ...newShip(), invulnerable: 2 };
  }
}

/** Return a new state. dt is in seconds; callers should use a fixed 1/60 step. */
export function stepGame(previous, input = {}, dt = 1 / 60) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('time step must be finite and non-negative');
  if (previous.status !== 'playing' || dt === 0) return previous;
  const state = structuredClone(previous);
  dt = Math.min(dt, 0.05);
  const survival = state.settings.mode === 'survival';
  if (survival) dt = Math.min(dt, Math.max(0, state.settings.durationSeconds - state.elapsed));
  state.elapsed = survival ? Math.min(state.settings.durationSeconds, state.elapsed + dt) : state.elapsed + dt;
  steer(state, input, dt);
  for (const rock of state.asteroids) {
    if (survival) {
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      const radius = RADII[rock.size];
      if (rock.y < radius || rock.y > WORLD.height - radius) {
        rock.y = Math.max(radius, Math.min(WORLD.height - radius, rock.y));
        rock.vy *= -1;
      }
    } else {
      move(rock, dt);
    }
    rock.angle += rock.spin * dt;
  }
  if (survival) state.asteroids = state.asteroids.filter(rock => rock.x >= -RADII[rock.size]);
  for (const shot of state.bullets) {
    move(shot, dt);
    shot.ttl -= dt;
  }
  state.bullets = state.bullets.filter(shot => shot.ttl > 0);
  if (state.settings.mode === 'combat') advanceEnemies(state, dt);
  resolveHits(state);
  // Collision loss takes precedence over completing an objective in the same step.
  if (state.status !== 'playing') return state;
  if (survival) {
    if (state.elapsed >= state.settings.durationSeconds) {
      state.status = 'won';
    } else {
      state.spawnCountdown -= dt;
      if (state.spawnCountdown <= 0) {
        spawnIncoming(state);
        state.spawnCountdown += state.settings.spawnIntervalSeconds;
      }
    }
  } else if (state.settings.mode === 'combat') {
    if (state.enemies.length === 0 && !state.boss && state.asteroids.length === 0) state.status = 'won';
  } else if (state.asteroids.length === 0) {
    if (state.settings.mode === 'clear') state.status = 'won';
    else { state.wave++; spawnWave(state); }
  }
  return state;
}
