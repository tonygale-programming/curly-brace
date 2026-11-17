/**
 * All JSON reading, writing and repairing goes through this module.
 *
 * lossless-json keeps every number exactly as written, and jsonrepair fixes broken JSON.
 * Both are loaded as plain scripts (vendor/ in index.html) and set globals. If either fails to load,
 * this falls back to the built-in JSON object and turns Repair off. globalThis rather than window,
 * so the unit tests can load the same libraries in Node.
 */
import { findSyntaxError } from './syntax-checker.js';

const losslessJson = globalThis.LosslessJSON ?? null;
const jsonRepair = globalThis.JSONRepair?.jsonrepair ?? null;

const POSITION_PATTERN = /at position (\d+)/;
const DUPLICATE_KEY_PATTERN = /^Duplicate key '(.*)' encountered/;

export const canRepair = jsonRepair !== null;

function parseJson(text) {
  return losslessJson ? losslessJson.parse(text) : JSON.parse(text);
}

/** @param {number | string} [indent] spaces or '\t'; leave out to minify */
export function stringifyJson(value, indent) {
  return losslessJson
    ? losslessJson.stringify(value, null, indent)
    : JSON.stringify(value, null, indent);
}

/**
 * Minifies the data and wraps it in one JSON string, with quotes and backslashes escaped,
 * ready to paste into code, a config value or a request body: {"a":1} becomes "{\"a\":1}".
 */
export function stringifyAsEscapedString(value) {
  return JSON.stringify(stringifyJson(value));
}

/**
 * When the data is one string that itself holds a JSON object or array (what Stringify makes),
 * returns that inner data; otherwise null. Lets Format and Minify undo a Stringify.
 */
export function unwrapStringifiedJson(data) {
  if (typeof data !== 'string') return null;
  try {
    const innerData = parseJson(data);
    return isPrimitive(innerData) ? null : innerData;
  } catch {
    return null;
  }
}

/**
 * Parses the text and, when it is invalid, explains why.
 * @returns {{ data: unknown, error: null } | { data: null, error: { position: number, message: string, repairable: boolean } }}
 */
export function readJson(text) {
  try {
    return { data: parseJson(text), error: null };
  } catch (parserError) {
    const syntaxError = findSyntaxError(text);
    const error = syntaxError
      ? { ...syntaxError, repairable: true }
      : explainParserError(parserError);
    return { data: null, error };
  }
}

/** Returns the repaired text. Throws when the text is too broken to repair. */
export function repairJson(text) {
  if (!canRepair) throw new Error('Repair is unavailable because its library did not load.');
  return jsonRepair(text);
}

/** True for a number parsed by lossless-json (stored as an object to keep its exact digits). */
function isLosslessNumber(value) {
  return losslessJson !== null && losslessJson.isLosslessNumber(value);
}

/** True for strings, numbers, booleans and null: values that have no children. */
export function isPrimitive(value) {
  return value === null || typeof value !== 'object' || isLosslessNumber(value);
}

/** The digits of a number exactly as they appeared in the input. */
export function getNumberText(number) {
  return isLosslessNumber(number) ? number.value : String(number);
}

/**
 * Sorts object keys at every level. The order is by Unicode code, the same everywhere and the same as
 * `jq -S` and Python's sort_keys (so capitals come before lowercase), rather than the visitor's language order.
 */
export function sortKeysDeep(value) {
  if (isPrimitive(value)) return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);

  const sortedKeys = Object.keys(value).sort();
  const sorted = {};
  for (const key of sortedKeys) sorted[key] = sortKeysDeep(value[key]);
  return sorted;
}

/**
 * Counts every value, measures how deeply the data is nested, and counts numbers
 * that the built-in JSON.parse would have rounded.
 */
export function describeStructure(root) {
  let valueCount = 0;
  let maxDepth = 0;
  let preservedNumberCount = 0;
  const pending = [{ value: root, depth: 1 }];

  while (pending.length > 0) {
    const { value, depth } = pending.pop();
    valueCount++;
    maxDepth = Math.max(maxDepth, depth);

    if (isLosslessNumber(value)) {
      if (!losslessJson.isSafeNumber(value.value)) preservedNumberCount++;
    } else if (!isPrimitive(value)) {
      for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 });
    }
  }
  return { valueCount, maxDepth, preservedNumberCount };
}

/**
 * Turns a lossless-json error into our error shape. This only happens for problems
 * the syntax checker does not look for, such as duplicate keys with different values.
 */
function explainParserError(error) {
  const message = String(error?.message ?? error);
  const positionMatch = POSITION_PATTERN.exec(message);
  const duplicateKeyMatch = DUPLICATE_KEY_PATTERN.exec(message);
  const position = positionMatch ? Number(positionMatch[1]) : 0;

  if (duplicateKeyMatch) {
    return {
      position,
      message: `Duplicate key "${duplicateKeyMatch[1]}" with a different value. Programs disagree on which value wins, so keep only one.`,
      repairable: false,
    };
  }
  return {
    position,
    message: `${message.replace(/\s*at position \d+$/, '')}.`,
    repairable: true,
  };
}
