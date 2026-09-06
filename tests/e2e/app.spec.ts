import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SAMPLE_CSV = [
  'name,sku,barcode,quantity,symbology',
  'Cedar soap,SOAP-CEDAR,5901234123457,4,EAN-13',
  'Small canvas pouch,POUCH-S,036602301979,3,UPC-A',
  'Repair kit,KIT-REPAIR,REPAIR-042,2,Code 128',
].join('\n');

async function openDemo(page: Page): Promise<void> {
  await page.goto('/demo');
  await expect(page.getByLabel('Demo status')).toContainText('sample data, nothing is saved');
  await expect(page.getByRole('heading', { name: 'Every row is printable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Print 9 labels' })).toBeVisible();
}

async function makeReceipt(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'print', {
      value: () => { (window as unknown as { prints: number }).prints = ((window as unknown as { prints: number }).prints ?? 0) + 1; },
    });
  });
  await openDemo(page);
  await page.getByRole('button', { name: 'Print receipt only' }).click();
  await page.waitForFunction(() => (window as unknown as { prints?: number }).prints === 1);
}

async function expectTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, 'target should have a rendered bounding box').not.toBeNull();
  expect(box!.width, 'target width').toBeGreaterThanOrEqual(44);
  expect(box!.height, 'target height').toBeGreaterThanOrEqual(44);
}

test('@claim:demo-sandbox keeps a one-click sample separate from real data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paste CSV text' }).click();
  await page.getByLabel('CSV text').fill(SAMPLE_CSV.replace('Cedar soap', 'Real stock row'));
  await page.getByRole('button', { name: 'Check pasted rows' }).click();
  await expect(page.getByText('Real stock row').first()).toBeVisible();

  await page.getByRole('link', { name: 'Demo', exact: true }).first().click();
  await expect(page).toHaveTitle('Demo — Stock Label Run');
  await expect(page.getByText('Cedar soap').first()).toBeVisible();
  const beforeReset = await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name).sort());
  expect(beforeReset).toEqual(expect.arrayContaining(['stock-label-run', 'demo:stock-label-run']));

  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('Demo reset to the sample receiving run.')).toBeVisible();
  await page.getByRole('button', { name: 'Start for real' }).click();
  await page.waitForURL(/\/$/);
  await expect(page.getByText('Real stock row').first()).toBeVisible();
  const afterLeave = await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name));
  expect(afterLeave).toContain('stock-label-run');
  expect(afterLeave).not.toContain('demo:stock-label-run');
});

test('@claim:private-free-workflow keeps free sample requests on this origin', async ({ page, baseURL }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await openDemo(page);
  await page.waitForTimeout(200);
  const origin = new URL(baseURL!).origin;
  expect(requested.length).toBeGreaterThan(0);
  expect(requested.every((url) => new URL(url).origin === origin)).toBeTruthy();
});

test('@claim:csv-import accepts aliases, quoted values, and a default quantity', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paste CSV text' }).click();
  await page.getByLabel('CSV text').fill('Product,Item Code,GTIN,Qty\n"Soap, cedar",S-1,5901234123457,');
  await page.getByRole('button', { name: 'Check pasted rows' }).click();
  await expect(page.getByRole('heading', { name: 'Every row is printable' })).toBeVisible();
  await expect(page.getByText('Soap, cedar').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Print 1 labels' })).toBeVisible();
});

test('@claim:csv-file-guards rejects unsupported files and files over 2 MB', async ({ page }) => {
  await page.goto('/');
  await page.locator('#csv-file').setInputFiles({ name: 'stock.xlsx', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('not csv') });
  await expect(page.getByRole('alert')).toContainText('Choose a .csv file');
  await page.locator('#csv-file').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 48) });
  await expect(page.getByRole('alert')).toContainText('over 2 MB');
});

test('@claim:gtin-validation prevents printing bad EAN-13 and UPC-A checksums', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paste CSV text' }).click();
  await page.getByLabel('CSV text').fill('name,sku,barcode,quantity,symbology\nEAN,E-1,5901234123458,1,EAN-13\nUPC,U-1,036602301979,1,UPC-A');
  await page.getByRole('button', { name: 'Check pasted rows' }).click();
  await expect(page.getByRole('heading', { name: '1 row needs attention' })).toBeVisible();
  await expect(page.getByText('EAN-13 checksum does not match')).toBeVisible();
  const ean = page.getByLabel('Barcode, row 1');
  await ean.fill('5901234123457');
  await ean.press('Tab');
  await expect(page.getByRole('heading', { name: 'Every row is printable' })).toBeVisible();
});

