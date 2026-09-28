import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, WORLD } from '../../src/game/core.js';
import { validateMission } from '../../src/missions/schema.js';
const setup = () => {
  const s = createGame({ mode: 'survival', ufoEnabled: true });
  s.asteroids = []; s.spawnCountdown = 10;
  s.ufo = { id: 90, x: 100, y: 100, vx: 0, cooldown: 0 };
  return s;
};
const shot = (id, x, y) => ({id, x, y, vx: 0, vy: 0, ttl: 2});

test('UFO fires toward the player; simulation is deterministic and immutable', () => {
  const s = setup(), before = structuredClone(s);
  const n = stepGame(s, {}, 0.01);
  assert.deepEqual(s, before);
  assert.deepEqual(n, stepGame(s, {}, 0.01));
  assert.equal(n.enemyBullets.length, 1);
  const b = n.enemyBullets[0];
  assert.ok(Math.abs(b.vy / b.vx - (s.ship.y - 100) / (s.ship.x - 100)) < 1e-10);
  assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - 210) < 1e-10);
});
test('multiple player hits award one kill and UFO respawns after a delay', () => {
  const s = setup(); s.ufo.cooldown = 10;
  s.bullets = [shot(91, 100, 100), shot(92, 100, 100)];
  let n = stepGame(s, {}, 0.01);
  assert.equal(n.score, 200); assert.equal(n.ufosDestroyed, 1); assert.equal(n.ufo, null);
  assert.equal(n.bullets.length, 1);
  n.bullets = []; n.ship.invulnerable = 100;
  for (let i = 0; i < 99; i++) n = stepGame(n, {}, 0.05);
  assert.equal(n.ufo, null);
  n = stepGame(n, {}, 0.05); n = stepGame(n, {}, 0.05);
  assert.ok(n.ufo);
});
test('simultaneous asteroid and enemy shots cost only one life; protection blocks repeat hits', () => {
  const s = setup(); s.ufo.cooldown = 10;
  s.enemyBullets = [shot(101, s.ship.x, s.ship.y), shot(102, s.ship.x, s.ship.y)];
  s.asteroids = [{ id: 103, x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, size: 1, angle: 0, spin: 0 }];
  let n = stepGame(s, {}, 0.01);
  assert.equal(n.lives, 2); assert.equal(n.enemyBullets.length, 0);
  n.enemyBullets = [shot(104, n.ship.x, n.ship.y)];
  n = stepGame(n, {}, 0.01);
  assert.equal(n.lives, 2); assert.equal(n.enemyBullets.length, 0);
});
test('last-life enemy hit beats victory on the same timer tick', () => {
  const s = setup(); s.elapsed = 59.99; s.lives = 1;
  s.enemyBullets = [shot(101, s.ship.x, s.ship.y)];
  const n = stepGame(s, {}, 0.02);
  assert.equal(n.status, 'gameover'); assert.equal(n.lives, 0);
});
test('enemy objects do not hit through opposite edges and shots leave the field', () => {
  const s = setup(); s.ship.x = 2; s.ship.y = 100;
  s.ufo.x = WORLD.width + 20; s.ufo.cooldown = 10;
  s.enemyBullets = [shot(101, WORLD.width + 4, 100)];
  let n = stepGame(s, {}, 0.01);
  assert.equal(n.lives, 3);
  n.enemyBullets[0].vx = 210;
  n = stepGame(n, {}, 0.05);
  assert.equal(n.enemyBullets.length, 0);
});
test('old missions have no UFO; flag validates and survives mission loading', () => {
  assert.equal(stepGame(createGame(), {}, 0.05).ufo, null);
  for (const options of [{ufoEnabled:'yes'}, {ufoEnabled:true, mode:'clear'}])
    assert.throws(() => createGame(options));
  const m = validateMission({id:'ufo',title:'НЛО',description:'Тест',seed:1,asteroidCount:1,asteroidSpeed:1,mode:'survival',ufoEnabled:true});
  assert.equal(createGame(m).settings.ufoEnabled, true);
  const initial = createGame(m);
  assert.deepEqual(createGame(stepGame(initial, {}, 0.05).settings), initial);
});
