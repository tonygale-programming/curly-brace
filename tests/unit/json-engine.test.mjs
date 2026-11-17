import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './load-engine.mjs';

const {
  readJson, stringifyJson, stringifyAsEscapedString, unwrapStringifiedJson, sortKeysDeep,
  repairJson, canRepair, describeStructure, getNumberText, isPrimitive,
} = engine;

test('both libraries are loaded', () => {
  assert.ok(canRepair);
  assert.ok(globalThis.LosslessJSON);
});

test('numbers keep their exact digits through read and write', () => {
  const text = '{"id":12345678901234567890,"price":1.10,"tiny":1e-400}';
  const { data, error } = readJson(text);
  assert.equal(error, null);
  assert.equal(stringifyJson(data), text);
  assert.equal(getNumberText(data.price), '1.10');
  assert.ok(isPrimitive(data.id));
});

test('formatting uses the chosen indent', () => {
  const { data } = readJson('{"a":[1,2]}');
  assert.equal(stringifyJson(data, 2), '{\n  "a": [\n    1,\n    2\n  ]\n}');
  assert.equal(stringifyJson(data, '\t'), '{\n\t"a": [\n\t\t1,\n\t\t2\n\t]\n}');
});

test('a syntax error gets a position and a plain message', () => {
  const { data, error } = readJson('{"a": 1 "b": 2}');
  assert.equal(data, null);
  assert.equal(error.position, 8);
  assert.equal(error.repairable, true);
  assert.match(error.message, /comma/i);
});

test('duplicate keys with different values are an error that Repair cannot fix', () => {
  const { error } = readJson('{"a": 1, "a": 2}');
  assert.match(error.message, /^Duplicate key "a"/);
  assert.equal(error.repairable, false);
});

test('Stringify makes one escaped string, and unwrapping gives the data back', () => {
  const { data } = readJson('{"say":"hi \\"you\\""}');
  const stringified = stringifyAsEscapedString(data);
  assert.equal(stringified, '"{\\"say\\":\\"hi \\\\\\"you\\\\\\"\\"}"');
  const inner = unwrapStringifiedJson(readJson(stringified).data);
  assert.equal(stringifyJson(inner), '{"say":"hi \\"you\\""}');
});

test('only strings holding an object or array are unwrapped', () => {
  assert.equal(unwrapStringifiedJson('"just text"'), null);
  assert.equal(unwrapStringifiedJson('42'), null);
  assert.equal(unwrapStringifiedJson(42), null);
  assert.deepEqual(unwrapStringifiedJson('[1]').length, 1);
});

test('Sort keys sorts every level by character code, and leaves arrays in order', () => {
  const { data } = readJson('{"b":{"z":1,"a":2},"a":[{"y":1,"x":2}],"B":0,"é":0}');
  assert.equal(stringifyJson(sortKeysDeep(data)), '{"B":0,"a":[{"x":2,"y":1}],"b":{"a":2,"z":1},"é":0}');
});

test('the structure counts values, depth and numbers JSON.parse would round', () => {
  const { data } = readJson('{"a":[1,2,{"b":null}],"big":12345678901234567890}');
  assert.deepEqual(describeStructure(data), { valueCount: 7, maxDepth: 4, preservedNumberCount: 1 });
});

test('Repair fixes common mistakes', () => {
  assert.equal(repairJson("{name: 'Ada', tags: ['x',],}"), '{"name": "Ada", "tags": ["x"]}');
  assert.equal(repairJson('{"a": True, "b": None}'), '{"a": true, "b": null}');
});
