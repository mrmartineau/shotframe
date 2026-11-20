import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseJsonc } from '../src/jsonc.mjs'

test('reads plain JSON', () => {
  assert.deepEqual(parseJsonc('{"a":1}'), { a: 1 })
})

test('drops line and block comments', () => {
  const text = `{
    // a line comment
    "a": 1, /* and a block one
               spanning lines */
    "b": 2
  }`
  assert.deepEqual(parseJsonc(text), { a: 1, b: 2 })
})

test('drops trailing commas, including before a comment', () => {
  assert.deepEqual(parseJsonc('{"a":[1,2,],}'), { a: [1, 2] })
  assert.deepEqual(parseJsonc('{"a":1, // note\n}'), { a: 1 })
})

test('leaves comment-like text inside strings alone', () => {
  assert.deepEqual(parseJsonc('{"a":"x // y /* z */"}'), {
    a: 'x // y /* z */',
  })
  assert.deepEqual(parseJsonc('{"a":"quote \\" then // no"}'), {
    a: 'quote " then // no',
  })
})

test('a comma inside a string is not a trailing comma', () => {
  assert.deepEqual(parseJsonc('{"a":"one, ]","b":1}'), { a: 'one, ]', b: 1 })
})

test('an unterminated block comment runs to the end rather than throwing', () => {
  assert.deepEqual(parseJsonc('{"a":1} /* off we go'), { a: 1 })
})

test('names the file and points at a line', () => {
  assert.throws(
    () => parseJsonc('{\n  "a": 1\n  "b": 2\n}', 'cfg.json'),
    (error) => error.message.startsWith('cfg.json:') && /line \d+/.test(error.message),
  )
})
