// The tree view and its controls, keyboard shortcuts, and the shortcuts window.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startSiteServer, launchChrome, openSite, fieldText, typeIntoField, compact } from './helpers.mjs';

let server;
let browser;
let site;

before(async () => {
  server = await startSiteServer();
  browser = await launchChrome();
});
after(async () => {
  await browser?.close();
  await server?.close();
});
beforeEach(async () => {
  await site?.context.close();
  site = await openSite(browser, server.url);
  await site.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.url });
});

const readClipboard = (page) => page.evaluate(() => navigator.clipboard.readText());

test('Tree view: select a key, copy its path and value', async () => {
  const { page } = site;
  await typeIntoField(page, '{"order": {"first name": "Ada", "items": [7, 8]}}');
  await page.click('#tree-tab');
  assert.ok(await page.isVisible('#tree-view'));
  assert.ok(await page.isHidden('#editor'));

  await page.click('.tree-key:text-is("\\"first name\\"")');
  assert.equal(await page.textContent('#selected-path'), '$.order["first name"]');
  await page.click('#copy-value-button');
  assert.equal(await readClipboard(page), 'Ada');

  await page.click('.tree-key:text-is("\\"items\\"")');
  await page.click('#copy-path-button');
  assert.equal(await readClipboard(page), '$.order.items');
  await page.click('#copy-value-button');
  assert.equal(compact(await readClipboard(page)), '[7,8]');
});

test('Tree view: text-only controls are disabled, Sort keys still works', async () => {
  const { page } = site;
  await typeIntoField(page, '{"b": 1, "a": 2}');
  await page.click('#tree-tab');
  for (const id of ['#format-button', '#minify-button', '#stringify-button', '#indent-select']) {
    assert.ok(await page.isDisabled(id), `${id} is disabled`);
  }
  await page.click('#sort-keys-button');
  const keys = await page.$$eval('#tree-root .tree-key', (elements) => elements.map((element) => element.textContent));
  assert.deepEqual(keys, ['$', '"a"', '"b"']);
});

test('Tree view: one button expands all, then collapses all but the top level', async () => {
  const { page } = site;
  await typeIntoField(page, '{"a": {"b": {"c": {"d": 1}}}}');
  await page.click('#tree-tab');
  const openCount = () => page.$$eval('#tree-root details[open]', (elements) => elements.length);
  await page.click('#expand-toggle');
  assert.equal(await page.getAttribute('#expand-toggle', 'aria-expanded'), 'true');
  assert.equal(await openCount(), 4);
  await page.click('#expand-toggle');
  assert.equal(await page.getAttribute('#expand-toggle', 'aria-expanded'), 'false');
  assert.equal(await openCount(), 1);
});

test('invalid JSON leaves the tree for the text', async () => {
  const { page } = site;
  await page.click('#tree-tab');
  await page.click('#text-tab');
  await typeIntoField(page, '{"a": }');
  assert.ok(await page.isDisabled('#tree-tab'));
  assert.ok(await page.isVisible('#editor'));
});

test('shortcuts: Minify, Format and Switch Text / Tree', async () => {
  const { page } = site;
  await typeIntoField(page, '{"a": [1, 2]}');
  await page.keyboard.press('Shift+Alt+KeyM');
  assert.equal(await fieldText(page), '{"a":[1,2]}');
  await page.keyboard.press('ControlOrMeta+Enter');
  assert.equal(await fieldText(page), '{\n  "a": [\n    1,\n    2\n  ]\n}');
  await page.keyboard.press('Shift+Alt+KeyT');
  assert.equal(await page.getAttribute('#tree-tab', 'aria-selected'), 'true');
  await page.keyboard.press('Shift+Alt+KeyT');
  assert.equal(await page.getAttribute('#text-tab', 'aria-selected'), 'true');
});

test('shortcuts window: opens with ?, ignores other shortcuts, closes with Esc or a click outside', async () => {
  const { page } = site;
  await typeIntoField(page, '{"a": [1, 2]}');
  await page.focus('#format-button');
  await page.keyboard.press('?');
  assert.ok(await page.isVisible('#shortcuts-dialog'));
  assert.ok((await page.textContent('#shortcut-groups')).includes('Minify'));

  await page.keyboard.press('Shift+Alt+KeyM');
  assert.equal(await fieldText(page), '{"a": [1, 2]}', 'Minify did not run behind the window');

  await page.keyboard.press('Escape');
  assert.ok(await page.isHidden('#shortcuts-dialog'));

  await page.click('#shortcuts-button');
  assert.ok(await page.isVisible('#shortcuts-dialog'));
  await page.mouse.click(4, 4);
  assert.ok(await page.isHidden('#shortcuts-dialog'));
});

test('typing ? in the field types it, without opening the window', async () => {
  const { page } = site;
  await typeIntoField(page, '');
  await page.focus('#json-input');
  await page.keyboard.type('?');
  assert.equal(await fieldText(page), '?');
  assert.ok(await page.isHidden('#shortcuts-dialog'));
});

test('the theme button switches theme and remembers it', async () => {
  const { page } = site;
  const before = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  await page.click('#theme-button');
  const expected = before === 'dark' ? 'light' : 'dark';
  assert.equal(await page.getAttribute('html', 'data-theme'), expected);
  await page.reload();
  assert.equal(await page.getAttribute('html', 'data-theme'), expected);
});
