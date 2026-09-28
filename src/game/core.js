// Simulation uses seconds and logical pixels; browser rendering is a separate adapter.
import { WORLD, RADII, wrap, toroidalDistance } from './world.js';
import { makeAsteroid, spawnWave, spawnIncoming } from './spawn.js';
export { WORLD, RADII, toroidalDistance } from './world.js';
const POINTS = { 1: 100, 2: 50, 3: 20 };
const SHIP_RADIUS = 12;
const DRONE_RADIUS = 13;
const ENEMY_SHOT_RADIUS = 3;

export function validateSettings({
  seed, asteroidCount, asteroidSpeed, mode = 'waves',
  durationSeconds = 60, spawnIntervalSeconds = 1.25, levelDurationSeconds = 20,
}) {
  if (!['waves', 'clear', 'survival', 'drone-escape'].includes(mode)) throw new TypeError('unknown mission mode');
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 600) {
    throw new RangeError('durationSeconds must be between 1 and 600');
  }
  if (!Number.isFinite(spawnIntervalSeconds) || spawnIntervalSeconds < 0.25 || spawnIntervalSeconds > 10) {
    throw new RangeError('spawnIntervalSeconds must be between 0.25 and 10');
  }
  if (!Number.isFinite(levelDurationSeconds) || levelDurationSeconds < 1 || levelDurationSeconds > 600) {
    throw new RangeError('levelDurationSeconds must be between 1 and 600');
  }
  if (!Number.isSafeInteger(seed)) throw new TypeError('seed must be a safe integer');
  if (!Number.isInteger(asteroidCount) || asteroidCount < 1 || asteroidCount > 30) {
    throw new RangeError('asteroidCount must be between 1 and 30');
  }
  if (!Number.isFinite(asteroidSpeed) || asteroidSpeed <= 0) {
    throw new RangeError('asteroidSpeed must be finite and positive');
  }
}

export function createGame({
  seed = 1, asteroidCount = 5, asteroidSpeed = 1, mode = 'waves',
  durationSeconds = 60, spawnIntervalSeconds = 1.25, levelDurationSeconds = 20,
} = {}) {
  const settings = {
    seed, asteroidCount, asteroidSpeed, mode, durationSeconds, spawnIntervalSeconds,
    levelDurationSeconds,
  };
  validateSettings(settings);
  const state = {
    status: 'playing', score: 0, lives: 3, wave: 1, elapsed: 0, destroyed: 0,
    level: 1, levelElapsed: 0, spawnCountdown: spawnIntervalSeconds,
    settings, rng: seed >>> 0, nextId: 1, ship: newShip(),
    asteroids: [], bullets: [], drones: [], enemyBullets: [],
  };
  if (mode === 'drone-escape') spawnDrone(state);
  else spawnWave(state);
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

function shortestDelta(from, to, limit) {
  let delta = to - from;
  if (delta > limit / 2) delta -= limit;
  if (delta < -limit / 2) delta += limit;
  return delta;
}

function spawnDrone(state) {
  const index = state.drones.length;
  const inset = 70;
  const slots = [
    { x: inset, y: inset },
    { x: WORLD.width - inset, y: WORLD.height - inset },
    { x: WORLD.width - inset, y: inset },
    { x: inset, y: WORLD.height - inset },
  ];
  const base = slots[index % slots.length];
  const lap = Math.floor(index / slots.length);
  state.drones.push({
    id: state.nextId++,
    x: wrap(base.x + lap * 83, WORLD.width),
    y: wrap(base.y + lap * 61, WORLD.height),
    vx: 0,
    vy: 0,
    angle: 0,
    cooldown: 0.7 + (index % 4) * 0.25,
  });
}

function updateDrones(state, dt) {
  for (const drone of state.drones) {
    const dx = shortestDelta(drone.x, state.ship.x, WORLD.width);
    const dy = shortestDelta(drone.y, state.ship.y, WORLD.height);
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / distance;
    const ny = dy / distance;
    const radial = distance > 280 ? 1 : distance < 190 ? -1 : 0;
    const orbit = drone.id % 2 === 0 ? 0.7 : -0.7;
    const targetVx = (nx * radial - ny * orbit) * 115;
    const targetVy = (ny * radial + nx * orbit) * 115;
    const blend = Math.min(1, dt * 2.5);
    drone.vx += (targetVx - drone.vx) * blend;
    drone.vy += (targetVy - drone.vy) * blend;
    move(drone, dt);
    drone.angle = Math.atan2(dy, dx);
    drone.cooldown -= dt;
    if (drone.cooldown > 0) continue;
    const shotSpeed = 285;
    state.enemyBullets.push({
      id: state.nextId++,
      x: wrap(drone.x + nx * (DRONE_RADIUS + 4), WORLD.width),
      y: wrap(drone.y + ny * (DRONE_RADIUS + 4), WORLD.height),
      vx: nx * shotSpeed,
      vy: ny * shotSpeed,
      ttl: 2.2,
    });
    drone.cooldown += 1.6;
  }
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
  if (state.settings.mode !== 'drone-escape' && input.fire && ship.cooldown <= 0) {
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

function resolveDroneHits(state) {
  if (state.ship.invulnerable > 0) return;
  const playerRadius = RADII[state.lives];
  const hit = state.enemyBullets.find(shot =>
    toroidalDistance(state.ship, shot) < playerRadius + ENEMY_SHOT_RADIUS);
  if (!hit) return;
  state.enemyBullets = state.enemyBullets.filter(shot => shot.id !== hit.id);
  state.lives--;
  if (state.lives === 0) state.status = 'gameover';
  else state.ship.invulnerable = 2;
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
  if (state.ship.invulnerable > 0) return;
  const hit = state.asteroids.some(rock =>
    distanceToRock(state, state.ship, rock) < SHIP_RADIUS + RADII[rock.size]);
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
  const droneEscape = state.settings.mode === 'drone-escape';
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
  if (droneEscape) {
    updateDrones(state, dt);
    for (const shot of state.enemyBullets) {
      move(shot, dt);
      shot.ttl -= dt;
    }
    state.enemyBullets = state.enemyBullets.filter(shot => shot.ttl > 0);
    resolveDroneHits(state);
  } else {
    resolveHits(state);
  }
  // Collision loss takes precedence over completing an objective in the same step.
  if (state.status !== 'playing') return state;
  if (droneEscape) {
    state.levelElapsed += dt;
    if (state.levelElapsed >= state.settings.levelDurationSeconds) {
      state.levelElapsed -= state.settings.levelDurationSeconds;
      state.level++;
      state.score += 100;
      spawnDrone(state);
    }
  } else if (survival) {
    if (state.elapsed >= state.settings.durationSeconds) {
      state.status = 'won';
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
