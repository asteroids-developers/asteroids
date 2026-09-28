import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validateMission, loadMissions } from '../../src/missions/schema.js';
import { createGame, stepGame } from '../../src/game/core.js';

const fixture = { id: 'example', title: 'Пример', description: 'Учебный сектор', seed: 42, asteroidCount: 5, asteroidSpeed: 1 };
const presets = () => readdirSync(new URL('../../src/missions/presets/', import.meta.url))
  .filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(readFileSync(new URL('../../src/missions/presets/' + name, import.meta.url), 'utf8')));

test('all checked-in missions satisfy the contract and start a game', () => {
  const missions = loadMissions(presets());
  assert.ok(missions.length >= 2);
  for (const mission of missions) {
    const game = createGame(mission);
    assert.equal(game.asteroids.length, mission.asteroidCount);
    assert.equal(game.settings.seed, mission.seed);
    assert.equal(game.settings.asteroidSpeed, mission.asteroidSpeed);
  }
});

test('a new preset joins the sorted catalog without a hand-maintained index', () => {
  const missions = loadMissions([
    { ...fixture, id: 'zeta' }, { ...fixture, id: 'alpha' }, { ...fixture, id: 'third' },
  ]);
  assert.deepEqual(missions.map(m => m.id), ['alpha', 'third', 'zeta']);
});

test('empty catalogs and duplicate identifiers are rejected', () => {
  assert.throws(() => loadMissions([]), /empty/i);
  assert.throws(() => loadMissions([fixture, { ...fixture, title: 'Другое имя' }]), /duplicate/i);
});

test('mission themes are validated and do not change the simulation', () => {
  const classic = validateMission(fixture);
  const pink = validateMission({ ...fixture, theme: 'pink' });
  assert.equal(classic.theme, 'classic');
  assert.equal(pink.theme, 'pink');
  assert.deepEqual(createGame(pink), createGame(classic));
  for (const theme of ['unknown', null, '', 42, {}]) {
    assert.throws(() => validateMission({ ...fixture, theme }), /theme/);
  }
});

test('Barbie mission is winnable with normal controls and can be restarted deterministically', () => {
  const mission = validateMission(presets().find(mission => mission.id === 'barbie-dream-orbit'));
  const initial = createGame(mission);
  let state = initial;
  // Repeat a one-second manoeuvre: turn for 1/3 s, thrust for 1/2 s, keep firing.
  for (let frame = 0; frame < 3000 && state.status === 'playing'; frame++) {
    state = stepGame(state, { fire: true, right: frame % 60 < 20, thrust: frame % 60 < 30 }, 1 / 60);
  }
  assert.equal(state.status, 'won');
  assert.equal(state.elapsed, mission.durationSeconds);
  assert.ok(state.lives > 0);
  assert.deepEqual(createGame(mission), initial);
});

test('invalid mission metadata and numeric settings are rejected', () => {
  for (const changed of [
    { id: '' }, { id: '../bad' }, { title: ' ' }, { description: '' },
    { seed: 1.5 }, { seed: Infinity }, { asteroidCount: 0 },
    { asteroidCount: 31 }, { asteroidCount: 2.5 }, { asteroidSpeed: 0 },
    { asteroidSpeed: -1 }, { asteroidSpeed: NaN }, { asteroidSpeed: Infinity },
  ]) assert.throws(() => validateMission({ ...fixture, ...changed }));
  for (const value of [null, [], 'mission']) assert.throws(() => validateMission(value));
});


test('mission objectives reach the simulation while old JSON keeps waves', () => {
  const legacy = createGame(validateMission(fixture));
  legacy.asteroids = [];
  assert.equal(stepGame(legacy, {}, 0.01).wave, 2);
  const clear = createGame(validateMission({ ...fixture, mode: 'clear' }));
  clear.asteroids = [];
  assert.equal(stepGame(clear, {}, 0.01).status, 'won');
  const timed = createGame(validateMission({ ...fixture, mode: 'survival', durationSeconds: 1, spawnIntervalSeconds: 0.5 }));
  timed.elapsed = 0.99;
  timed.ship.invulnerable = 10;
  assert.equal(stepGame(timed, {}, 0.02).status, 'won');
  assert.equal(timed.settings.spawnIntervalSeconds, 0.5);
  for (const changed of [{mode:'unknown'}, {mode:null}, {durationSeconds:0}, {spawnIntervalSeconds:0}]) {
    assert.throws(() => validateMission({ ...fixture, ...changed }));
  }
});
