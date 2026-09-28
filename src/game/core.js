// Simulation uses seconds and logical pixels; browser rendering is a separate adapter.
import { WORLD, RADII, wrap, toroidalDistance } from './world.js';
import { makeAsteroid, spawnWave, spawnIncoming } from './spawn.js';
import { createRally, prepareRally, advanceRally, rallySpawnInterval, RALLY } from './rally.js';
export { WORLD, RADII, toroidalDistance } from './world.js';
import { updateUfo, resolveUfoHits } from './ufo.js';
const POINTS = { 1: 100, 2: 50, 3: 20 };
const SHIP_RADIUS = 12;

export function validateSettings({
  seed, asteroidCount, asteroidSpeed, mode = 'waves',
  durationSeconds = 60, spawnIntervalSeconds = 1.25, ufoEnabled = false,
  requiredHits,
}) {
  if (typeof ufoEnabled !== 'boolean' || (ufoEnabled && mode !== 'survival')) throw new TypeError('UFO requires survival mode and a boolean flag');
  if (!['waves', 'clear', 'survival', 'dream-rally'].includes(mode)) throw new TypeError('unknown mission mode');
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 600) {
    throw new RangeError('durationSeconds must be between 1 and 600');
  }
  if (!Number.isFinite(spawnIntervalSeconds) || spawnIntervalSeconds < 0.25 || spawnIntervalSeconds > 10) {
    throw new RangeError('spawnIntervalSeconds must be between 0.25 and 10');
  }
  if (mode === 'dream-rally' && durationSeconds < 45) throw new RangeError('dream-rally needs at least 45 seconds');
  if (!Number.isSafeInteger(seed)) throw new TypeError('seed must be a safe integer');
  if (!Number.isInteger(asteroidCount) || asteroidCount < 1 || asteroidCount > 30) {
    throw new RangeError('asteroidCount must be between 1 and 30');
  }
  if (!Number.isFinite(asteroidSpeed) || asteroidSpeed <= 0) {
    throw new RangeError('asteroidSpeed must be finite and positive');
  }
  if (requiredHits !== undefined && (!Number.isInteger(requiredHits) || requiredHits < 0 || requiredHits > 1000)) {
    throw new RangeError('requiredHits must be an integer between 0 and 1000');
  }
}

export function createGame(options = {}) {
  const {
    seed = 1, asteroidCount = 5, asteroidSpeed = 1, mode = 'waves',
    durationSeconds = 60, spawnIntervalSeconds = 1.25, ufoEnabled = false,
    requiredHits,
  } = options;
  const settings = { seed, asteroidCount, asteroidSpeed, mode, durationSeconds, spawnIntervalSeconds, ufoEnabled };
  if (requiredHits !== undefined) settings.requiredHits = requiredHits;
  validateSettings(settings);
  const state = {
    status: 'playing', score: 0, lives: 3, wave: 1, elapsed: 0, destroyed: 0,
    spawnCountdown: spawnIntervalSeconds,
    settings, rng: seed >>> 0, nextId: 1, ship: newShip(),
    asteroids: [], bullets: [], ufo: null, enemyBullets: [], ufoCountdown: 2, ufosDestroyed: 0,
  };
  spawnWave(state);
  if (mode === 'dream-rally') state.rally = createRally(state);
  return state;
}

function newShip() {
  return {
    x: WORLD.width / 2, y: WORLD.height / 2, vx: 0, vy: 0,
    angle: -Math.PI / 2, cooldown: 0, invulnerable: 0,
  };
}

function distanceToRock(state, body, rock) {
  return ['survival', 'dream-rally'].includes(state.settings.mode)
    ? Math.hypot(body.x - rock.x, body.y - rock.y)
    : toroidalDistance(body, rock);
}

