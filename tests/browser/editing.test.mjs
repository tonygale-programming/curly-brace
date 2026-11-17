// Changing the JSON: Format, Minify, Stringify, Undo, Sort keys, errors and Repair, paste, download.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startSiteServer, launchChrome, openSite, waitForCheck, fieldText, typeIntoField, compact,
} from './helpers.mjs';

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
});

const undo = async (page) => {
  await page.focus('#json-input');
  await page.keyboard.press('ControlOrMeta+KeyZ');
  await waitForCheck(page);
};

test('the sample loads, is valid and logs no errors', async () => {
  const { page, consoleErrors } = site;
  assert.equal(await page.textContent('#status-label'), 'Valid JSON');
  assert.match(await fieldText(page), /^\{\n {2}"order": \{/);
  assert.deepEqual(consoleErrors, []);
});

test('Format, Minify and Undo', async () => {
  const { page } = site;
  await typeIntoField(page, '{"b":1,"a":[true,null]}');
  await page.click('#format-button');
  assert.equal(await fieldText(page), '{\n  "b": 1,\n  "a": [\n    true,\n    null\n  ]\n}');
  await page.click('#minify-button');
  assert.equal(await fieldText(page), '{"b":1,"a":[true,null]}');
  await undo(page);
  assert.equal(compact(await fieldText(page)), '{"b":1,"a":[true,null]}');
  assert.match(await fieldText(page), /\n/, 'Undo brings back the formatted text');
});

test('numbers are kept exactly as written', async () => {
  const { page } = site;
  await typeIntoField(page, '{"id": 12345678901234567890, "price": 1.10}');
  await page.click('#format-button');
  const text = await fieldText(page);
  assert.ok(text.includes('12345678901234567890'));
  assert.ok(text.includes('1.10'));
});

test('Stringify twice gives the same text, and Format brings the JSON back', async () => {
  const { page } = site;
  await typeIntoField(page, '{"b": 1, "a": "x"}');
  await page.click('#stringify-button');
  const once = await fieldText(page);
  assert.equal(once, '"{\\"b\\":1,\\"a\\":\\"x\\"}"');
  assert.ok(await page.isDisabled('#stringify-button'));
  await page.keyboard.press('Shift+Alt+KeyS');
  assert.equal(await fieldText(page), once);
  await page.click('#format-button');
  assert.equal(compact(await fieldText(page)), '{"b":1,"a":"x"}');
  assert.ok(await page.isEnabled('#stringify-button'));
});

test('Sort keys sorts by code point, and turning it off brings the old order back', async () => {
  const { page } = site;
  await typeIntoField(page, '{"zebra": 1, "apple": {"y": 2, "b": 3}, "Mango": [3, 1]}');
  await page.click('#format-button');
  const original = await fieldText(page);
  await page.click('#sort-keys-button');
  assert.equal(compact(await fieldText(page)), '{"Mango":[3,1],"apple":{"b":3,"y":2},"zebra":1}');
  await page.click('#sort-keys-button');
  assert.equal(await fieldText(page), original);
});

test('after an edit, turning Sort keys off keeps the edited text', async () => {
  const { page } = site;
  await typeIntoField(page, '{"b": 1, "a": 2}');
  await page.click('#sort-keys-button');
  await page.focus('#json-input');
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' ');
  await waitForCheck(page);
  const edited = await fieldText(page);
  await page.click('#sort-keys-button');
  assert.equal(await fieldText(page), edited);
});

test('invalid JSON shows the error card, and Repair fixes it', async () => {
  const { page } = site;
  await typeIntoField(page, "{name: 'Ada', tags: ['x',],}");
  assert.equal(await page.textContent('#status-label'), 'Invalid JSON');
  assert.ok(await page.isVisible('#error-card'));
  assert.match(await page.textContent('#error-title'), /^Line 1, column \d+$/);
  assert.ok(await page.isDisabled('#format-button'));
  await page.click('#error-repair-button');
  await waitForCheck(page);
  assert.equal(await page.textContent('#status-label'), 'Valid JSON');
  assert.equal(compact(await fieldText(page)), '{"name":"Ada","tags":["x"]}');
  assert.ok(await page.isHidden('#error-card'));
});

test('Show in input puts the cursor at the error', async () => {
  const { page } = site;
  await typeIntoField(page, '{"a": 1 "b": 2}');
  await page.click('#error-show-button');
  const cursor = await page.evaluate(() => ({
    focused: document.activeElement.id,
    position: document.getElementById('json-input').selectionStart,
  }));
  assert.deepEqual(cursor, { focused: 'json-input', position: 8 });
});

/** Pastes the way a browser does: the paste event first, then the text arrives. */
async function paste(page, text) {
  await page.focus('#json-input');
  await page.evaluate((pastedText) => {
    const field = document.getElementById('json-input');
    field.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }));
    document.execCommand('insertText', false, pastedText);
  }, text);
  await waitForCheck(page);
}

test('pasting into an empty field formats it', async () => {
  const { page } = site;
  await typeIntoField(page, '');
  await paste(page, '{"a":[1,2]}');
  assert.equal(await fieldText(page), '{\n  "a": [\n    1,\n    2\n  ]\n}');
});

test('pasting over all of the text formats it too', async () => {
  const { page } = site;
  await page.focus('#json-input');
  await page.keyboard.press('ControlOrMeta+KeyA');
  await paste(page, '{"b":true}');
  assert.equal(await fieldText(page), '{\n  "b": true\n}');
});

test('pasting into the middle of text leaves it as pasted', async () => {
  const { page } = site;
  await typeIntoField(page, '[1]');
  await page.focus('#json-input');
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('ArrowLeft');
  await paste(page, ',2');
  assert.equal(await fieldText(page), '[1,2]');
});

test('Download saves curly-brace.json with the field text', async () => {
  const { page } = site;
  await typeIntoField(page, '{"a": 1}');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#download-button')]);
  assert.equal(download.suggestedFilename(), 'curly-brace.json');
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString(), '{"a": 1}');
});

test('Clear empties the field and disables what needs JSON', async () => {
  const { page } = site;
  await page.click('#clear-button');
  await waitForCheck(page);
  assert.equal(await fieldText(page), '');
  assert.equal(await page.textContent('#status-label'), 'Waiting for input');
  for (const id of ['#format-button', '#copy-button', '#download-button', '#tree-tab', '#clear-button']) {
    assert.ok(await page.isDisabled(id), `${id} is disabled`);
  }
});
