import test from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { characters, spaces, textDifference, transactionChanges } from '../src/tracking.js';

const schema = new Schema({ nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'text*', group: 'block' }, text: { group: 'inline' } }, marks: { strong: {} } });
const stateFor = text => EditorState.create({ schema, doc: schema.node('doc', null, [schema.node('paragraph', null, text ? schema.text(text) : undefined)]) });

test('typing counts Unicode characters and spaces independently', () => {
  assert.equal(characters('Hi 😀'), 4); assert.equal(spaces('Hi 😀'), 1);
});
test('actual steps identify inserted text', () => {
  const tr = stateFor('Hello').tr.insertText(' world', 6);
  assert.deepEqual(transactionChanges([tr]), { inserted: ' world', deleted: '' });
});
test('equal-length replacements still record both changed ranges', () => {
  const tr = stateFor('cat').tr.insertText('dog', 1, 4);
  assert.deepEqual(transactionChanges([tr]), { inserted: 'dog', deleted: 'cat' });
});
test('Backspace and selected-text deletion report removed characters', () => {
  const tr = stateFor('abc def').tr.delete(4, 8);
  assert.deepEqual(transactionChanges([tr]), { inserted: '', deleted: ' def' });
});
test('formatting changes do not count as typing or deletion', () => {
  const tr = stateFor('Hello').tr.addMark(1, 6, schema.marks.strong.create());
  assert.deepEqual(transactionChanges([tr]), { inserted: '', deleted: '' });
});
test('multiple replacements in one transaction use each step document', () => {
  const tr = stateFor('abc').tr.insertText('X', 2, 3).insertText('YZ', 4);
  assert.deepEqual(transactionChanges([tr]), { inserted: 'XYZ', deleted: 'b' });
});
test('composition counts the final replacement, excluding interim IME text', () => {
  assert.deepEqual(textDifference('I type ni', 'I type 你'), { inserted: '你', deleted: 'ni' });
  assert.deepEqual(textDifference('', '你'), { inserted: '你', deleted: '' });
});
