// Redraws icons/preview.png (the picture shown when a link is shared) from scripts/preview-image.html.
import { launchChrome, startSiteServer, SITE_FOLDER } from './helpers.mjs';
import { join } from 'node:path';

const server = await startSiteServer();
const browser = await launchChrome();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`${server.url}scripts/preview-image.html`);
await page.evaluate(() => document.fonts.ready);
const outputPath = join(SITE_FOLDER, 'icons', 'preview.png');
await page.screenshot({ path: outputPath });
await browser.close();
await server.close();
console.log(`Saved ${outputPath}`);
