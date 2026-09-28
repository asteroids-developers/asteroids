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
  const theme = value.theme === undefined ? 'classic' : value.theme;
  if (!['classic', 'pink'].includes(theme)) throw new TypeError('unknown mission theme');
  return Object.freeze({
    id: value.id, title: value.title.trim(), description: value.description.trim(),
    seed: value.seed, asteroidCount: value.asteroidCount, asteroidSpeed: value.asteroidSpeed,
    mode: value.mode ?? 'waves',
    durationSeconds: value.durationSeconds ?? 60,
    spawnIntervalSeconds: value.spawnIntervalSeconds ?? 1.25,
    speedStages: value.speedStages ? Object.freeze([...value.speedStages]) : null,
    theme,
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
