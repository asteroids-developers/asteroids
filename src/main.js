import './style.css';
import { createGame, stepGame, WORLD, RADII } from './game/core.js';
import { createRenderer } from './render.js';
import { missions } from './missions/catalog.js';

const canvas = document.querySelector('#game');
const render = createRenderer(canvas);
const overlay = document.querySelector('#overlay');
const startButton = document.querySelector('#start');
const pauseButton = document.querySelector('#pause');
const status = document.querySelector('[data-testid="game-status"]');
const score = document.querySelector('[data-testid="score"]');
const lives = document.querySelector('[data-testid="lives"]');
const fieldValue = document.querySelector('[data-testid="field-value"]');
const fieldLabel = document.querySelector('#field-label');
const objective = document.querySelector('[data-testid="objective"]');
const objectiveProgress = document.querySelector('[data-testid="objective-progress"]');
const missionProgress = document.querySelector('#mission-progress');
const overlayTitle = document.querySelector('#overlay-title');
const overlayCopy = document.querySelector('#overlay-copy');
const overlayTag = document.querySelector('#overlay-tag');
const missionPicker = document.createElement('select');
missionPicker.setAttribute('aria-label', 'Миссия');
for (const mission of missions) {
  const option = document.createElement('option');
  option.value = mission.id;
  option.textContent = mission.title;
  missionPicker.append(option);
}
document.querySelector('#mission-picker').append(missionPicker);
let settings = missions.find(mission => mission.id === 'first-flight') || missions[0];
missionPicker.value = settings.id;
let state = createGame(settings);
let mode = 'ready';
const held = new Set();
let accumulator = 0;
let previousTime = 0;

function input() {
  return {
    left: held.has('ArrowLeft') || held.has('KeyA'),
    right: held.has('ArrowRight') || held.has('KeyD'),
    thrust: held.has('ArrowUp') || held.has('KeyW'),
    fire: held.has('Space'),
  };
}

function updateHud() {
  score.textContent = state.score;
  lives.textContent = state.lives;
  const legacy = state.settings.mode === 'waves';
  fieldLabel.textContent = legacy ? 'ВОЛНА' : 'АСТЕРОИДЫ';
  fieldValue.textContent = legacy ? state.wave : state.asteroids.filter(rock => rock.x + RADII[rock.size] >= 0 && rock.x - RADII[rock.size] <= WORLD.width).length;
  missionProgress.hidden = legacy;
  const timeAttack = state.settings.mode === 'time-attack';
  const remaining = Math.ceil(Math.max(0, state.settings.durationSeconds - state.elapsed));
  if (state.settings.mode === 'clear' || timeAttack) {
    const total = state.settings.asteroidCount * 7;
    objective.textContent = timeAttack ? 'Очистите волну за ' + state.settings.durationSeconds + ' секунд' : 'Очистите одну волну';
    objectiveProgress.textContent = 'Попадания: ' + state.destroyed + ' / ' + total
      + (timeAttack ? ' · Осталось ' + remaining + ' с' : '');
    missionProgress.max = total;
    missionProgress.value = state.destroyed;
  } else if (state.settings.mode === 'survival') {
    objective.textContent = 'Продержитесь ' + state.settings.durationSeconds + ' секунд';
    objectiveProgress.textContent = 'Осталось ' + remaining + ' с';
    missionProgress.max = state.settings.durationSeconds;
    missionProgress.value = state.elapsed;
  } else {
    objective.textContent = 'Продержитесь как можно дольше';
    objectiveProgress.textContent = 'Волна ' + state.wave;
  }
}

function finish() {
  missionPicker.disabled = false;
  mode = 'ended';
  held.clear();
  const won = state.status === 'won';
  const timedOut = !won && state.settings.mode === 'time-attack'
    && state.lives > 0 && state.elapsed >= state.settings.durationSeconds;
  status.textContent = won ? 'Миссия выполнена' : 'Полёт завершён';
  overlayTitle.textContent = status.textContent;
  overlayTag.textContent = won ? 'ЦЕЛЬ ДОСТИГНУТА' : timedOut ? 'ВРЕМЯ ВЫШЛО' : 'РАЗБОР ВЫЛЕТА';
  const result = state.settings.mode === 'survival' ? 'Вы выдержали весь поток.'
    : state.settings.mode === 'time-attack' ? 'Вы успели очистить сектор.' : 'Сектор очищен.';
  overlayCopy.textContent = (won ? result + ' ' : timedOut ? 'Время вышло: в секторе остались астероиды. ' : '')
    + 'Ваш результат: ' + state.score + ' очков.';
  startButton.textContent = won ? 'Повторить миссию' : 'Начать заново';
  pauseButton.disabled = true;
  overlay.hidden = false;
  startButton.focus();
}

