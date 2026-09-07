import { test, expect } from '@playwright/test';

test('all four real reference files render, resize, and expose working viewer controls', async ({ page }) => {
  const failures: string[] = []; page.on('pageerror', error => failures.push(error.message));
  await page.goto('/');
  for (const query of ['trem2 r47h', 'tp53 r175h', 'brca1 c61g', 'cftr f508del']) {
    await page.getByLabel('Reference structure', { exact: true }).selectOption(query);
    await expect(page.getByRole('button', { name: 'Whole protein', exact: true })).toBeEnabled({ timeout: 25000 });
    await expect(page.locator('.molecule-canvas canvas')).toHaveCount(1);
    await page.getByRole('button', { name: 'Focus residue', exact: true }).click();
    await page.getByRole('button', { name: 'Whole protein', exact: true }).click();
    await page.getByLabel('Representation', { exact: true }).selectOption('stick');
    await page.getByLabel('Representation', { exact: true }).selectOption('cartoon');
    await page.getByLabel('Color', { exact: true }).selectOption('confidence');
    await page.getByRole('button', { name: 'Rotate', exact: true }).click();
    await page.getByRole('button', { name: 'Pause rotation', exact: true }).click();
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save image', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('rosie-reference.png');
  await page.screenshot({ path: 'test-results/rosie-desktop.png', fullPage: true });
  expect(failures).toEqual([]);
});

test('mobile layout does not clip the input, viewer, overlays, or provider settings', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/');
  await page.getByText('Model settings', { exact: false }).first().click();
  await page.getByLabel('Provider', { exact: true }).selectOption('openrouter');
  await page.getByLabel('API key', { exact: true }).fill('test-not-a-real-key');
  await page.getByLabel('Reference structure', { exact: true }).selectOption('trem2 r47h');
  await expect(page.getByRole('button', { name: 'Whole protein', exact: true })).toBeEnabled({ timeout: 25000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const input = await page.getByLabel('Mutation or follow-up question').boundingBox();
  expect(input!.x + input!.width).toBeLessThanOrEqual(375);
  await page.screenshot({ path: 'test-results/rosie-mobile.png', fullPage: true });
  await page.reload(); await page.getByText('Model settings', { exact: false }).first().click();
  await page.getByLabel('Provider', { exact: true }).selectOption('openrouter');
  await expect(page.getByLabel('API key', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('test-not-a-real-key');
});

test('source records, Markdown, model provenance and export come from structured events', async ({ page }) => {
  await page.route('**/api/chat', route => route.fulfill({ contentType: 'application/x-ndjson', body: [
    { type: 'metadata', provider: 'test-provider', model: 'test-model', depth: 'detailed' },
    { type: 'source-start', id: 'source1', name: 'searchUniprot', input: { geneName: 'TREM2' } },
    { type: 'source-result', id: 'source1', name: 'searchUniprot', output: { accession: 'TEST-FIXTURE', sourceUrl: 'https://www.uniprot.org/' } },
    { type: 'text', text: '## Fixture report\n\nThis is a browser test fixture, not scientific evidence.' },
    { type: 'done' },
  ].map(event => JSON.stringify(event)).join('\n') + '\n' }));
  await page.goto('/'); await page.getByLabel('Mutation or follow-up question').fill('TREM2 R47H');
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fixture report' })).toBeVisible();
  await expect(page.getByText('test-provider / test-model', { exact: false })).toBeVisible();
  await page.locator('.source-record > summary').click(); await page.getByText('Inspect full source record').click(); await expect(page.getByText('TEST-FIXTURE', { exact: false })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download research report' }).click();
  expect((await download).suggestedFilename()).toBe('rosie-research.md');
});

test('provider failure and truncated reports remain visibly incomplete and retryable', async ({ page }) => {
  await page.route('**/api/chat', route => route.fulfill({ contentType: 'application/x-ndjson', body: '{"type":"text","text":"Partial test fixture"}\n' }));
  await page.goto('/'); await page.getByRole('button', { name: 'TREM2 R47H', exact: false }).click();
  await expect(page.getByText('The response was interrupted.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry last question' })).toBeEnabled();
  await expect(page.getByText('Incomplete report', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'New conversation' }).click();
  await expect(page.getByText('Enter a mutation to begin.')).toBeVisible();
});

test('failed structure requests expose a usable retry overlay', async ({ page }) => {
  await page.route('**/models/*.pdb', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/'); await page.getByLabel('Reference structure', { exact: true }).selectOption('trem2 r47h');
  await expect(page.getByText('Structure download failed (HTTP 503).')).toBeVisible();
  const retry = page.getByRole('button', { name: 'Retry structure' }); await expect(retry).toBeVisible();
  const bounds = await retry.boundingBox(); const viewer = await page.locator('.viewer-container').boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThan(viewer!.y + viewer!.height);
  await page.unroute('**/models/*.pdb'); await retry.click();
  await expect(page.getByRole('button', { name: 'Whole protein', exact: true })).toBeEnabled({ timeout: 25000 });
});

test('WebGL-disabled browsers retain an inspectable reference sequence', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'OffscreenCanvas', { value: undefined, configurable: true });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).includes('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/'); await page.getByLabel('Reference structure', { exact: true }).selectOption('trem2 r47h');
  await expect(page.getByText('3D rendering is unavailable', { exact: false })).toBeVisible();
  await page.locator('.sequence-panel > summary').click();
  await expect(page.locator('.selected-residue')).toHaveText('47ARG');
});

test('stop keeps a pending request incomplete and allows a fresh conversation', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/chat', async route => {
    await gate;
    await route.fulfill({ contentType: 'application/x-ndjson', body: '{"type":"text","text":"late test fixture"}\n{"type":"done"}\n' }).catch(() => {});
  });
  await page.goto('/'); await page.getByRole('button', { name: 'TREM2 R47H', exact: false }).click();
  await page.getByRole('button', { name: 'Stop research' }).click(); release();
  await expect(page.getByText('Stopped. Any partial response is incomplete.')).toBeVisible();
  await page.getByRole('button', { name: 'New conversation' }).click();
  await expect(page.getByText('Enter a mutation to begin.')).toBeVisible();
  await expect(page.getByText('late test fixture')).toHaveCount(0);
});
