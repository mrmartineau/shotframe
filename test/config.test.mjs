import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfig } from '../src/config.mjs'
import { resolveDevice } from '../src/devices.mjs'

const dir = mkdtempSync(join(tmpdir(), 'shotframe-test-'))

/** Writes a config in its own folder, so relative paths resolve somewhere real. */
const write = (name, config) => {
  const path = join(dir, `${name}.json`)
  writeFileSync(
    path,
    typeof config === 'string' ? config : JSON.stringify(config),
  )
  return path
}

const minimal = {
  panels: [{ slug: '01', source: 'a.png', heading: 'Hi' }],
}

test('fills in defaults and keeps what was given', () => {
  const config = loadConfig(
    write('basic', { ...minimal, theme: { colors: { heading: '#abc' } } }),
  )
  assert.equal(config.theme.colors.heading, '#abc')
  assert.equal(config.layout.reservedLines, 2)
  // A partial nested object patches rather than replaces.
  assert.equal(config.theme.colors.body, '#c7cede')
  assert.ok(config.theme.background.includes('linear-gradient'))
})

test('resolves paths against the config file, not the working directory', () => {
  const config = loadConfig(write('paths', { ...minimal, sources: 'shots' }))
  assert.equal(config.sources, join(dir, 'shots'))
  assert.equal(config.out, join(dir, 'screenshots'))
})

test('keeps absolute paths as they are', () => {
  const config = loadConfig(write('abs', { ...minimal, out: '/tmp/elsewhere' }))
  assert.equal(config.out, '/tmp/elsewhere')
})

test('warns about a key it does not know rather than failing', () => {
  const config = loadConfig(write('typo', { ...minimal, colours: {} }))
  assert.match(config.warnings.join('\n'), /Unknown option "colours"/)
})

test('rejects a slug that would not make a filename', () => {
  assert.throws(
    () =>
      loadConfig(
        write('slug', {
          panels: [{ slug: 'a/b', source: 'a.png', heading: 'Hi' }],
        }),
      ),
    /becomes a filename/,
  )
})

test('rejects two panels sharing a slug, which would overwrite', () => {
  assert.throws(
    () =>
      loadConfig(
        write('dupe', {
          panels: [
            { slug: '01', source: 'a.png', heading: 'A' },
            { slug: '01', source: 'b.png', heading: 'B' },
          ],
        }),
      ),
    /used twice/,
  )
})

test('rejects a misspelled panel key outright', () => {
  assert.throws(
    () =>
      loadConfig(
        write('panelkey', {
          panels: [
            { slug: '01', source: 'a.png', heading: 'Hi', headline: 'x' },
          ],
        }),
      ),
    /headline is not an option/,
  )
})

test('reports every problem at once, plus the warnings', () => {
  assert.throws(
    () =>
      loadConfig(
        write('many', {
          device: 'nope',
          colours: {},
          layout: { reservedLines: 0 },
          panels: [{ slug: '01', source: 'a.png', heading: 'Hi' }],
        }),
      ),
    (error) =>
      /2 problems/.test(error.message) &&
      /Unknown device/.test(error.message) &&
      /reservedLines/.test(error.message) &&
      /Unknown option "colours"/.test(error.message),
  )
})

test('says so when the config is not there', () => {
  assert.throws(() => loadConfig(join(dir, 'absent.json')), /No config at/)
})

test('device presets land on whole pixels', () => {
  for (const name of ['iphone-6.9', 'ipad-13', 'android-phone']) {
    const { width, height, scale } = resolveDevice(name)
    assert.ok(Number.isInteger(width * scale), `${name} width`)
    assert.ok(Number.isInteger(height * scale), `${name} height`)
  }
})

test('iphone-6.9 is the size App Store Connect asks for', () => {
  const { width, height, scale } = resolveDevice('iphone-6.9')
  assert.equal(width * scale, 1320)
  assert.equal(height * scale, 2868)
})

test('a custom device that lands on half a pixel is refused', () => {
  assert.throws(
    () => resolveDevice({ width: 401, height: 800, scale: 2.5 }),
    /whole number of\s+pixels/,
  )
})
