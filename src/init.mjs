/**
 * `shotframe init` — writes a config you can read, next to a folder to put
 * captures in.
 *
 * The scaffold is commented because the config format allows it, and a store
 * listing is the kind of thing you touch twice a year: the file should still
 * make sense the second time.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * Editors read a relative `$schema` from the config's own folder. If the
 * package is installed locally we can point at it and get completion and
 * hover docs for free; run through `pnpm dlx` there is nothing to point at,
 * so the line is left out rather than dangling.
 */
const schemaPath = (configDir) => {
  let dir = resolve(configDir)
  while (true) {
    const candidate = join(
      dir,
      'node_modules/@mrmartineau/shotframe/schema.json',
    )
    if (existsSync(candidate)) {
      const rel = relative(configDir, candidate)
      return rel.startsWith('.') ? rel : `./${rel}`
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const template = (schema) => `{
${schema ? `  "$schema": "${schema}",\n\n` : ''}\
  // A preset, or { "width": …, "height": …, "scale": … } in CSS points.
  // iphone-6.9 renders at 1320 × 2868, which is what App Store Connect wants.
  "device": "iphone-6.9",

  // Raw simulator captures in, framed screenshots out. Both are relative to
  // this file. Shoot the whole set in one appearance — a light capture among
  // five dark ones reads as a mistake rather than a choice.
  "sources": "sources",
  "out": "fastlane/screenshots/en-GB",

  "theme": {
    // Any CSS background value, so a gradient stack is fine. Take these from
    // wherever the app's own colours live: a listing that invents its own
    // palette stops looking like the app it is selling.
    "background": "linear-gradient(180deg, #1f2430 0%, #0d1016 100%)",
    "fonts": {
      "display": "\\"SF Pro Rounded\\", -apple-system, sans-serif",
      "text": "\\"SF Pro Text\\", -apple-system, sans-serif"
    },
    "colors": {
      "eyebrow": "#8f9bb3",
      "heading": "#ffffff",
      "body": "#c7cede"
    }
  },

  // Heading and body each get two lines of space whether they use them or not,
  // which is what keeps the phone at the same height in every panel. Copy that
  // needs a third line fails the build instead of pushing the phone out of
  // frame — keep headings under about 40 characters and bodies under 110.
  "panels": [
    {
      "slug": "01-first",
      "source": "first.png",
      "eyebrow": "Section",
      "heading": "What this screen is for",
      "body": "One sentence on why someone would want it, in their words rather than yours."
    }
  ]
}
`

export const runInit = (configPath) => {
  const target = resolve(configPath)
  const dir = dirname(target)

  if (existsSync(target)) {
    return { wrote: null, note: `${target} already exists — left alone.` }
  }

  mkdirSync(dir, { recursive: true })
  writeFileSync(target, template(schemaPath(dir)))

  const sources = join(dir, 'sources')
  const madeSources = !existsSync(sources)
  if (madeSources) mkdirSync(sources, { recursive: true })

  return { wrote: target, sources: madeSources ? sources : null }
}