function advance(controls = input(), dt = 1 / 60) {
  state = stepGame(state, controls, dt);
  updateHud();
  if (state.status !== 'playing' && mode === 'playing') finish();
}

function start() {
  missionPicker.disabled = true;
  state = createGame(settings);
  mode = 'playing';
  accumulator = 0;
  held.clear();
  overlay.hidden = true;
  pauseButton.disabled = false;
  pauseButton.textContent = 'Пауза';
  status.textContent = 'Полёт идёт';
  updateHud();
  canvas.focus();
}

function togglePause() {
  if (mode !== 'playing' && mode !== 'paused') return;
  mode = mode === 'playing' ? 'paused' : 'playing';
  held.clear();
  accumulator = 0;
  pauseButton.textContent = mode === 'paused' ? 'Продолжить' : 'Пауза';
  status.textContent = mode === 'paused' ? 'Пауза' : 'Полёт идёт';
  if (mode === 'playing') canvas.focus();
}

function updateMissionBriefing() {
  document.querySelector('#mission-title').textContent = settings.title;
  document.querySelector('#mission-description').textContent = settings.description;
  document.querySelector('#mission-difficulty').textContent = settings.mode === 'clear' ? 'Одна волна'
    : settings.mode === 'survival' ? 'Поток · ' + settings.durationSeconds + ' с'
    : settings.mode === 'time-attack' ? 'На время · ' + settings.durationSeconds + ' с' : 'Бесконечные волны';
  overlayCopy.textContent = settings.description;
  document.querySelector('#flight-label').textContent = 'МИССИЯ / ' + settings.title.toUpperCase();
}

missionPicker.addEventListener('change', () => {
  settings = missions.find(mission => mission.id === missionPicker.value);
  state = createGame(settings);
  mode = 'ready';
  held.clear();
  accumulator = 0;
  overlayTitle.textContent = 'Готовы к вылету?';
  overlayTag.textContent = 'ПРЕДПОЛЁТНЫЙ БРИФИНГ';
  overlayCopy.textContent = settings.description;
  startButton.textContent = 'Начать полёт';
  overlay.hidden = false;
  pauseButton.disabled = true;
  status.textContent = 'Ожидание старта';
  updateMissionBriefing();
  updateHud();
});
startButton.addEventListener('click', start);
pauseButton.addEventListener('click', togglePause);
const gameKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Space']);
window.addEventListener('keydown', event => {
  if (event.target.closest?.('button, select, input, textarea, a')) return;
  if (event.code === 'KeyP' && !event.repeat) {
    event.preventDefault();
    togglePause();
  } else if (gameKeys.has(event.code) && mode === 'playing') {
    event.preventDefault();
    held.add(event.code);
  }
});
window.addEventListener('keyup', event => held.delete(event.code));
window.addEventListener('blur', () => { if (mode === 'playing') togglePause(); held.clear(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') togglePause(); });

function frame(timestamp) {
  const delta = previousTime ? Math.min((timestamp - previousTime) / 1000, 0.1) : 0;
  previousTime = timestamp;
  if (mode === 'playing') {
    accumulator += delta;
    while (accumulator >= 1 / 60 && mode === 'playing') {
      advance();
      accumulator -= 1 / 60;
    }
  }
  render(state, mode === 'playing' && input().thrust);
  requestAnimationFrame(frame);
}
updateMissionBriefing();
updateHud();
requestAnimationFrame(frame);

// This branch is eliminated from production builds.
if (import.meta.env.MODE === 'test') {
  window.__ASTEROIDS_TEST__ = {
    getState: () => structuredClone(state),
    setState: value => { state = structuredClone(value); updateHud(); },
    advance: () => advance({}, 1 / 60),
  };
}
