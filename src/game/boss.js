import { WORLD, RADII } from './world.js';
import { makeAsteroid } from './spawn.js';

export const BOSS_RADIUS = 72;
export const LASER_HALF_WIDTH = 40;
const WARNING_TIME = 0.9;
const ATTACK_TIME = 0.65;
const PATTERNS = { 1: ['left', 'right'], 2: ['both', 'left', 'both', 'right'], 3: ['both', 'laser', 'left', 'laser', 'right'] };

function touchesBoss(body, boss, margin = 0) {
  const dx = Math.abs(body.x - boss.x);
  const dy = body.y - boss.y;
  return Math.hypot(dx, dy) <= BOSS_RADIUS + margin
    || (dx <= 100 + margin && dy >= -35 - margin && dy <= 20 + margin);
}

export function createBoss() {
  return {
    x: WORLD.width / 2, y: 170, hp: 24, maxHp: 24, phase: 1,
    nextAttack: 1.5, attackIndex: 0, attack: null, hitFlash: 0,
  };
}

function spawnSide(state, side) {
  const radius = RADII[2];
  const x = side === 'left' ? -radius : WORLD.width + radius;
  const y = Math.max(90, Math.min(WORLD.height - 90, state.ship.y));
  const rock = makeAsteroid(state, x, y, 2);
  const targetX = state.ship.x;
  const targetY = state.ship.y;
  const length = Math.hypot(targetX - x, targetY - y) || 1;
  const speed = (150 + state.boss.phase * 35) * state.settings.asteroidSpeed;
  rock.vx = (targetX - x) / length * speed;
  rock.vy = (targetY - y) / length * speed;
  rock.bossProjectile = true;
  state.asteroids.push(rock);
}

export function stepBoss(state, dt) {
  const boss = state.boss;
  boss.x = WORLD.width / 2 + Math.sin(state.elapsed * (0.8 + boss.phase * 0.12)) * 180;
  boss.y = 170 + Math.sin(state.elapsed * 1.7) * 16;
  boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  if (boss.attack) {
    boss.attack.remaining -= dt;
    if (boss.attack.remaining > 0) return;
    if (boss.attack.stage === 'warning') {
      boss.attack.stage = 'active';
      boss.attack.remaining = ATTACK_TIME;
      if (boss.attack.kind === 'left' || boss.attack.kind === 'both') spawnSide(state, 'left');
      if (boss.attack.kind === 'right' || boss.attack.kind === 'both') spawnSide(state, 'right');
    } else {
      boss.attack = null;
      boss.nextAttack = Math.max(0.65, 1.35 - boss.phase * 0.2);
    }
    return;
  }
  boss.nextAttack -= dt;
  if (boss.nextAttack > 0) return;
  const pattern = PATTERNS[boss.phase];
  const kind = pattern[boss.attackIndex % pattern.length];
  boss.attackIndex++;
  boss.attack = {
    kind, stage: 'warning', remaining: WARNING_TIME,
    laneX: kind === 'laser' ? Math.max(70, Math.min(WORLD.width - 70, state.ship.x)) : null,
  };
}

export function resolveBossHits(state) {
  const boss = state.boss;
  const spent = new Set();
  for (const shot of state.bullets) {
    if (!touchesBoss(shot, boss, 2)) continue;
    spent.add(shot.id);
    boss.hp = Math.max(0, boss.hp - 1);
    boss.hitFlash = 0.18;
    state.score += 100;
    if (boss.hp === 0) break;
  }
  state.bullets = state.bullets.filter(shot => !spent.has(shot.id));
  if (boss.hp === 0) {
    state.status = 'won';
    boss.attack = null;
    return;
  }
  const phase = boss.hp <= 8 ? 3 : boss.hp <= 16 ? 2 : 1;
  if (phase !== boss.phase) {
    boss.phase = phase;
    boss.attack = null;
    boss.attackIndex = 0;
    boss.nextAttack = 0.8;
  }
}

export function bossHazardHitsShip(state) {
  const { boss, ship } = state;
  const bodyHit = touchesBoss(ship, boss, 12);
  const attack = boss.attack;
  const laserHit = attack?.kind === 'laser' && attack.stage === 'active'
    && ship.y >= boss.y + 52 && Math.abs(ship.x - attack.laneX) < LASER_HALF_WIDTH + 12;
  return bodyHit || laserHit;
}
