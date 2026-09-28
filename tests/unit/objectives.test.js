import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, WORLD, RADII, toroidalDistance } from '../../src/game/core.js';

const rock = (id, x, y, size = 1, vx = 0) => ({ id, x, y, vx, vy: 0, size, angle: 0, spin: 0 });
const bullet = (id, x, y) => ({ id, x, y, vx: 0, vy: 0, ttl: 1 });
const clear = () => createGame({ seed: 42, mode: 'clear', asteroidCount: 3, asteroidSpeed: 0.6 });
const survival = () => createGame({ seed: 2026, mode: 'survival', durationSeconds: 60, spawnIntervalSeconds: 1.25 });
const droneEscape = () => createGame({ seed: 314159, mode: 'drone-escape', levelDurationSeconds: 20 });

test('legacy options retain endless waves', () => {
  const game = createGame();
  assert.equal(game.settings.mode, 'waves');
  game.asteroids = [];
  assert.equal(stepGame(game, {}, 0.01).wave, 2);
});

test('clear objective ends with victory after the final fragment', () => {
  const game = clear();
  game.asteroids = [rock(100, 100, 100)];
  game.bullets = [bullet(101, 100, 100)];
  game.destroyed = 20;
  const won = stepGame(game, {}, 0.01);
  assert.equal(won.status, 'won');
  assert.equal(won.asteroids.length, 0);
  assert.equal(won.wave, 1);
  assert.equal(won.destroyed, 21);
  assert.deepEqual(stepGame(won, { fire: true }, 0.05), won);
});

test('clear objective waits until all fragments are destroyed', () => {
  const game = clear();
  game.asteroids = [rock(100, 100, 100, 3)];
  game.bullets = [bullet(101, 100, 100)];
  game.nextId = 102;
  const next = stepGame(game, {}, 0.01);
  assert.equal(next.status, 'playing');
  assert.equal(next.asteroids.length, 2);
  assert.equal(next.destroyed, 1);
});

test('initial placement stays separated and safe across mission modes and seeds', () => {
  for (let seed = 0; seed < 30; seed++) {
    for (const mode of ['waves', 'clear', 'survival']) {
      const game = createGame({ seed, mode, asteroidCount: 30 });
      assert.equal(game.asteroids.length, 30);
      if (mode === 'survival') {
        assert.ok(game.asteroids.every(rock => rock.x >= RADII[3] && rock.x <= WORLD.width - RADII[3]
          && rock.y >= RADII[3] && rock.y <= WORLD.height - RADII[3]));
      }
      for (let i = 0; i < game.asteroids.length; i++) {
        assert.ok(toroidalDistance(game.ship, game.asteroids[i]) >= 180);
        for (let j = i + 1; j < game.asteroids.length; j++) {
          assert.ok(toroidalDistance(game.asteroids[i], game.asteroids[j]) >= RADII[3] * 2 + 12);
        }
      }
    }
  }
});

test('survival starts a directed flow and introduces new rocks on a timer', () => {
  const game = survival();
  assert.ok(game.asteroids.every(a => a.vx < 0 && Math.abs(a.vy) < Math.abs(a.vx)));
  game.asteroids = [];
  game.spawnCountdown = 0.01;
  const next = stepGame(game, {}, 0.02);
  assert.equal(next.asteroids.length, 1);
  assert.ok(next.asteroids[0].x >= WORLD.width);
  assert.ok(next.asteroids[0].vx < 0);
  assert.equal(next.wave, 1);
  assert.equal(next.status, 'playing');
});

test('an empty survival field does not win or start a wave early', () => {
  const game = survival();
  game.asteroids = [];
  game.spawnCountdown = 1;
  const next = stepGame(game, {}, 0.01);
  assert.equal(next.status, 'playing');
  assert.equal(next.wave, 1);
  assert.equal(next.asteroids.length, 0);
});

