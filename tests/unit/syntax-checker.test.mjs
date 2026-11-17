import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSyntaxError, getLineAndColumn } from '../../js/syntax-checker.js';

test('valid JSON has no error', () => {
  for (const text of ['{}', '[]', '0', '-1.5e3', '"x"', 'true', 'null', ' {"a": [1, {"b": "c"}]} ', '﻿{}']) {
    assert.equal(findSyntaxError(text), null, text);
  }
});

const errorAt = (text) => findSyntaxError(text)?.position;

test('each kind of mistake is found at the right place', () => {
  assert.equal(errorAt('{"a": 1 "b": 2}'), 8);    // missing comma
  assert.equal(errorAt('{"a": 1,}'), 7);          // trailing comma
  assert.equal(errorAt("{'a': 1}"), 1);           // single quotes
  assert.equal(errorAt('{a: 1}'), 1);             // key without quotes
  assert.equal(errorAt('[01]'), 2);               // leading zero
  assert.equal(errorAt('"tab\there"'), 4);        // raw control character in a string
  assert.equal(errorAt('{"a": tru}'), 6);         // unknown word
  assert.equal(errorAt('{"a": 1'), 7);            // ends too early
  assert.equal(errorAt('{} {}'), 3);              // text after the end
});

test('messages are plain words', () => {
  assert.match(findSyntaxError('{"a": 1,}').message, /comma/i);
  assert.match(findSyntaxError('{"a": 1').message, /closing \} is missing/);
});

test('line and column are 1-based', () => {
  assert.deepEqual(getLineAndColumn('a\nbc\nd', 0), { line: 1, column: 1, lineStart: 0 });
  assert.deepEqual(getLineAndColumn('a\nbc\nd', 3), { line: 2, column: 2, lineStart: 2 });
  assert.deepEqual(getLineAndColumn('a\nbc\nd', 5), { line: 3, column: 1, lineStart: 5 });
});
