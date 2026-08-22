import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectPanels } from '../src/build.mjs'
import { defaults } from '../src/config.mjs'
import { resolveDevice } from '../src/devices.mjs'
import { buildCss, buildHtml } from '../src/render.mjs'

const config = {
  ...defaults,
  device: resolveDevice('iphone-6.9'),
  sources: '/shots',
}

const panel = {
  slug: '01',
  source: 'a.png',
  eyebrow: 'Eyebrow',
  heading: 'Heading',
  body: 'Body',
}

test('escapes copy so an ampersand does not break the page', () => {
  const html = buildHtml(config, {
    ...panel,
    heading: 'Sun & shade',
    body: '<not a tag>',
  })
  assert.match(html, /Sun &amp; shade/)
  assert.match(html, /&lt;not a tag&gt;/)
  assert.doesNotMatch(html, /<not a tag>/)
})

test('leaves out the eyebrow and body when a panel has none', () => {
  const html = buildHtml(config, { slug: '01', source: 'a.png', heading: 'Hi' })
  assert.doesNotMatch(html, /class="eyebrow"/)
  assert.doesNotMatch(html, /<p>/)
  assert.match(html, /<h1><span>Hi<\/span><\/h1>/)
})

test('references the capture as a file URL', () => {
  assert.match(buildHtml(config, panel), /src="file:\/\/\/shots\/a\.png"/)
})

test('encodes a capture path with a space in it', () => {
  const html = buildHtml({ ...config, sources: '/my shots' }, panel)
  assert.match(html, /file:\/\/\/my%20shots\/a\.png/)
})

test('the measure script only runs in the measure pass', () => {
  assert.match(buildHtml(config, panel, { measure: true }), /document\.title/)
  assert.doesNotMatch(buildHtml(config, panel), /document\.title/)
})

test('reserves the configured number of lines for heading and body', () => {
  const css = buildCss({
    ...config,
    layout: { ...config.layout, reservedLines: 3 },
  })
  assert.match(css, /min-height: calc\(3 \* 1\.12 \* 30px\)/)
  assert.match(css, /min-height: calc\(3 \* 1\.45 \* 14px\)/)
})

test('extra css goes last, so it can override', () => {
  const css = buildCss({ ...config, css: '  h1 { color: red }' })
  assert.ok(css.trimEnd().endsWith('h1 { color: red }'))
})

test('--only matches on slug or on source file', () => {
  const panels = [
    { slug: '01-garden', source: 'garden.png' },
    { slug: '02-care', source: 'watering.png' },
  ]
  assert.deepEqual(selectPanels(panels, 'garden'), [panels[0]])
  assert.deepEqual(selectPanels(panels, 'watering'), [panels[1]])
  assert.deepEqual(selectPanels(panels, null), panels)
  assert.deepEqual(selectPanels(panels, 'nothing'), [])
})
