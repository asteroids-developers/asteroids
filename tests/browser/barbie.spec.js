import { test, expect } from '@playwright/test';

test('Barbie mission freezes its timer, wins at 45 seconds and resets on replay', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.goto('/?mission=barbie-dream-orbit');
  await expect(page.getByRole('heading', { name: 'Барби: курс на Дримхаус', exact: true })).toBeVisible();
  await expect(page.getByTestId('objective')).toHaveText('Продержитесь 45 секунд');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'pink');
  await page.getByRole('button', { name: 'Начать полёт', exact: true }).click();
  const initial = await page.evaluate(() => window.__ASTEROIDS_TEST__.getState());
  expect(initial.settings).toEqual({ seed: 1959, asteroidCount: 6, asteroidSpeed: 1.1,
    mode: 'survival', durationSeconds: 45, spawnIntervalSeconds: 1.5 });
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__;
    const state = api.getState();
    state.ship.invulnerable = 100;
    api.setState(state);
  });
  await page.clock.runFor(2300);
  await page.keyboard.press('KeyP');
  await expect(page.getByTestId('game-status')).toHaveText('Пауза');
  const paused = await page.evaluate(() => window.__ASTEROIDS_TEST__.getState().elapsed);
  expect(paused).toBeGreaterThan(1);
  await page.clock.runFor(1500);
  expect(await page.evaluate(() => window.__ASTEROIDS_TEST__.getState().elapsed)).toBe(paused);
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__;
    const state = api.getState();
    state.elapsed = 44.99;
    api.setState(state);
    api.advance();
  });
  await expect(page.getByRole('heading', { name: 'Миссия выполнена' })).toBeVisible();
  await expect(page.getByTestId('objective-progress')).toHaveText('Осталось 0 с');
  await page.getByRole('button', { name: 'Повторить миссию', exact: true }).click();
  const restarted = await page.evaluate(() => window.__ASTEROIDS_TEST__.getState());
  expect(restarted).toEqual(initial);
  await expect(page.getByTestId('objective-progress')).toHaveText('Осталось 45 с');
  await expect(page.getByTestId('lives')).toHaveText('3');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'pink');
});

test('Barbie mission can lose, and switching missions restores the classic appearance', async ({ page }) => {
  await page.goto('/');
  const picker = page.getByLabel('Миссия', { exact: true });
  await picker.selectOption('barbie-dream-orbit');
  await expect(page.locator('#start')).toHaveCSS('background-color', 'rgb(255, 159, 215)');
  await expect.poll(() => page.locator('#game').evaluate(canvas =>
    [...canvas.getContext('2d').getImageData(20, 20, 1, 1).data])).toEqual([32, 13, 41, 255]);
  await page.getByRole('button', { name: 'Начать полёт', exact: true }).click();
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__;
    const state = api.getState();
    state.lives = 1;
    state.ship.invulnerable = 0;
    state.asteroids = [{ id: 100, x: state.ship.x, y: state.ship.y,
      vx: 0, vy: 0, size: 3, angle: 0, spin: 0 }];
    api.setState(state);
    api.advance();
  });
  await expect(page.getByRole('heading', { name: 'Полёт завершён' })).toBeVisible();
  await expect(page.getByTestId('lives')).toHaveText('0');
  await expect(picker).toBeEnabled();
  await picker.selectOption('first-flight');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'classic');
  await expect(page.locator('#start')).toHaveCSS('background-color', 'rgb(139, 242, 192)');
  await expect.poll(() => page.locator('#game').evaluate(canvas =>
    [...canvas.getContext('2d').getImageData(20, 20, 1, 1).data])).toEqual([8, 14, 24, 255]);
  await expect(page.getByTestId('objective')).toHaveText('Очистите одну волну');
  await picker.selectOption('barbie-dream-orbit');
  await expect(page.getByTestId('objective-progress')).toHaveText('Осталось 45 с');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'pink');
});
