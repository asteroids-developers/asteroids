import { test, expect } from '@playwright/test';

test('clear mission shows a finite objective, wins and resets on replay', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('objective')).toHaveText('Очистите одну волну');
  await expect(page.getByTestId('objective-progress')).toHaveText('Попадания: 0 / 21');
  await page.getByRole('button', { name: 'Начать полёт', exact: true }).click();
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__;
    const state = api.getState();
    state.destroyed = 20;
    state.asteroids = [{ id: 100, x: 100, y: 100, vx: 0, vy: 0, size: 1, angle: 0, spin: 0 }];
    state.bullets = [{ id: 101, x: 100, y: 100, vx: 0, vy: 0, ttl: 1 }];
    api.setState(state);
    api.advance();
  });
  await expect(page.getByRole('heading', { name: 'Миссия выполнена' })).toBeVisible();
  await expect(page.getByTestId('objective-progress')).toHaveText('Попадания: 21 / 21');
  await expect(page.getByLabel('Миссия', { exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Пауза', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Повторить миссию', exact: true }).click();
  await expect(page.getByTestId('objective-progress')).toHaveText('Попадания: 0 / 21');
  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(page.getByTestId('lives')).toHaveText('3');
});

test('survival shows its timer, freezes on pause and wins at the deadline', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Миссия', { exact: true }).selectOption('rock-garden');
  await expect(page.getByTestId('objective')).toHaveText('Продержитесь 60 секунд');
  await expect(page.getByTestId('objective-progress')).toHaveText('Осталось 60 с');
  await page.getByRole('button', { name: 'Начать полёт', exact: true }).click();
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__;
    const state = api.getState();
    state.elapsed = 10;
    state.ship.invulnerable = 100;
    api.setState(state);
  });
  await page.keyboard.press('KeyP');
  const time = await page.evaluate(() => window.__ASTEROIDS_TEST__.getState().elapsed);
  const text = await page.getByTestId('objective-progress').textContent();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.__ASTEROIDS_TEST__.getState().elapsed)).toBe(time);
  await expect(page.getByTestId('objective-progress')).toHaveText(text);
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__;
    const state = api.getState();
    state.elapsed = 59.99;
    api.setState(state);
    api.advance();
  });
  await expect(page.getByRole('heading', { name: 'Миссия выполнена' })).toBeVisible();
  await expect(page.getByTestId('objective-progress')).toHaveText('Осталось 0 с');
  const terminal = await page.evaluate(() => window.__ASTEROIDS_TEST__.getState().elapsed);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.__ASTEROIDS_TEST__.getState().elapsed)).toBe(terminal);
  await page.getByRole('button', { name: 'Повторить миссию', exact: true }).click();
  await expect(page.getByTestId('objective-progress')).toHaveText('Осталось 60 с');
});

test('last-life collision at the deadline displays defeat rather than victory', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Миссия', { exact: true }).selectOption('rock-garden');
  await page.getByRole('button', { name: 'Начать полёт', exact: true }).click();
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__;
    const state = api.getState();
    state.elapsed = 59.99;
    state.lives = 1;
    state.ship.invulnerable = 0;
    state.asteroids = [{ id: 100, x: state.ship.x, y: state.ship.y, vx: 0, vy: 0, size: 3, angle: 0, spin: 0 }];
    api.setState(state);
    api.advance();
  });
  await expect(page.getByRole('heading', { name: 'Полёт завершён' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Миссия выполнена' })).toBeHidden();
});

test('combat mission shows the boss health and wins after the last hit', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Миссия', { exact: true }).selectOption('enemy-squadron');
  await expect(page.getByTestId('objective')).toHaveText('Уничтожьте эскадрилью и босса');
  await expect(page.getByTestId('objective-progress')).toHaveText('Враги: 0 / 3 · Босс: 5 / 5 жизней');
  await page.getByRole('button', { name: 'Начать полёт', exact: true }).click();
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__;
    const state = api.getState();
    state.enemiesDestroyed = 3;
    state.enemies = [];
    state.bossHits = 4;
    state.boss = { id: 100, x: 100, y: 100, angle: 0, cooldown: 10, lives: 1 };
    state.bullets = [{ id: 101, x: 100, y: 100, vx: 0, vy: 0, ttl: 1 }];
    api.setState(state);
    api.advance();
  });
  await expect(page.getByRole('heading', { name: 'Миссия выполнена' })).toBeVisible();
  await expect(page.getByTestId('objective-progress')).toHaveText('Враги: 3 / 3 · Босс: 0 / 5 жизней');
});
