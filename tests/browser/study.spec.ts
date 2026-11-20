import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { Track } from '../../src/core/curriculum.ts';
import { api } from '../../src/server/api.ts';
import { devAuth } from '../../src/server/auth.ts';
import { LocalStore } from '../../src/server/local-store.ts';

const base = '/PlanEstudio/';
const origin = 'https://planestudio.test';

test.beforeEach(async ({ context }) => {
  const handle = api({ auth: devAuth(origin), store: new LocalStore(), library: async () => [
    { title: 'Mathematics for Machine Learning', author: 'Autor de prueba', topic: 'Matemáticas', series: '', note: '' }
  ] });
  const types: Record<string, string> = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2' };
  await context.route(origin + '/**', async route => {
    const input = route.request();
    const path = new URL(input.url()).pathname;
    if (path.startsWith(base + 'api/')) {
      const response = await handle(new Request(input.url(), { method: input.method(), headers: await input.allHeaders(), body: input.postData() ?? undefined }));
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
      return;
    }
    if (!path.startsWith(base)) { await route.fulfill({ status: 404 }); return; }
    const relative = path.slice(base.length) + (path.endsWith('/') ? 'index.html' : '');
    const file = join('dist', relative);
    try { await route.fulfill({ body: await readFile(file), contentType: types[extname(file)] ?? 'application/octet-stream' }); }
    catch { await route.fulfill({ status: 404 }); }
  });
});

test('en móvil un retorno de Google usa la misma prueba PKCE y abre el panel una sola vez', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  const callback = origin + base + 'auth/callback/';
  const authorize = 'https://login.example.test/oauth2/authorize';
  let challenge = '';
  let exchanges = 0;
  await context.route(origin + base + 'api/auth/config', route => route.fulfill({ json: {
    mode: 'google', authorize, clientId: 'mobile-test', callback, resource: origin + base + 'api'
  } }));
  await context.route(origin + base + 'api/bootstrap', async route => {
    const cookies = await route.request().headerValue('cookie');
    if (cookies?.includes('__Secure-planestudio=test-session')) await route.fallback();
    else await route.fulfill({ status: 401, json: { error: 'Inicia sesión.' } });
  });
  await context.route(authorize + '?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('redirect_uri')).toBe(callback);
    expect(params.get('code_challenge_method')).toBe('S256');
    challenge = params.get('code_challenge')!;
    const back = new URL(callback);
    back.searchParams.set('code', 'test-authorization-code');
    back.searchParams.set('state', params.get('state')!);
    await route.fulfill({ status: 302, headers: { Location: back.href } });
  });
  await context.route(origin + base + 'api/auth/token', async route => {
    exchanges++;
    const { code, verifier } = route.request().postDataJSON();
    expect(code).toBe('test-authorization-code');
    expect(createHash('sha256').update(verifier).digest('base64url')).toBe(challenge);
    await route.fulfill({ json: { ok: true }, headers: {
      'Set-Cookie': '__Secure-planestudio=test-session; Path=/PlanEstudio/api; HttpOnly; Secure; SameSite=Strict'
    } });
  });
  await page.goto(base);
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible();
  await expect(page).toHaveURL(origin + base);
  expect(exchanges).toBe(1);
});

test('registra minutos y dominio, compara el objetivo y sincroniza los recursos entre vistas', async ({ page, context }) => {
  await page.goto(base + 'progreso/');
  await expect(page.getByRole('heading', { name: 'Progreso', exact: true })).toBeVisible();
  await expect(page.locator('.chart-selection')).toContainText('Sin registros');
  await expect(page.locator('.chart-selection')).toContainText('Semana parcial');
  await page.getByRole('button', { name: 'Registrar sesión', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Minutos estudiados').fill('82');
  await dialog.getByLabel('Nivel de dominio').selectOption('3');
  await dialog.getByLabel('Notas').fill('Práctica de matrices');
  await dialog.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(page.locator('.chart-selection')).toContainText('82 min');
  await expect(page.locator('.chart-selection')).toContainText('600 min');
  await page.getByRole('combobox', { name: 'Ruta de la gráfica' }).selectOption('fullstack');
  await expect(page.locator('.chart-selection')).toContainText('Sin registros');
  await expect(page.locator('.chart-selection')).toContainText('300 min');
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await expect(page.locator('.chart-selection')).not.toContainText('Semana parcial');
  await page.goto(base + 'recursos-adicionales/');
  await page.getByRole('button', { name: 'Agregar recurso' }).click();
  await page.getByRole('textbox', { name: 'Título' }).fill('Documento de prueba');
  await page.getByRole('textbox', { name: 'URL' }).fill('https://example.com/material');
  await page.getByRole('button', { name: 'Guardar recurso' }).click();
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 820 });
  await mobile.goto(base + 'recursos-adicionales/');
  await expect(mobile.getByRole('link', { name: 'Documento de prueba' })).toBeVisible();
  await mobile.getByRole('button', { name: 'Abrir menú' }).click();
  await mobile.getByRole('navigation').getByRole('link', { name: 'Calendario' }).click();
  await expect(mobile.getByText('Práctica de matrices')).toBeVisible();
  await mobile.close();
});

test('renderiza diagramas y exporta las ocho guías con los dos formatos', async ({ page }, info) => {
  const folder = info.outputPath('pdf');
  mkdirSync(folder, { recursive: true });
  for (const track of ['ia', 'fullstack'] as Track[]) {
    for (let week = 1; week <= 4; week++) {
      await page.goto(base + 'rutas/?ruta=' + track + '&semana=' + week);
      await page.getByText('Leer guía semanal', { exact: true }).click();
      await expect(page.locator('.mermaid-diagram svg')).toBeVisible();
      for (const profile of ['mobile', 'a4']) {
        await test.step(track + ' / semana ' + week + ' / ' + profile, async () => {
          await page.getByRole('combobox', { name: 'Formato PDF' }).selectOption(profile);
          const downloaded = page.waitForEvent('download', { timeout: 15_000 });
          await page.getByRole('button', { name: 'Generar PDF' }).click();
          const file = await downloaded;
          expect(file.suggestedFilename()).toBe('PlanEstudio-' + track + '-' + week + '-' + profile + '.pdf');
          await file.saveAs(folder + '/' + file.suggestedFilename());
          await expect(page.getByText('Leer guía semanal', { exact: true })).toBeVisible();
        });
      }
    }
  }
  await page.goto(base + 'rutas/?ruta=ia&semana=5');
  await expect(page.getByText('El PDF y el video se habilitarán', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generar PDF' })).toHaveCount(0);
});
