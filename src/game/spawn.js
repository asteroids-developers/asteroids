import { WORLD, RADII, toroidalDistance } from './world.js';

const SAFE_DISTANCE = 180;
const GAP = 12;

export function random(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

function activeStages(state) {
  const { mode, speedStages } = state.settings;
  return mode === 'survival' && speedStages ? speedStages : null;
}

/** Zero-based survival stage; missions without stages stay on a single stage. */
export function stageIndex(state) {
  const stages = activeStages(state);
  if (!stages) return 0;
  const span = state.settings.durationSeconds / stages.length;
  return Math.min(stages.length - 1, Math.floor(state.elapsed / span));
}

/** Speed for rocks created right now: the stage multiplier scales asteroidSpeed. */
export function stageSpeed(state) {
  const stages = activeStages(state);
  const { asteroidSpeed } = state.settings;
  return stages ? asteroidSpeed * stages[stageIndex(state)] : asteroidSpeed;
}

export function makeAsteroid(state, x, y, size) {
  const direction = ['survival', 'dream-rally'].includes(state.settings.mode)
    ? Math.PI + (random(state) - 0.5) * 0.28
    : random(state) * Math.PI * 2;
  const speed = (30 + random(state) * 35) * stageSpeed(state)
    * (1 + (state.wave - 1) * 0.08) * (1 + (3 - size) * 0.25)
    * (state.rally?.phase === 'storm' ? 1.7 : state.rally?.phase === 'escape' ? 2 : 1);
  return {
    id: state.nextId++, x, y, size,
    vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed,
    angle: random(state) * Math.PI * 2, spin: (random(state) - 0.5) * 1.2,
  };
}

function separated(position, positions, ship) {
  return toroidalDistance(position, ship) >= SAFE_DISTANCE
    && positions.every(other => toroidalDistance(position, other) >= RADII[3] * 2 + GAP);
}

function positionsForWave(state, count) {
  const positions = [];
  for (let attempt = 0; attempt < count * 80 && positions.length < count; attempt++) {
    const margin = ['survival', 'dream-rally'].includes(state.settings.mode) ? RADII[3] : 0;
    const position = {
      x: margin + random(state) * (WORLD.width - 2 * margin),
      y: margin + random(state) * (WORLD.height - 2 * margin),
    };
    if (separated(position, positions, state.ship)) positions.push(position);
  }
  if (positions.length === count) return positions;

  // Dense waves use a shuffled safe grid instead of retrying indefinitely.
  // 8 x 5 cells leave at least 30 valid sites outside the ship's safe circle.
  const grid = [];
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 8; column++) {
      const position = { x: (column + 0.5) * WORLD.width / 8, y: (row + 0.5) * WORLD.height / 5 };
      if (toroidalDistance(position, state.ship) >= SAFE_DISTANCE) grid.push(position);
    }
  }
  for (let i = grid.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  if (grid.length < count) throw new Error('Not enough safe asteroid spawn positions');
  return grid.slice(0, count);
}

export function spawnWave(state) {
  const count = Math.min(30, state.settings.asteroidCount + state.wave - 1);
  const positions = positionsForWave(state, count);
  state.asteroids.push(...positions.map(({ x, y }) => makeAsteroid(state, x, y, 3)));
}

export function spawnIncoming(state) {
  // Fragments remain intact. This limit applies only to adding new large rocks.
  if (state.asteroids.length >= 30) return false;
  const radius = RADII[3];
  for (let attempt = 0; attempt < 64; attempt++) {
    const position = {
      x: WORLD.width + radius,
      y: radius + GAP + random(state) * (WORLD.height - 2 * (radius + GAP)),
    };
    if (Math.hypot(position.x - state.ship.x, position.y - state.ship.y) < SAFE_DISTANCE) continue;
    if (state.asteroids.some(other =>
      Math.hypot(position.x - other.x, position.y - other.y) < radius + RADII[other.size] + GAP)) continue;
    state.asteroids.push(makeAsteroid(state, position.x, position.y, 3));
    return true;
  }
  return false;
}
