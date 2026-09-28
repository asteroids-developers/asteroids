import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, stepGame, WORLD } from '../../src/game/core.js';
import { validateMission } from '../../src/missions/schema.js';

const mission = validateMission(JSON.parse(readFileSync(
  new URL('../../src/missions/presets/orbital-sprint.json', import.meta.url), 'utf8',
)));
const rock = (id, x, y, size = 1, vx = 0) => ({ id, x, y, size, vx, vy: 0, angle: 0, spin: 0 });
const bullet = (id, x, y) => ({ id, x, y, vx: 0, vy: 0, ttl: 1 });

test('Orbital Sprint clears all fragments in one wave and resets on replay', () => {
  const initial = createGame(mission);
  let game = structuredClone(initial);
  game.ship.invulnerable = 100;
  assert.equal(game.settings.mode, 'time-attack');
  assert.equal(game.settings.durationSeconds, 45);
  for (let hit = 1; hit <= 21; hit++) {
    const target = game.asteroids[0];
    game.bullets = [{ ...bullet(game.nextId++, target.x, target.y), vx: target.vx, vy: target.vy }];
    game = stepGame(game, {}, 1 / 60);
    assert.equal(game.destroyed, hit);
    assert.equal(game.wave, 1);
    assert.equal(game.status, hit < 21 ? 'playing' : 'won');
  }
  assert.equal(game.score, 1560);
  assert.equal(game.asteroids.length, 0);
  assert.ok(game.elapsed < game.settings.durationSeconds);
  assert.deepEqual(stepGame(game, { fire: true }, 0.05), game);
  assert.deepEqual(createGame(game.settings), initial);
});

test('time attack expires exactly at the deadline with lives remaining', () => {
  const game = createGame(mission);
  game.elapsed = 44.99;
  game.ship.invulnerable = 1;
  const lost = stepGame(game, {}, 0.05);
  assert.equal(lost.status, 'gameover');
  assert.equal(lost.elapsed, 45);
  assert.equal(lost.lives, 3);
  assert.equal(lost.asteroids.length, 3);
  assert.equal(game.elapsed, 44.99, 'the input state must remain unchanged');
  assert.deepEqual(stepGame(lost, { fire: true }, 0.05), lost);
  assert.deepEqual(createGame(lost.settings), createGame(mission));
});

test('a final fragment destroyed on the deadline completes time attack', () => {
  const game = createGame(mission);
  game.elapsed = 44.99;
  game.destroyed = 20;
  game.asteroids = [rock(100, 100, 100)];
  game.bullets = [bullet(101, 100, 100)];
  const won = stepGame(game, {}, 0.05);
  assert.equal(won.status, 'won');
  assert.equal(won.elapsed, 45);
  assert.equal(won.destroyed, 21);
  assert.equal(won.wave, 1);
  assert.equal(won.asteroids.length, 0);
});

test('splitting the last large asteroid on the deadline is not a victory', () => {
  const game = createGame(mission);
  game.elapsed = 44.99;
  game.asteroids = [rock(100, 100, 100, 3)];
  game.bullets = [bullet(101, 100, 100)];
  game.nextId = 102;
  const lost = stepGame(game, {}, 0.05);
  assert.equal(lost.status, 'gameover');
  assert.equal(lost.asteroids.length, 2);
  assert.ok(lost.asteroids.every(fragment => fragment.size === 2));
  assert.equal(lost.score, 20);
});

test('losing the last life ends time attack before or on the deadline', () => {
  for (const elapsed of [10, 44.99]) {
    const game = createGame(mission);
    game.elapsed = elapsed;
    game.lives = 1;
    game.asteroids = [rock(100, game.ship.x, game.ship.y, 3)];
    const lost = stepGame(game, {}, 0.05);
    assert.equal(lost.status, 'gameover');
    assert.equal(lost.lives, 0);
    assert.deepEqual(createGame(lost.settings), createGame(mission));
  }
});

test('time attack wraps asteroids and counts repeated edge hits only once', () => {
  const game = createGame(mission);
  game.asteroids = [rock(100, WORLD.width - 2, 100), rock(101, WORLD.width - 1, 500, 3, 200)];
  game.bullets = [bullet(102, 2, 100), bullet(103, 2, 100)];
  const next = stepGame(game, {}, 0.02);
  assert.equal(next.score, 100);
  assert.equal(next.destroyed, 1);
  assert.equal(next.bullets.length, 1);
  assert.equal(next.asteroids.length, 1);
  assert.ok(next.asteroids[0].x < 10);
  assert.equal(next.status, 'playing');
});

test('an idle time attack has no stream spawns and ends at its time limit', () => {
  let game = createGame({ ...mission, durationSeconds: 1 });
  game.asteroids = [rock(100, 100, 100, 3)];
  game.spawnCountdown = 0.001;
  for (let frame = 0; frame < 60; frame++) {
    game = stepGame(game, {}, 1 / 60);
    assert.equal(game.asteroids.length, 1);
    assert.equal(game.wave, 1);
    if (frame < 59) assert.equal(game.status, 'playing');
  }
  assert.equal(game.status, 'gameover');
  assert.equal(game.elapsed, 1);
});

test('time attack stays deterministic across movement, firing and collisions', () => {
  let a = createGame(mission), b = createGame(mission);
  for (let frame = 0; frame < 600; frame++) {
    const input = { thrust: true, fire: true, right: frame % 120 < 30 };
    a = stepGame(a, input, 1 / 60);
    b = stepGame(b, input, 1 / 60);
  }
  assert.deepEqual(a, b);
});

test('time attack validates duration through both the preset and core contracts', () => {
  const { durationSeconds, ...withoutDuration } = mission;
  assert.equal(validateMission(withoutDuration).durationSeconds, 60);
  assert.equal(createGame(withoutDuration).settings.durationSeconds, 60);
  for (const duration of [1, 600]) {
    assert.equal(createGame(validateMission({ ...mission, durationSeconds: duration })).settings.durationSeconds, duration);
  }
  for (const duration of [0, -1, 601, Infinity, NaN, null, '45']) {
    assert.throws(() => validateMission({ ...mission, durationSeconds: duration }));
    assert.throws(() => createGame({ ...mission, durationSeconds: duration }));
  }
});
