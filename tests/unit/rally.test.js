import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, WORLD } from '../../src/game/core.js';
import { RALLY } from '../../src/game/rally.js';
import { spawnIncoming } from '../../src/game/spawn.js';

const rally = () => createGame({ seed: 1959, mode: 'dream-rally', durationSeconds: 90,
  asteroidCount: 4, asteroidSpeed: 0.9, spawnIntervalSeconds: 2 });
const rock = (state, id = 900) => ({ id, x: state.ship.x, y: state.ship.y,
  vx: 0, vy: 0, size: 1, angle: 0, spin: 0 });

test('three collected hearts grant shields and spread fire, then start the storm', () => {
  let game = rally();
  game.asteroids = [];
  game.rally.dashCooldown = 2;
  for (let n = 0; n < 3; n++) {
    game.rally.pickups = [{ id: game.nextId++, x: game.ship.x, y: game.ship.y }];
    game = stepGame(game, {}, 0.01);
  }
  assert.equal(game.rally.hearts, 3);
  assert.equal(game.rally.shields, 2);
  assert.equal(game.rally.powerRemaining, 6);
  assert.equal(game.rally.dashCooldown, 0);
  assert.equal(game.rally.phase, 'storm');
  assert.equal(game.rally.phaseElapsed, 0);
  assert.equal(game.score, 600);
  const firing = stepGame(game, { fire: true }, 0.01);
  assert.equal(firing.bullets.length, 3);
  game.rally.powerRemaining = 0;
  assert.equal(stepGame(game, { fire: true }, 0.01).bullets.length, 1);
});

test('a shield absorbs a hit and repeated contacts cannot consume it again immediately', () => {
  const game = rally();
  game.rally.shields = 2;
  game.asteroids = [rock(game)];
  const first = stepGame(game, {}, 0.01);
  assert.equal(first.rally.shields, 1);
  assert.equal(first.lives, 3);
  assert.equal(stepGame(first, {}, 0.01).rally.shields, 1);
  first.ship.invulnerable = 0;
  first.rally.shields = 0;
  assert.equal(stepGame(first, {}, 0.01).lives, 2);
});

test('dash is fast, protects against collision, and requires cooldown plus a new key press', () => {
  const game = rally();
  game.asteroids = [rock(game)];
  const dashed = stepGame(game, { dash: true }, 0.01);
  assert.equal(dashed.lives, 3);
  assert.ok(Math.hypot(dashed.ship.vx, dashed.ship.vy) > 700);
  assert.equal(dashed.rally.dashCooldown, 3);
  const held = stepGame(dashed, { dash: true }, 0.01);
  assert.ok(held.rally.dashCooldown < 3);
  held.rally.dashCooldown = 0;
  held.rally.dashRemaining = 0;
  assert.equal(stepGame(held, { dash: true }, 0.01).rally.dashRemaining, 0);
  const released = stepGame(held, {}, 0.01);
  assert.equal(stepGame(released, { dash: true }, 0.01).rally.dashRemaining, RALLY.dashSeconds);
});

test('storm unlocks the gate after 20 seconds; reaching it is required to win', () => {
  const game = rally();
  game.asteroids = [];
  game.rally.phase = 'storm';
  game.rally.phaseElapsed = 19.99;
  game.rally.hazardCountdown = 5;
  let next = stepGame(game, {}, 0.02);
  assert.equal(next.rally.phase, 'escape');
  assert.equal(next.status, 'playing');
  next.ship.x = RALLY.gate.x;
  next.ship.y = RALLY.gate.y;
  next = stepGame(next, {}, 0.01);
  assert.equal(next.status, 'won');
  assert.equal(stepGame(next, { fire: true }, 0.05), next);
  const early = rally();
  early.asteroids = [];
  early.ship.x = RALLY.gate.x;
  early.ship.y = RALLY.gate.y;
  assert.equal(stepGame(early, {}, 0.01).status, 'playing');
});

test('laser warning is harmless; active beam hits and dash can cross it', () => {
  const game = rally();
  game.asteroids = [];
  game.rally.phase = 'storm';
  game.rally.hazards = [{ y: game.ship.y, age: -1 }];
  assert.equal(stepGame(game, {}, 0.01).lives, 3);
  game.rally.hazards[0].age = 0;
  assert.equal(stepGame(game, {}, 0.01).lives, 2);
  assert.equal(stepGame(game, { dash: true }, 0.01).lives, 3);
});

test('time running out or a last-life collision takes precedence over entering the gate', () => {
  for (const cause of ['timeout', 'collision']) {
    const game = rally();
    game.rally.phase = 'escape';
    game.ship.x = RALLY.gate.x;
    game.ship.y = RALLY.gate.y;
    game.asteroids = [];
    if (cause === 'timeout') game.elapsed = 89.99;
    else { game.lives = 1; game.asteroids = [rock(game)]; }
    const lost = stepGame(game, {}, 0.02);
    assert.equal(lost.status, 'gameover');
    if (cause === 'timeout') { assert.equal(lost.elapsed, 90); assert.equal(lost.rally.reason, 'timeout'); }
  }
});

test('phase changes speed up incoming asteroids without mutating mission settings', () => {
  const collect = rally(), storm = rally();
  collect.asteroids = []; storm.asteroids = [];
  storm.rally.phase = 'storm';
  spawnIncoming(collect); spawnIncoming(storm);
  assert.ok(Math.abs(storm.asteroids[0].vx) > Math.abs(collect.asteroids[0].vx));
  assert.deepEqual(storm.settings, collect.settings);
  assert.ok(storm.asteroids[0].x > WORLD.width);
});

test('rally preserves deterministic trajectories, bounded pickups and a clean restart', () => {
  const initial = rally();
  let a = initial, b = rally();
  for (let frame = 0; frame < 1800 && a.status === 'playing'; frame++) {
    const input = { fire: true, thrust: frame % 60 < 30, right: frame % 60 < 20, dash: frame % 190 === 0 };
    a = stepGame(a, input, 1 / 60);
    b = stepGame(b, input, 1 / 60);
    assert.ok(a.rally.pickups.length <= 6);
  }
  assert.deepEqual(a, b);
  assert.deepEqual(createGame(initial.settings), initial);
  assert.throws(() => createGame({ mode: 'dream-rally', durationSeconds: 20 }), /45/);
});

test('collect, storm and escape can be completed in one continuous simulation', () => {
  let game = rally();
  // Controlled collision fixtures exercise every transition; normal-control playability is checked separately.
  game.ship.invulnerable = 100;
  game.rally.pickups = Array.from({ length: 3 }, () => ({ id: game.nextId++, x: game.ship.x, y: game.ship.y }));
  game = stepGame(game, {}, 0.01);
  for (let frame = 0; frame < 410 && game.rally.phase === 'storm'; frame++) game = stepGame(game, { fire: true }, 0.05);
  assert.equal(game.rally.phase, 'escape');
  game.ship.x = RALLY.gate.x;
  game.ship.y = RALLY.gate.y;
  game = stepGame(game, {}, 0.01);
  assert.equal(game.status, 'won');
  assert.ok(game.elapsed < 21);
});
