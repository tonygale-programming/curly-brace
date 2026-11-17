/**
 * Loads the two vendored libraries the way the page does (as plain scripts that set globals),
 * then the JSON engine, which reads those globals when it loads.
 */
import { readFileSync } from 'node:fs';

for (const fileName of ['lossless-json-4.3.3.js', 'jsonrepair-3.15.0.min.js']) {
  const code = readFileSync(new URL(`../../vendor/${fileName}`, import.meta.url), 'utf8');
  new Function(code).call(globalThis);
}

export const engine = await import('../../js/json-engine.js');
