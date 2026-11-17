/**
 * Shared set-up for the browser tests: a small local web server for the site, and installed Chrome
 * driven by playwright-core. Chrome is not downloaded; set CHROME_PATH if it isn't in the usual place.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const SITE_FOLDER = fileURLToPath(new URL('../../', import.meta.url));

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** Serves the site folder on a free port. Resolves to { url, close }. */
export function startSiteServer() {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filePath = normalize(join(SITE_FOLDER, path.endsWith('/') ? `${path}index.html` : path));
    if (!filePath.startsWith(SITE_FOLDER.endsWith(sep) ? SITE_FOLDER : SITE_FOLDER + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filePath);
      response.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}/`,
        close: () => new Promise((done) => { server.closeAllConnections(); server.close(done); }),
      });
    });
  });
}

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export function launchChrome() {
  const executablePath = process.env.CHROME_PATH ?? MAC_CHROME;
  if (!existsSync(executablePath)) {
    throw new Error(`Chrome not found at ${executablePath}. Set CHROME_PATH to the Chrome program.`);
  }
  return chromium.launch({ executablePath, headless: true });
}

/**
 * Opens the site in a fresh browser context and records console errors and any request that goes
 * to another origin. Returns { context, page, consoleErrors, outsideRequests }.
 */
export async function openSite(browser, siteUrl, { viewport = { width: 1280, height: 800 }, beforeLoad } = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  const outsideRequests = [];
  const siteOrigin = new URL(siteUrl).origin;
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  context.on('request', (request) => {
    const url = request.url();
    if (/^https?:/.test(url) && new URL(url).origin !== siteOrigin) outsideRequests.push(url);
  });
  if (beforeLoad) await beforeLoad(page);
  await page.goto(siteUrl);
  await page.waitForSelector('#status-chip');
  await waitForCheck(page);
  return { context, page, consoleErrors, outsideRequests };
}

/** The field checks its text a moment after typing stops; this waits that moment out. */
export const waitForCheck = (page) => page.waitForTimeout(250);

export const fieldText = (page) => page.inputValue('#json-input');

/** Replaces the field's text as if typed, then waits for the check. */
export async function typeIntoField(page, text) {
  await page.fill('#json-input', text);
  await waitForCheck(page);
}

/** Text with the whitespace removed, to compare JSON regardless of layout. */
export const compact = (text) => text.replace(/\s+/g, '');
