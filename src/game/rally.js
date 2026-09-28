import { WORLD } from './world.js';
import { random } from './spawn.js';

export const RALLY = Object.freeze({ heartsRequired: 3, stormSeconds: 20, dashCooldown: 3,
  dashSeconds: 0.25, dashSpeed: 760, gate: { x: 850, y: 320, radius: 48 } });

export function createRally(state) {
  return {
    phase: 'collect', phaseElapsed: 0, hearts: 0, shields: 0, powerRemaining: 0,
    dashCooldown: 0, dashRemaining: 0, dashPressed: false,
    pickupCountdown: 2.8, hazardCountdown: 3, hazards: [], reason: null,
    pickups: [0, 2, 4].map(n => ({ id: state.nextId++,
      x: WORLD.width / 2 + Math.cos(n * Math.PI / 3) * 160,
      y: WORLD.height / 2 + Math.sin(n * Math.PI / 3) * 160 })),
  };
}

export function prepareRally(state, input, dt) {
  const rally = state.rally;
  rally.phaseElapsed += dt;
  rally.dashCooldown = Math.max(0, rally.dashCooldown - dt);
  rally.dashRemaining = Math.max(0, rally.dashRemaining - dt);
  rally.powerRemaining = Math.max(0, rally.powerRemaining - dt);
  if (input.dash && !rally.dashPressed && rally.dashCooldown === 0) {
    rally.dashCooldown = RALLY.dashCooldown;
    rally.dashRemaining = RALLY.dashSeconds;
    state.ship.invulnerable = Math.max(state.ship.invulnerable, RALLY.dashSeconds + dt);
    state.ship.vx = Math.cos(state.ship.angle) * RALLY.dashSpeed;
    state.ship.vy = Math.sin(state.ship.angle) * RALLY.dashSpeed;
  }
  rally.dashPressed = Boolean(input.dash);
}

export function advanceRally(state, dt, damageShip) {
  const rally = state.rally;
  rally.pickupCountdown -= dt;
  if (rally.pickupCountdown <= 0) {
    if (rally.pickups.length < 6) rally.pickups.push({ id: state.nextId++,
      x: WORLD.width - 80, y: 80 + random(state) * (WORLD.height - 160) });
    rally.pickupCountdown += rally.phase === 'collect' ? 2.8 : 4.5;
  }
  rally.pickups = rally.pickups.filter(heart => {
    heart.x -= 22 * dt;
    const dx = state.ship.x - heart.x, dy = state.ship.y - heart.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 26) {
      rally.hearts++;
      rally.shields = Math.min(2, rally.shields + 1);
      rally.powerRemaining = 6;
      rally.dashCooldown = 0;
      state.score += 200;
      return false;
    }
    if (distance < 115) {
      const pull = Math.min(distance, 180 * dt) / distance;
      heart.x += dx * pull;
      heart.y += dy * pull;
    }
    return heart.x > -24;
  });
  if (rally.phase === 'collect' && rally.hearts >= RALLY.heartsRequired) {
    rally.phase = 'storm';
    rally.phaseElapsed = 0;
    state.spawnCountdown = Math.min(state.spawnCountdown, 0.8);
  } else if (rally.phase === 'storm' && rally.phaseElapsed >= RALLY.stormSeconds) {
    rally.phase = 'escape';
    rally.phaseElapsed = 0;
    state.score += 500;
  }
  if (rally.phase !== 'collect') {
    rally.hazardCountdown -= dt;
    if (rally.hazardCountdown <= 0) {
      rally.hazards.push({ y: 70 + random(state) * (WORLD.height - 140), age: -1.4 });
      rally.hazardCountdown += rally.phase === 'storm' ? 3.5 : 2.6;
    }
  }
  for (const hazard of rally.hazards) {
    hazard.age += dt;
    if (hazard.age >= 0 && hazard.age <= 0.65 && Math.abs(state.ship.y - hazard.y) < 30) damageShip(state);
  }
  rally.hazards = rally.hazards.filter(hazard => hazard.age <= 0.65);
  if (state.status !== 'playing') return;
  if (state.elapsed >= state.settings.durationSeconds) {
    state.status = 'gameover';
    rally.reason = 'timeout';
  } else if (rally.phase === 'escape' && Math.hypot(state.ship.x - RALLY.gate.x, state.ship.y - RALLY.gate.y) < RALLY.gate.radius) {
    state.status = 'won';
    state.score += Math.ceil(state.settings.durationSeconds - state.elapsed) * 20;
  }
}

export function rallySpawnInterval(state) {
  return state.settings.spawnIntervalSeconds * (state.rally.phase === 'storm' ? 0.45 : state.rally.phase === 'escape' ? 0.65 : 1);
}