test('survival completes exactly at its duration and then freezes', () => {
  const game = createGame({ mode: 'survival', durationSeconds: 1 });
  game.elapsed = 0.98;
  game.ship.invulnerable = 10;
  const won = stepGame(game, {}, 0.05);
  assert.equal(won.status, 'won');
  assert.equal(won.elapsed, 1);
  assert.deepEqual(stepGame(won, {}, 0.05), won);
});

test('losing the last life takes precedence over a timer victory', () => {
  const game = createGame({ mode: 'survival', durationSeconds: 1 });
  game.elapsed = 0.98;
  game.lives = 1;
  game.asteroids = [rock(100, game.ship.x, game.ship.y, 3)];
  const lost = stepGame(game, {}, 0.05);
  assert.equal(lost.status, 'gameover');
  assert.equal(lost.lives, 0);
  assert.equal(lost.elapsed, 1);
});

test('stream objects leave the field instead of wrapping', () => {
  const game = survival();
  game.asteroids = [rock(100, -RADII[1] - 1, 100, 1, -50)];
  game.spawnCountdown = 1;
  const next = stepGame(game, {}, 0.01);
  assert.equal(next.asteroids.length, 0);
  assert.equal(next.status, 'playing');
});

test('offscreen incoming rocks cannot collide through the opposite edge', () => {
  const game = survival();
  game.ship.x = 2;
  game.ship.y = 320;
  game.asteroids = [rock(100, WORLD.width + 20, 320, 3)];
  game.bullets = [bullet(101, 2, 320)];
  game.spawnCountdown = 1;
  const next = stepGame(game, {}, 0.01);
  assert.equal(next.lives, 3);
  assert.equal(next.score, 0);
  assert.equal(next.asteroids.length, 1);
});

test('crowded input lanes skip a spawn slot without an unbounded retry', { timeout: 1000 }, () => {
  const game = survival();
  game.asteroids = Array.from({ length: 16 }, (_, i) => rock(100 + i, WORLD.width + 42, i * 40, 3));
  game.spawnCountdown = 0.001;
  const next = stepGame(game, {}, 0.01);
  assert.equal(next.asteroids.length, 16);
  assert.ok(next.spawnCountdown > 0);
});

test('stream population limits new spawns and does not accumulate a burst', () => {
  const game = survival();
  game.asteroids = Array.from({ length: 30 }, (_, i) => rock(100 + i, 100, 20 + i * 15, 1));
  game.spawnCountdown = 0.001;
  const next = stepGame(game, {}, 0.01);
  assert.equal(next.asteroids.length, 30);
  assert.ok(next.spawnCountdown > 0);
});

test('survival spawning remains deterministic across frames', () => {
  let a = survival(), b = survival();
  a.ship.invulnerable = b.ship.invulnerable = 100;
  for (let i = 0; i < 200; i++) {
    a = stepGame(a, {}, 0.05);
    b = stepGame(b, {}, 0.05);
  }
  assert.deepEqual(a, b);
});

test('drone escape starts with an unarmed asteroid facing one drone', () => {
  const game = droneEscape();
  assert.equal(game.level, 1);
  assert.equal(game.levelElapsed, 0);
  assert.equal(game.drones.length, 1);
  assert.equal(game.asteroids.length, 0);
  assert.equal(stepGame(game, { fire: true }, 0.01).bullets.length, 0);
});

test('drone escape adds one attacker after every 20-second level', () => {
  let game = droneEscape();
  game.ship.invulnerable = 100;
  game.drones[0].cooldown = 100;
  game.levelElapsed = 19.98;
  game = stepGame(game, {}, 0.05);
  assert.equal(game.level, 2);
  assert.equal(game.drones.length, 2);
  assert.ok(game.levelElapsed > 0 && game.levelElapsed < 0.05);
  assert.equal(game.score, 100);
  game.levelElapsed = 19.99;
  game = stepGame(game, {}, 0.02);
  assert.equal(game.level, 3);
  assert.equal(game.drones.length, 3);
  assert.equal(game.score, 200);
});

