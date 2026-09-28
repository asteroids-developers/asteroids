import { test, expect } from '@playwright/test';

test('boss mission displays health, phase changes, attack warning and victory', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Миссия', { exact: true }).selectOption('iron-sentinel');
  await expect(page.getByTestId('boss-hud')).toBeVisible();
  await expect(page.getByTestId('boss-health')).toHaveAttribute('value', '24');
  await expect(page.getByTestId('boss-phase')).toHaveText('ФАЗА 1 / 3');
  await page.getByRole('button', { name: 'Начать полёт', exact: true }).click();
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__;
    const state = api.getState();
    state.boss.hp = 16;
    state.boss.phase = 2;
    state.boss.nextAttack = 0.001;
    state.ship.invulnerable = 100;
    api.setState(state);
    api.advance();
  });
  await expect(page.getByTestId('boss-phase')).toHaveText('ФАЗА 2 / 3');
  await expect(page.getByTestId('attack-warning')).toBeVisible();
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__;
    const state = api.getState();
    state.boss.hp = 1;
    state.boss.phase = 3;
    state.boss.attack = null;
    state.asteroids = [];
    state.bullets = [{ id: 999, x: state.boss.x, y: state.boss.y, vx: 0, vy: 0, ttl: 1 }];
    api.setState(state);
    api.advance();
  });
  await expect(page.getByRole('heading', { name: 'Миссия выполнена' })).toBeVisible();
  await expect(page.getByTestId('boss-health')).toHaveAttribute('value', '0');
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'Миссия выполнена' })).toBeVisible();
  await expect(page.getByTestId('boss-health')).toHaveAttribute('value', '0');
  await page.getByRole('button', { name: 'Повторить миссию' }).click();
  await expect(page.getByTestId('boss-health')).toHaveAttribute('value', '24');
});

test('flight panel can enter and leave fullscreen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'На весь экран' }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe('flight-panel');
  await expect(page.getByRole('button', { name: 'Обычный размер' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(page.getByRole('button', { name: 'На весь экран' })).toBeVisible();
});
