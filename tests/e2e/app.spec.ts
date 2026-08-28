import { expect, test, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function expectTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, 'target should have a rendered bounding box').not.toBeNull();
  expect(box!.width, 'target width').toBeGreaterThanOrEqual(44);
  expect(box!.height, 'target height').toBeGreaterThanOrEqual(44);
}

test('imports, validates, persists, and archives a receiving run', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/From stock list/);
  await expect(page.getByRole('main')).toBeVisible();
  await page.getByRole('button', { name: 'Try a checked sample' }).click();
  await expect(page.getByRole('heading', { name: 'Every row is printable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Print 9 labels' })).toBeVisible();
  await expect(page.locator('.stock-label').first()).toContainText('Cedar soap');

  await page.reload();
  await expect(page.locator('.source-summary').getByText('sample-receiving.csv')).toBeVisible();
  await page.getByRole('button', { name: 'Print receipt only' }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /Run receipts/ }).click();
  await expect(page.locator('.run-list')).toContainText('9 labels');
});

test('shows CSV errors and lets a keyboard user correct an invalid row', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paste CSV text' }).click();
  const input = page.getByLabel('CSV text');
  await input.fill('name,sku,barcode,quantity\nLamp,L-1,5901234123458,2');
  await page.getByRole('button', { name: 'Check pasted rows' }).click();
  await expect(page.getByRole('heading', { name: '1 row needs attention' })).toBeVisible();
  const barcode = page.getByLabel('Barcode, row 1');
  await barcode.focus();
  await barcode.fill('5901234123457');
  await barcode.press('Tab');
  await expect(page.getByRole('heading', { name: 'Every row is printable' })).toBeVisible();
});

test('has no serious accessibility violations on empty and working states', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Axe is covered on the full desktop DOM');
  await page.goto('/');
  let results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  await page.getByRole('button', { name: 'Try a checked sample' }).click();
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('reopens the installed shell and local draft offline', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a checked sample' }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Offline · still ready')).toBeVisible();
  await expect(page.locator('.source-summary').getByText('sample-receiving.csv')).toBeVisible();
  await context.setOffline(false);
});

test('shows the in-app notice when a service worker update is ready', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    }
    navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'UPDATE_AVAILABLE' } }));
  });
  await expect(page.getByRole('status').filter({ hasText: 'A fresh version is ready. Reload to update.' })).toBeVisible();
});

test('legal routes are complete standalone pages', async ({ page }) => {
  await page.goto('/privacy/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Privacy stays/);
  await page.goto('/terms/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Useful labels/);
});

test('keeps the reported 390px controls at least 44 by 44 CSS pixels', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'This regression is specific to the required mobile viewport.');
  await page.goto('/');

  await expectTouchTarget(page.getByRole('link', { name: 'Stock Label Run home' }));
  await expectTouchTarget(page.getByRole('button', { name: 'Unlock run room' }));
  await expectTouchTarget(page.getByRole('link', { name: 'Privacy', exact: true }));
  await expectTouchTarget(page.getByRole('link', { name: 'Terms', exact: true }));
});

test('ships immutable asset caching and browser hardening deployment policy', async ({ request }) => {
  const response = await request.get('/staticwebapp.config.json');
  expect(response.ok()).toBeTruthy();
  const config = await response.json() as {
    globalHeaders: Record<string, string>;
    routes: Array<{ route: string; headers: Record<string, string> }>;
  };
  const assetRoute = config.routes.find((route) => route.route === '/assets/*');
  const manifestRoute = config.routes.find((route) => route.route === '/manifest.webmanifest');

  expect(assetRoute?.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
  expect(manifestRoute?.headers['Content-Type']).toBe('application/manifest+json');
  expect(config.globalHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  expect(config.globalHeaders['Content-Security-Policy']).toContain("connect-src 'self' https://api.sociobot.in");
  expect(config.globalHeaders['Permissions-Policy']).toContain('camera=()');
  expect(config.globalHeaders['X-Frame-Options']).toBe('DENY');
});