function move(body, dt) {
  body.x = wrap(body.x + body.vx * dt, WORLD.width);
  body.y = wrap(body.y + body.vy * dt, WORLD.height);
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
  const limit = state.rally?.dashRemaining > 0 ? RALLY.dashSpeed : 340;
  const scale = speed > limit ? limit / speed : 1;
  ship.vx *= scale * Math.exp(-0.12 * dt);
  ship.vy *= scale * Math.exp(-0.12 * dt);
  move(ship, dt);
  if (input.fire && ship.cooldown <= 0) {
    const powered = state.rally?.powerRemaining > 0;
    ship.cooldown = powered ? 0.13 : 0.18;
    for (const spread of powered ? [-0.18, 0, 0.18] : [0]) {
      const angle = ship.angle + spread;
      state.bullets.push({
        id: state.nextId++,
        x: wrap(ship.x + Math.cos(angle) * 19, WORLD.width),
        y: wrap(ship.y + Math.sin(angle) * 19, WORLD.height),
        vx: Math.cos(angle) * 550 + ship.vx,
        vy: Math.sin(angle) * 550 + ship.vy,
        ttl: 1.25,
      });
    }
  }
}

function resolveHits(state) {
  const destroyed = new Set();
  const spent = new Set();
  const fragments = [];
  for (const shot of state.bullets) {
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
  state.asteroids = state.asteroids.filter(rock => !destroyed.has(rock.id)).concat(fragments);
  const enemyHit = resolveUfoHits(state);
  if (state.ship.invulnerable > 0) return;
  const hit = state.asteroids.some(rock =>
    distanceToRock(state, state.ship, rock) < SHIP_RADIUS + RADII[rock.size]);
  if (!hit && !enemyHit) return;
  damageShip(state);
}

function damageShip(state) {
  if (state.status !== 'playing' || state.ship.invulnerable > 0) return;
  if (state.rally?.shields > 0) {
    state.rally.shields--;
    state.ship.invulnerable = 1;
    return;
  }
  state.lives--;
  if (state.lives === 0) {
    state.status = 'gameover';
  } else {
    state.ship = { ...newShip(), invulnerable: 2 };
    if (state.rally) { state.rally.dashRemaining = 0; state.rally.powerRemaining = 0; }
  }
}

/** Return a new state. dt is in seconds; callers should use a fixed 1/60 step. */
export function stepGame(previous, input = {}, dt = 1 / 60) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('time step must be finite and non-negative');
  if (previous.status !== 'playing' || dt === 0) return previous;
  const state = structuredClone(previous);
  dt = Math.min(dt, 0.05);
  const survival = ['survival', 'dream-rally'].includes(state.settings.mode);
  if (survival) dt = Math.min(dt, Math.max(0, state.settings.durationSeconds - state.elapsed));
  state.elapsed = survival ? Math.min(state.settings.durationSeconds, state.elapsed + dt) : state.elapsed + dt;
  if (state.rally) prepareRally(state, input, dt);
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
  updateUfo(state, dt);
  resolveHits(state);
  // Collision loss takes precedence over completing an objective in the same step.
  if (state.status !== 'playing') return state;
  if (state.rally) {
    advanceRally(state, dt, damageShip);
    if (state.status !== 'playing') return state;
    state.spawnCountdown -= dt;
    if (state.spawnCountdown <= 0) {
      spawnIncoming(state);
      state.spawnCountdown += rallySpawnInterval(state);
    }
    return state;
  }
  if (survival) {
    if (state.elapsed >= state.settings.durationSeconds) {
      state.status = state.destroyed >= (state.settings.requiredHits ?? 0) ? 'won' : 'gameover';
    } else {
      state.spawnCountdown -= dt;
      if (state.spawnCountdown <= 0) {
        spawnIncoming(state);
        state.spawnCountdown += state.settings.spawnIntervalSeconds;
      }
    }
  } else if (state.asteroids.length === 0) {
    if (state.settings.mode === 'clear') state.status = 'won';
    else { state.wave++; spawnWave(state); }
  }
  return state;
}
