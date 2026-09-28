import { validateSettings } from '../game/core.js';

export function validateMission(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('mission must be an object');
  }
  if (typeof value.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) {
    throw new TypeError('mission id must be a lowercase slug');
  }
  for (const key of ['title', 'description']) {
    if (typeof value[key] !== 'string' || !value[key].trim()) {
      throw new TypeError('mission ' + key + ' must be a non-empty string');
    }
  }
  validateSettings(value);
  return Object.freeze({
    id: value.id, title: value.title.trim(), description: value.description.trim(),
    seed: value.seed, asteroidCount: value.asteroidCount, asteroidSpeed: value.asteroidSpeed,
    mode: value.mode ?? 'waves',
    durationSeconds: value.durationSeconds ?? 60,
    spawnIntervalSeconds: value.spawnIntervalSeconds ?? 1.25,
    enemyCount: value.enemyCount ?? 0,
    bossLives: value.bossLives ?? 0,
  });
}

export function loadMissions(values) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('mission catalog is empty');
  const missions = values.map(validateMission);
  const ids = new Set();
  for (const mission of missions) {
    if (ids.has(mission.id)) throw new Error('duplicate mission id: ' + mission.id);
    ids.add(mission.id);
  }
  return Object.freeze(missions.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
