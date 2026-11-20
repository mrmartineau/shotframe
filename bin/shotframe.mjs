#!/usr/bin/env node
/**
 * shotframe — App Store screenshots from raw simulator captures.
 *
 *   shotframe init            write a config and a sources/ folder
 *   shotframe                 build every panel
 *   shotframe --only watering rebuild one while you tune its copy
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBuild } from '../src/build.mjs'
import { loadConfig } from '../src/config.mjs'
import { deviceNames } from '../src/devices.mjs'
import { runInit } from '../src/init.mjs'
import { plural } from '../src/plural.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'))

/* `.jsonc` first, because the format allows comments and that extension is
   the one editors and linters already understand as JSON-with-comments — a
   commented `.json` needs a line of config in biome or prettier to stop being
   an error. Plain `.json` still works for anyone who prefers it. */
const CONFIG_NAMES = ['shotframe.config.jsonc', 'shotframe.config.json']

const findConfig = () => CONFIG_NAMES.find(existsSync) ?? CONFIG_NAMES[0]

const usage = `
shotframe ${version} — App Store screenshots from raw simulator captures.

  shotframe [options]          build every panel in the config
  shotframe init [options]     write a starter config and a sources/ folder

Options
  -c, --config <path>   config file (default: ${CONFIG_NAMES.join(' or ')})
  -o, --only <text>     build just the panels whose slug or source matches
  -h, --help            this
  -v, --version         version

Devices
  ${deviceNames.join(', ')}, or { "width", "height", "scale" }
`

const parseArgs = (argv) => {
  const options = { command: 'build', config: null, only: null }
  const rest = [...argv]

  while (rest.length) {
    const arg = rest.shift()
    switch (arg) {
      case 'init':
        options.command = 'init'
        break
      case '-c':
      case '--config':
        options.config = rest.shift()
        break
      case '-o':
      case '--only':
        options.only = rest.shift()
        break
      case '-h':
      case '--help':
        options.command = 'help'
        break
      case '-v':
      case '--version':
        options.command = 'version'
        break
      default:
        throw new Error(`Unknown argument "${arg}". Try \`shotframe --help\`.`)
    }
  }

  for (const key of ['config', 'only']) {
    if (options[key] === undefined) {
      throw new Error(`--${key} needs a value.`)
    }
  }

  return options
}

const short = (path) => {
  const rel = relative(process.cwd(), path)
  return rel && !rel.startsWith('..') ? rel : path
}

const main = () => {
  const options = parseArgs(process.argv.slice(2))

  if (options.command === 'help') {
    console.log(usage.trim())
    return
  }

  if (options.command === 'version') {
    console.log(version)
    return
  }

  if (options.command === 'init') {
    const result = runInit(options.config ?? CONFIG_NAMES[0])
    if (result.note) {
      console.log(result.note)
      return
    }
    console.log(`Wrote ${short(result.wrote)}`)
    if (result.sources) console.log(`Wrote ${short(result.sources)}/`)
    console.log(
      '\nDrop your simulator captures in sources/, name them in the config, ' +
        'then run `shotframe`.',
    )
    return
  }

  const config = loadConfig(resolve(options.config ?? findConfig()))
  for (const warning of config.warnings) console.warn(`  ! ${warning}`)

  const { device } = config
  const pixels = `${device.width * device.scale}×${device.height * device.scale}`
  console.log(`${device.name}  ${pixels}  →  ${short(config.out)}`)

  const result = runBuild(config, {
    filter: options.only,
    onPanel: (panel) => console.log(`  ${panel.slug}.png  ${panel.heading}`),
  })

  for (const warning of result.warnings) console.warn(`\n  ! ${warning}`)

  if (result.overflows.length) {
    const lines = result.overflows.map(
      ({ slug, headingLines, bodyLines }) =>
        `  · ${slug}: heading ${plural(headingLines, 'line')}, body ` +
        `${plural(bodyLines, 'line')} — only ${result.reservedLines} of each fit.`,
    )
    console.error(
      `\nCopy too long in ${plural(result.overflows.length, 'panel')}:\n` +
        `${lines.join('\n')}\n\nShorten it in ${short(config.configPath)}.`,
    )
    process.exitCode = 1
    return
  }

  console.log(`\n${plural(result.written.length, 'screenshot')} → ${short(config.out)}/`)
}

try {
  main()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