test('@claim:code-validation checks Code 39 and Code 128 subset B values', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paste CSV text' }).click();
  await page.getByLabel('CSV text').fill('name,sku,barcode,quantity,symbology\nTool,T-1,TOOL-42,1,Code 39\nPart,P-1,Part 42,1,Code 128');
  await page.getByRole('button', { name: 'Check pasted rows' }).click();
  await expect(page.getByRole('heading', { name: 'Every row is printable' })).toBeVisible();
  const code39 = page.getByLabel('Barcode, row 1');
  await code39.fill('tool-42');
  await code39.press('Tab');
  await expect(page.getByText('Code 39 supports uppercase letters')).toBeVisible();
});

test('@claim:a4-label-sheet prints a 30-up A4 proof through the browser print path', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'print', {
      value: () => { (window as unknown as { prints: number }).prints = ((window as unknown as { prints: number }).prints ?? 0) + 1; },
    });
  });
  await openDemo(page);
  await page.getByRole('button', { name: 'Print label run' }).click();
  await page.waitForFunction(() => (window as unknown as { prints?: number }).prints === 1);
  await expect(page.locator('.print-sheet')).toHaveCount(1);
  await page.emulateMedia({ media: 'print' });
  const width = await page.locator('.print-sheet').evaluate((element) => getComputedStyle(element).width);
  expect(parseFloat(width)).toBeGreaterThan(790);
  expect(parseFloat(width)).toBeLessThan(800);
  await expect(page.locator('.print-sheet .stock-label')).toHaveCount(9);
});

test('@claim:receipt-history records exactly what was printed', async ({ page }) => {
  await makeReceipt(page);
  await page.getByRole('button', { name: /Run receipts/ }).click();
  await expect(page.locator('.run-list')).toContainText('9 labels');
  await expect(page.locator('.run-list')).toContainText('3 SKUs');
  await expect(page.locator('.run-list')).toContainText('sample-receiving.csv');
});

test('@claim:backup-round-trip exports and restores a receipt archive from the empty state', async ({ page }) => {
  await page.goto('/');
  const backup = JSON.stringify({
    product: 'stock-label-run',
    version: 1,
    runs: [{
      id: 'restored-run-1', runName: 'Restored delivery', fileName: 'delivery.csv', rawCsv: SAMPLE_CSV,
      importedAt: '2026-09-06T09:00:00.000Z', printedAt: '2026-09-06T10:00:00.000Z', labelCount: 1,
      preset: 'a4-30', footer: '', items: [{ id: 'row-1', name: 'Cedar soap', sku: 'SOAP-CEDAR', barcode: '5901234123457', quantity: 1, symbology: 'EAN-13', issues: [] }],
    }],
  });
  await page.locator('.import-backup').setInputFiles({ name: 'receipt-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.getByRole('heading', { name: 'Run receipts' })).toBeVisible();
  await expect(page.locator('.run-list')).toContainText('Restored delivery');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: /Run receipts 1/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/^stock-label-runs-\d{4}-\d{2}-\d{2}\.json$/);
});

test('@claim:free-label-limit stops runs over 150 labels without blocking core controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paste CSV text' }).click();
  await page.getByLabel('CSV text').fill('name,sku,barcode,quantity,symbology\nBulk item,BULK-1,BULK-151,151,Code 128');
  await page.getByRole('button', { name: 'Check pasted rows' }).click();
  await expect(page.getByRole('heading', { name: 'Print 151 labels' })).toBeVisible();
  await page.getByRole('button', { name: 'Print receipt only' }).click();
  await expect(page.getByRole('heading', { name: 'Restore a run room license' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export backup' })).toBeEnabled();
  await expect(page.getByLabel('Barcode, row 1')).toBeEnabled();
});

test('@claim:receipt-delete removes an individual stored receipt', async ({ page }) => {
  await makeReceipt(page);
  await page.getByRole('button', { name: /Run receipts/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.empty-history')).toBeVisible();
});

test('@claim:license-daily-check verifies at most once per day and leaves free work usable', async ({ page }) => {
  let calls = 0;
  await page.route('https://api.sociobot.in/api/v1/products/stock-label-run/verify?license=*', async (route) => {
    calls += 1;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ valid: false, reason: 'invalid' }) });
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('sb_license:stock-label-run')) localStorage.setItem('sb_license:stock-label-run', 'stored-license');
    if (!localStorage.getItem('sb_license:stock-label-run:verdict')) localStorage.setItem('sb_license:stock-label-run:verdict', JSON.stringify({ valid: false, checkedAt: Date.now() }));
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Paste CSV text' })).toBeVisible();
  await page.waitForTimeout(150);
  expect(calls).toBe(0);
  await page.evaluate(() => localStorage.setItem('sb_license:stock-label-run:verdict', JSON.stringify({ valid: false, checkedAt: 0 })));
  await page.reload();
  await expect.poll(() => calls).toBe(1);
  await page.reload();
  await page.waitForTimeout(150);
  expect(calls).toBe(1);
  await expect(page.getByRole('button', { name: 'Paste CSV text' })).toBeVisible();
});

