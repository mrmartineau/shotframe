/**
 * The build: for each panel, measure the copy, then take the picture.
 *
 * The measure pass exists because a third line of heading or body does not
 * wrap harmlessly — it pushes the phone down and out of the frame, and the
 * damage is easy to miss at thumbnail size. So overflow fails the build rather
 * than shipping.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findChrome, makeRunner } from './chrome.mjs'
import { plural } from './plural.mjs'
import { buildHtml } from './render.mjs'

/** Panels whose slug or source contains `filter`, or all of them if there is none. */
export const selectPanels = (panels, filter) => {
  if (!filter) return panels
  const needle = filter.toLowerCase()
  return panels.filter(
    (panel) =>
      panel.slug.toLowerCase().includes(needle) ||
      panel.source.toLowerCase().includes(needle),
  )
}

/** A set that mixes panels with and without an eyebrow or body will jump as it is swiped. */
const consistencyWarnings = (panels) => {
  const warnings = []
  for (const [key, article] of [
    ['eyebrow', 'an'],
    ['body', 'a'],
  ]) {
    const withIt = panels.filter((panel) => panel[key]).length
    if (withIt > 0 && withIt < panels.length) {
      warnings.push(
        `${withIt} of ${panels.length} panels have ${article} ${key} and the ` +
          'rest do not, so the phone sits at a different height in each. ' +
          `Give them all ${article} ${key}, or none.`,
      )
    }
  }
  return warnings
}

export const runBuild = (
  config,
  { filter = null, onPanel = () => {} } = {},
) => {
  const panels = selectPanels(config.panels, filter)
  if (panels.length === 0) {
    throw new Error(`No panel matches "${filter}".`)
  }

  const chrome = makeRunner(findChrome(config.chromePath), config.device)

  const missing = panels.filter(
    (panel) => !existsSync(join(config.sources, panel.source)),
  )
  if (missing.length) {
    throw new Error(
      `Missing ${plural(missing.length, 'capture')} in ${config.sources}:\n` +
        missing.map((p) => `  · ${p.source}  (${p.slug})`).join('\n'),
    )
  }

  /* Scratch HTML goes to the system temp dir rather than next to the output:
     a crashed run should not leave stray files in a folder fastlane uploads. */
  const work = mkdtempSync(join(tmpdir(), 'shotframe-'))
  mkdirSync(config.out, { recursive: true })

  const { reservedLines } = config.layout
  const overflows = []
  const written = []

  try {
    for (const panel of panels) {
      const measurePage = join(work, `${panel.slug}.measure.html`)
      writeFileSync(measurePage, buildHtml(config, panel, { measure: true }))
      const dom = chrome([
        '--virtual-time-budget=2000',
        '--dump-dom',
        pathToFileURL(measurePage).href,
      ])
      const measured = /lines:(\d+):(\d+)/.exec(dom)
      if (!measured) {
        /* Without a measurement there is no overflow check, and a screenshot
           with the phone pushed out of frame is worse than no screenshot. */
        throw new Error(
          `${panel.slug}: the browser did not report how the copy laid out, ` +
            'so it cannot be checked for overflow.',
        )
      }

      const headingLines = Number(measured[1])
      const bodyLines = Number(measured[2])

      if (headingLines > reservedLines || bodyLines > reservedLines) {
        overflows.push({ slug: panel.slug, headingLines, bodyLines })
        continue
      }

      const shotPage = join(work, `${panel.slug}.html`)
      const file = join(config.out, `${panel.slug}.png`)
      writeFileSync(shotPage, buildHtml(config, panel, { measure: false }))
      chrome([`--screenshot=${file}`, pathToFileURL(shotPage).href])

      written.push(file)
      onPanel(panel, file)
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }

  return {
    written,
    overflows,
    reservedLines,
    warnings: consistencyWarnings(panels),
  }
}
