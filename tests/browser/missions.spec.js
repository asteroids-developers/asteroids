import { test, expect } from '@playwright/test';

test('mission selection updates the briefing and the simulation', async ({ page }) => {
  await page.goto('/');
  const picker = page.getByLabel('Миссия', { exact: true });
  expect(await picker.locator('option').count()).toBeGreaterThanOrEqual(2);
  await picker.selectOption('rock-garden');
  await expect(page.getByRole('heading', { name: 'Плотный пояс', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Начать полёт', exact: true }).click();
  await expect(picker).toBeDisabled();
  const settings = await page.evaluate(() => window.__ASTEROIDS_TEST__.getState().settings);
  expect(settings).toEqual({ seed: 2026, asteroidCount: 8, asteroidSpeed: 1.6, mode: 'survival', durationSeconds: 60, spawnIntervalSeconds: 1.25, enemyCount: 0, bossLives: 0 });
});

test('a finished flight permits choosing a different mission', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать полёт', exact: true }).click();
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__;
    const state = api.getState();
    state.lives = 1;
    state.ship.invulnerable = 0;
    state.asteroids = [{ id: 100, x: state.ship.x, y: state.ship.y, vx: 0, vy: 0, size: 3, angle: 0, spin: 0 }];
    api.setState(state);
    api.advance();
  });
  const picker = page.getByLabel('Миссия', { exact: true });
  await expect(picker).toBeEnabled();
  await picker.selectOption('rock-garden');
  await expect(page.getByRole('heading', { name: 'Готовы к вылету?' })).toBeVisible();
  await expect(page.getByTestId('score')).toHaveText('0');
  await page.getByRole('button', { name: 'Начать полёт', exact: true }).click();
  await expect(page.getByTestId('lives')).toHaveText('3');
});
