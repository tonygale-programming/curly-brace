// The privacy promises: nothing leaves the browser, the pasted JSON is only kept for this tab,
// and the app works offline. Also the move of settings from the old "brace:" keys.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSiteServer, launchChrome, openSite, fieldText, typeIntoField } from './helpers.mjs';

let server;
let browser;

before(async () => {
  server = await startSiteServer();
  browser = await launchChrome();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

test('the page makes no requests to other sites and logs no errors', async () => {
  const { context, page, consoleErrors, outsideRequests } = await openSite(browser, server.url);
  await page.click('#format-button');
  await page.click('#tree-tab');
  await page.click('#shortcuts-button');
  assert.deepEqual(outsideRequests, []);
  assert.deepEqual(consoleErrors, []);
  await context.close();
});

test('the content security policy blocks sending data out', async () => {
  const { context, page } = await openSite(browser, server.url);
  const result = await page.evaluate(() => fetch('https://example.com/').then(() => 'sent', () => 'blocked'));
  assert.equal(result, 'blocked');
  await context.close();
});

test('the field is kept for a reload of this tab only, never in localStorage', async () => {
  const { context, page } = await openSite(browser, server.url);
  await typeIntoField(page, '{"secret": "s3cr3t"}');
  await page.reload();
  await page.waitForSelector('#status-chip');
  assert.equal(await fieldText(page), '{"secret": "s3cr3t"}');

  const storedForever = await page.evaluate(() => Object.values(localStorage).join('\n'));
  assert.ok(!storedForever.includes('s3cr3t'));

  const newTab = await context.newPage();
  await newTab.goto(server.url);
  await newTab.waitForSelector('#status-chip');
  assert.ok((await fieldText(newTab)).includes('"order"'), 'a new tab starts with the sample');
  await context.close();
});

test('settings saved under the old "brace:" keys carry over, and the old draft is deleted', async () => {
  const { context, page } = await openSite(browser, server.url);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('brace:theme', 'dark');
    localStorage.setItem('brace:indent', '4');
    localStorage.setItem('brace:sort', '1');
    localStorage.setItem('brace:draft', '{"old": "draft"}');
  });
  await page.reload();
  await page.waitForSelector('#status-chip');

  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  assert.equal(await page.inputValue('#indent-select'), '4');
  assert.equal(await page.getAttribute('#sort-keys-button', 'aria-pressed'), 'true');
  const stored = await page.evaluate(() => ({ ...localStorage }));
  assert.deepEqual(stored, { 'curly-brace:theme': 'dark', 'curly-brace:indent': '4', 'curly-brace:sort': '1' });
  assert.ok(!(await fieldText(page)).includes('"old"'));
  await context.close();
});

test('after the first visit, the app works offline', async () => {
  const { context, page } = await openSite(browser, server.url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('#status-chip');
  await typeIntoField(page, '{"offline":true}');
  await page.click('#format-button');
  assert.equal(await fieldText(page), '{\n  "offline": true\n}');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).fontFamily.includes('Plex')), true);
  await context.close();
});