test('@claim:offline-reload opens the populated demo after the network disappears', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  try {
    await openDemo(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Offline · still ready')).toBeVisible();
    await expect(page.getByLabel('Demo status')).toContainText('nothing is saved');
    await expect(page.getByRole('heading', { name: 'Print 9 labels' })).toBeVisible();
  } finally { await context.close(); }
});

test('@claim:pwa-shell-precache stores the app shell, illustration, and legal pages', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  try {
    await openDemo(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    });
    const cachedPaths = await page.evaluate(async () => {
      const keys = await caches.keys();
      const entries = await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()));
      return entries.flat().map((request) => new URL(request.url).pathname);
    });
    expect(cachedPaths).toEqual(expect.arrayContaining(['/index.html', '/demo/', '/privacy/', '/terms/', '/assets/receiving-run.webp']));
  } finally { await context.close(); }
});

test('provides the job, audience, and first action in the first viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create barcode labels from a stock CSV');
  await expect(page.getByText('For small shops and makers receiving stock, turn one purchase list into checked labels and a saved print receipt.')).toBeVisible();
  const action = page.getByRole('link', { name: 'Try it with sample data' }).first();
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  expect(box!.y + box!.height).toBeLessThan(await page.evaluate(() => innerHeight));
  await expect(page.getByText('CSV stays in this browser.')).toBeVisible();
});

test('keeps populated controls and legal links at 44 px on a 390 px phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'This regression is specific to the required mobile viewport.');
  await openDemo(page);
  const controls = page.locator('button:not([disabled]), a[href], input:not([type="hidden"]):not([hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), label.text-link');
  const undersized = await controls.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { text: (element as HTMLElement).innerText || (element as HTMLInputElement).ariaLabel, width: rect.width, height: rect.height };
  }).filter((item) => item.width < 44 || item.height < 44));
  expect(undersized).toEqual([]);
  await page.goto('/privacy/');
  await expectTouchTarget(page.getByRole('link', { name: 'privacy@sociobot.in' }));
  await expectTouchTarget(page.getByRole('link', { name: 'Terms', exact: true }).last());
});

test('has no serious or critical accessibility violations in empty, demo, and legal states', async ({ page }) => {
  await page.goto('/');
  let results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  await openDemo(page);
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  await page.goto('/terms/');
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('ships named routes, route titles, metadata, and a styled not-found document', async ({ page, request }) => {
  await page.goto('/demo');
  await expect(page).toHaveTitle('Demo — Stock Label Run');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://stock-label-run.sociobot.in/demo');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /social-preview/);
  await page.goto('/privacy/');
  await expect(page).toHaveTitle('Privacy — Stock Label Run');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How Stock Label Run handles data');
  await page.goto('/404.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page was not found');
  await page.goto('/offline.html');
  await expect(page).toHaveTitle('Offline — Stock Label Run');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connect once to use it offline');
  expect((await request.get('/robots.txt')).status()).toBe(200);
  expect((await request.get('/sitemap.xml')).status()).toBe(200);
});
