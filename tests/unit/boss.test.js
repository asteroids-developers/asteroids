import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, WORLD } from '../../src/game/core.js';

const bossGame = () => createGame({ seed: 17, mode: 'boss', asteroidCount: 1, asteroidSpeed: 1 });
const shot = (game, id = 100) => ({ id, x: game.boss.x, y: game.boss.y, vx: 0, vy: 0, ttl: 1 });

test('boss mission starts with an enemy and no ordinary wave', () => {
  const game = bossGame();
  assert.equal(game.boss.hp, 24);
  assert.equal(game.boss.phase, 1);
  assert.equal(game.asteroids.length, 0);
  assert.equal(game.status, 'playing');
});

test('shots damage the boss once each and change phases at one and two thirds damage', () => {
  let game = bossGame();
  game.ship.invulnerable = 100;
  for (let hit = 1; hit <= 16; hit++) {
    game.bullets = [shot(game, 100 + hit)];
    game = stepGame(game, {}, 0.01);
    assert.equal(game.boss.hp, 24 - hit);
    if (hit === 8) assert.equal(game.boss.phase, 2);
    if (hit === 16) assert.equal(game.boss.phase, 3);
  }
  game.bullets = [shot(game, 200), shot(game, 201)];
  game = stepGame(game, {}, 0.01);
  assert.equal(game.boss.hp, 6);
});

test('a shot striking the visible wing damages the enemy ship', () => {
  const game = bossGame();
  game.bullets = [{ ...shot(game), x: game.boss.x + 90, y: game.boss.y - 20 }];
  const next = stepGame(game, {}, 0.01);
  assert.equal(next.boss.hp, 23);
});

test('every asteroid attack warns before rocks enter from both edges in phase two', () => {
  let game = bossGame();
  game.ship.invulnerable = 100;
  game.boss.hp = 16;
  game.boss.phase = 2;
  game.boss.nextAttack = 0.01;
  game = stepGame(game, {}, 0.02);
  assert.equal(game.boss.attack.stage, 'warning');
  assert.equal(game.asteroids.length, 0);
  game.boss.attack.remaining = 0.01;
  game = stepGame(game, {}, 0.02);
  assert.equal(game.boss.attack.stage, 'active');
  assert.equal(game.asteroids.length, 2);
  assert.ok(game.asteroids.some(rock => rock.x < 0 && rock.vx > 0));
  assert.ok(game.asteroids.some(rock => rock.x > WORLD.width && rock.vx < 0));
});

test('laser marks a lane before firing and damages only ships inside its beam', () => {
  let game = bossGame();
  game.boss.hp = 8;
  game.boss.phase = 3;
  game.boss.attackIndex = 1;
  game.boss.nextAttack = 0.01;
  game = stepGame(game, {}, 0.02);
  assert.equal(game.boss.attack.kind, 'laser');
  assert.equal(game.boss.attack.stage, 'warning');
  assert.equal(game.lives, 3);
  const laneX = game.boss.attack.laneX;
  game.ship.x = laneX;
  game.ship.y = 400;
  game.boss.attack.remaining = 0.01;
  game = stepGame(game, {}, 0.02);
  assert.equal(game.boss.attack.stage, 'active');
  assert.equal(game.lives, 2);
  game.ship.x = laneX + 100;
  game.ship.invulnerable = 0;
  game = stepGame(game, {}, 0.02);
  assert.equal(game.lives, 2);
});

test('defeating the boss ends the mission and restart restores all health', () => {
  let game = bossGame();
  game.boss.hp = 1;
  game.boss.phase = 3;
  game.bullets = [shot(game)];
  game = stepGame(game, {}, 0.01);
  assert.equal(game.status, 'won');
  assert.equal(game.boss.hp, 0);
  assert.deepEqual(stepGame(game, {}, 0.05), game);
  const restarted = createGame(game.settings);
  assert.equal(restarted.boss.hp, 24);
  assert.equal(restarted.boss.phase, 1);
});
