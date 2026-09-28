import { test, expect } from '@playwright/test';

test('UFO mission supports combat, pause, victory and restart', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Миссия', {exact:true}).selectOption('uninvited-guest');
  await expect(page.getByRole('heading', {name:'Незваный гость',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Начать полёт',exact:true}).click();
  await page.getByRole('button', {name:'Пауза',exact:true}).click();
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__, s = api.getState();
    s.asteroids = []; s.ufoCountdown = 0; api.setState(s); api.advance();
  });
  const paused = await page.evaluate(() => window.__ASTEROIDS_TEST__.getState());
  expect(paused.ufo).not.toBeNull();
  await expect(page.getByTestId('game-status')).toHaveText('Пауза');
  expect(await page.evaluate(() => window.__ASTEROIDS_TEST__.getState().elapsed)).toBe(paused.elapsed);
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__, s = api.getState();
    s.ufo.x = 100; s.ufo.vx = 0;
    s.bullets = [{id:900,x:100,y:s.ufo.y,vx:0,vy:0,ttl:1}];
    api.setState(s); api.advance();
  });
  await expect(page.getByTestId('score')).toHaveText('200');
  await expect(page.getByTestId('objective-progress')).toContainText('НЛО сбито: 1');
  await page.evaluate(() => {
    const api = window.__ASTEROIDS_TEST__, s = api.getState();
    s.elapsed = 59.99; s.ship.invulnerable = 10; api.setState(s);
  });
  await page.getByRole('button', {name:'Продолжить',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Миссия выполнена',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Повторить миссию',exact:true}).click();
  await expect(page.getByTestId('score')).toHaveText('0');
  await expect(page.getByTestId('lives')).toHaveText('3');
  expect(await page.evaluate(() => window.__ASTEROIDS_TEST__.getState().ufosDestroyed)).toBe(0);
});