test('drone fire removes one layer of asteroid mass and respects invulnerability', () => {
  let game = droneEscape();
  game.drones[0].cooldown = 100;
  game.enemyBullets = [{ id: 100, x: game.ship.x, y: game.ship.y, vx: 0, vy: 0, ttl: 1 }];
  game = stepGame(game, {}, 0.01);
  assert.equal(game.lives, 2);
  assert.ok(game.ship.invulnerable > 0);
  game.enemyBullets = [{ id: 101, x: game.ship.x, y: game.ship.y, vx: 0, vy: 0, ttl: 1 }];
  assert.equal(stepGame(game, {}, 0.01).lives, 2);
  game.ship.invulnerable = 0;
  game.lives = 1;
  game.enemyBullets = [{ id: 102, x: game.ship.x, y: game.ship.y, vx: 0, vy: 0, ttl: 1 }];
  const ended = stepGame(game, {}, 0.01);
  assert.equal(ended.status, 'gameover');
  assert.equal(ended.lives, 0);
});

test('drone movement and fire stay deterministic', () => {
  let a = droneEscape(), b = droneEscape();
  a.ship.invulnerable = b.ship.invulnerable = 100;
  for (let i = 0; i < 200; i++) {
    a = stepGame(a, { thrust: i % 3 === 0, right: i % 5 === 0 }, 0.05);
    b = stepGame(b, { thrust: i % 3 === 0, right: i % 5 === 0 }, 0.05);
  }
  assert.deepEqual(a, b);
  assert.ok(a.enemyBullets.length > 0);
});

test('restart clears objective counters and uses the same initial seed', () => {
  const initial = clear();
  const restarted = createGame(initial.settings);
  assert.equal(restarted.destroyed, 0);
  assert.equal(restarted.elapsed, 0);
  assert.equal(restarted.status, 'playing');
  assert.deepEqual(restarted, initial);
});

test('invalid modes and mission timing are rejected', () => {
  for (const settings of [
    { mode: 'unknown' }, { mode: null }, { durationSeconds: 0 },
    { durationSeconds: Infinity }, { durationSeconds: 601 },
    { spawnIntervalSeconds: 0 }, { spawnIntervalSeconds: NaN },
    { spawnIntervalSeconds: 0.1 }, { spawnIntervalSeconds: 11 },
    { levelDurationSeconds: 0 }, { levelDurationSeconds: Infinity }, { levelDurationSeconds: 601 },
  ]) assert.throws(() => createGame(settings));
});


test('a whole training wave and all fragments finish in 21 hits', () => {
  let game = clear();
  game.ship.invulnerable = 100;
  for (let hit = 0; hit < 21; hit++) {
    const target = game.asteroids[0];
    game.bullets = [{ ...bullet(game.nextId++, target.x, target.y), vx: target.vx, vy: target.vy }];
    game = stepGame(game, {}, 1 / 60);
  }
  assert.equal(game.status, 'won');
  assert.equal(game.destroyed, 21);
  assert.equal(game.score, 1560);
  assert.equal(game.asteroids.length, 0);
});

test('a complete timed mission survives its entire spawning lifecycle', () => {
  let game = survival();
  game.ship.invulnerable = 100;
  let frames = 0;
  while (game.status === 'playing' && frames++ < 1300) {
    game = stepGame(game, {}, 0.05);
    assert.ok(game.asteroids.length <= 30);
    assert.ok(game.asteroids.every(rock => rock.vx < 0));
  }
  assert.equal(game.status, 'won');
  assert.equal(game.elapsed, 60);
});

test('later dense waves stay safe when the ship is near a corner', () => {
  const game = createGame({ asteroidCount: 30 });
  game.ship.x = 8;
  game.ship.y = 8;
  game.asteroids = [];
  const next = stepGame(game, {}, 0.01);
  assert.equal(next.asteroids.length, 30);
  assert.ok(next.asteroids.every(rock => toroidalDistance(rock, next.ship) >= 180));
});
