import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightLine } from '../../js/highlighter.js';

// Quotes are escaped as &quot;; turned back here so the expected HTML is easier to read.
const highlight = (line) => highlightLine(line).replaceAll('&quot;', '"');

test('keys, strings, numbers, booleans and null get their own colour', () => {
  assert.equal(
    highlight('  "a": "b", "n": -1.5e3, "t": true, "z": null'),
    '  <span class="token-key">"a"</span><span class="token-punctuation">:</span> <span class="token-string">"b"</span>'
    + '<span class="token-punctuation">,</span> <span class="token-key">"n"</span><span class="token-punctuation">:</span> '
    + '<span class="token-number">-1.5e3</span><span class="token-punctuation">,</span> '
    + '<span class="token-key">"t"</span><span class="token-punctuation">:</span> <span class="token-boolean">true</span>'
    + '<span class="token-punctuation">,</span> <span class="token-key">"z"</span><span class="token-punctuation">:</span> '
    + '<span class="token-null">null</span>',
  );
});

test('digits and brackets inside strings stay part of the string', () => {
  assert.equal(highlight('"[1, 2]"'), '<span class="token-string">"[1, 2]"</span>');
});

test('markup in the JSON is escaped, never inserted', () => {
  const html = highlightLine('{"x": "<img src=x onerror=alert(1)>"} <script>');
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.endsWith('&lt;script&gt;'));
});

test('broken text is still coloured as far as it goes', () => {
  assert.equal(highlightLine("{'a'"), '<span class="token-punctuation">{</span>\'a\'');
});
