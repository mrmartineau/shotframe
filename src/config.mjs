/**
 * Loads, merges and checks `shotframe.config.json`.
 *
 * Two rules worth knowing:
 *
 * - Every path in the config is resolved against the **config file's** folder,
 *   not the working directory, so `shotframe -c apps/ios/shotframe.config.json`
 *   from the repo root does the same thing as running it from `apps/ios`.
 * - Defaults cover the structural half — type scale, spacing, bezel geometry —
 *   because those are tuned rather than branded. Colours and fonts default to
 *   something plain on purpose: a listing should carry its own palette, and a
 *   default green would quietly ship on somebody's blue app.
 */
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { resolveDevice } from './devices.mjs'
import { parseJsonc } from './jsonc.mjs'
import { plural } from './plural.mjs'

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

export const defaults = {
  device: 'iphone-6.9',
  sources: 'sources',
  out: 'screenshots',
  chromePath: null,

  theme: {
    background: 'linear-gradient(180deg, #1f2430 0%, #0d1016 100%)',
    fonts: { display: SYSTEM_FONT, text: SYSTEM_FONT },
    colors: {
      eyebrow: '#8f9bb3',
      heading: '#ffffff',
      body: '#c7cede',
    },
  },

  /* Points, measured on the page rather than on the device: the phone is sized
     off whatever height the copy leaves, so these are what the bezel looks like
     at the size it actually renders, not a scale drawing of a real handset. */
  bezel: {
    pad: 7,
    radius: 48,
    screenRadius: 41,
    background: 'linear-gradient(155deg, #6a6a70 0%, #26262b 28%, #141418 62%, #55555c 100%)',
    shadow:
      '0 0 0 .5px rgba(255,255,255,.14), 0 26px 60px rgba(0,0,0,.55), 0 4px 16px rgba(0,0,0,.4)',
  },

  type: {
    eyebrow: {
      size: 11,
      leading: 1,
      weight: 600,
      tracking: 0.9,
      uppercase: true,
    },
    heading: { size: 30, leading: 1.12, weight: 700, tracking: -0.4 },
    body: {
      size: 14,
      leading: 1.45,
      weight: 400,
      tracking: -0.1,
      opacity: 0.88,
    },
  },

  layout: {
    paddingTop: 54,
    paddingX: 36,
    gap: 12,
    stageGap: 30,
    /* Heading and body each get this many lines of space whether they use them
       or not. It is what keeps the phone at the same height across the set —
       without it a one-line heading lifts the device and the screenshots
       visibly jump as you swipe them in the store. A panel that needs more
       fails the build rather than pushing the phone out of frame. */
    reservedLines: 2,
  },

  /** Appended after everything else, for the one thing the config didn't foresee. */
  css: '',

  panels: [],
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const merge = (base, patch, path, problems, warnings) => {
  const out = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const where = path ? `${path}.${key}` : key
    if (!(key in base) && key !== '$schema') {
      warnings.push(`Unknown option "${where}" — ignored.`)
      continue
    }
    if (isObject(base[key]) && isObject(value)) {
      out[key] = merge(base[key], value, where, problems, warnings)
    } else if (isObject(base[key]) && value !== undefined && !isObject(value)) {
      problems.push(`${where} should be an object.`)
    } else {
      out[key] = value
    }
  }
  return out
}

const checkString = (value, where, problems) => {
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push(`${where} should be a non-empty string.`)
  }
}

const checkNumber = (value, where, problems) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    problems.push(`${where} should be a number.`)
  }
}

const checkPanels = (panels, problems) => {
  if (!Array.isArray(panels) || panels.length === 0) {
    problems.push('panels should be a non-empty array.')
    return
  }

  const seen = new Set()
  panels.forEach((panel, index) => {
    const where = `panels[${index}]`
    if (!isObject(panel)) {
      problems.push(`${where} should be an object.`)
      return
    }

    checkString(panel.slug, `${where}.slug`, problems)
    checkString(panel.source, `${where}.source`, problems)
    checkString(panel.heading, `${where}.heading`, problems)

    if (typeof panel.slug === 'string') {
      if (!/^[\w.-]+$/.test(panel.slug)) {
        problems.push(
          `${where}.slug "${panel.slug}" becomes a filename, so keep it to ` +
            'letters, numbers, dots, dashes and underscores.',
        )
      }
      if (seen.has(panel.slug)) {
        problems.push(
          `${where}.slug "${panel.slug}" is used twice — the second would ` +
            'overwrite the first.',
        )
      }
      seen.add(panel.slug)
    }

    for (const key of ['eyebrow', 'body']) {
      if (panel[key] !== undefined && typeof panel[key] !== 'string') {
        problems.push(`${where}.${key} should be a string if it is there at all.`)
      }
    }

    for (const key of Object.keys(panel)) {
      if (!['slug', 'source', 'eyebrow', 'heading', 'body'].includes(key)) {
        problems.push(`${where}.${key} is not an option shotframe knows.`)
      }
    }
  })
}

export const loadConfig = (configPath) => {
  let text
  try {
    text = readFileSync(configPath, 'utf8')
  } catch {
    throw new Error(`No config at ${configPath}. Run \`shotframe init\` to write one.`)
  }

  const raw = parseJsonc(text, configPath)
  if (!isObject(raw)) throw new Error(`${configPath} should hold a JSON object.`)

  const problems = []
  const warnings = []
  const config = merge(defaults, raw, '', problems, warnings)

  checkString(config.sources, 'sources', problems)
  checkString(config.out, 'out', problems)
  checkString(config.theme.background, 'theme.background', problems)
  checkString(config.theme.fonts.display, 'theme.fonts.display', problems)
  checkString(config.theme.fonts.text, 'theme.fonts.text', problems)
  for (const key of ['eyebrow', 'heading', 'body']) {
    checkString(config.theme.colors[key], `theme.colors.${key}`, problems)
  }
  for (const key of ['pad', 'radius', 'screenRadius']) {
    checkNumber(config.bezel[key], `bezel.${key}`, problems)
  }
  for (const [group, keys] of Object.entries({
    eyebrow: ['size', 'leading', 'weight', 'tracking'],
    heading: ['size', 'leading', 'weight', 'tracking'],
    body: ['size', 'leading', 'weight', 'tracking', 'opacity'],
  })) {
    for (const key of keys) {
      checkNumber(config.type[group][key], `type.${group}.${key}`, problems)
    }
  }
  for (const key of ['paddingTop', 'paddingX', 'gap', 'stageGap']) {
    checkNumber(config.layout[key], `layout.${key}`, problems)
  }
  if (!Number.isInteger(config.layout.reservedLines) || config.layout.reservedLines < 1) {
    problems.push('layout.reservedLines should be a whole number, 1 or more.')
  }

  checkPanels(config.panels, problems)

  let device
  try {
    device = resolveDevice(config.device)
  } catch (error) {
    problems.push(error.message)
  }

  if (problems.length) {
    /* Warnings go out with the failure rather than after it: a misspelled key
       is silently ignored, and is very often what caused the problem below. */
    const notes = [...problems, ...warnings]
    throw new Error(
      `${configPath} has ${plural(problems.length, 'problem')}:\n` +
        notes.map((line) => `  · ${line}`).join('\n'),
    )
  }

  const base = dirname(resolve(configPath))
  const fromConfig = (value) => (isAbsolute(value) ? value : resolve(base, value))

  return {
    ...config,
    device,
    sources: fromConfig(config.sources),
    out: fromConfig(config.out),
    chromePath: config.chromePath ? fromConfig(config.chromePath) : null,
    configPath: resolve(configPath),
    warnings,
  }
}
