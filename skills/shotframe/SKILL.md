---
name: shotframe
description: "Turn raw simulator captures into App Store and Google Play screenshots with shotframe (@mrmartineau/shotframe): writing and fixing shotframe.config.jsonc, picking a device size, keeping panel copy inside the two reserved lines, and handing the set to fastlane deliver. Covers the CLI, every config key, the checks that fail a build, and what each error message means. Use when someone wants App Store screenshots, framed simulator captures, marketing screenshots for a store listing, screenshots for fastlane, or is editing a shotframe config. Triggers on: shotframe, shotframe.config.jsonc, App Store screenshots, store listing screenshots, device frame screenshots, framed simulator captures, fastlane deliver screenshots, copy too long in panel."
---

# shotframe

shotframe takes PNGs shot in a simulator, puts each one in a device bezel under
a heading and a line of copy, and writes the set at the exact pixel size the
store asks for. It renders with headless Chrome and has no npm dependencies.

Nothing here uploads anything. shotframe writes PNGs into a folder, usually the
one `fastlane deliver` reads.

## Start here

Work out which of these you are in before touching anything.

**No config in the project.** Run `shotframe init`. It writes a commented
`shotframe.config.jsonc` and an empty `sources/` folder next to it, and refuses
to overwrite an existing config. Install the package first if you can, because
`init` only writes the `$schema` line when it can find
`node_modules/@mrmartineau/shotframe/schema.json` by walking up from the config
folder. Without that line the editor gives no completion.

**Config exists, captures do not.** The user shoots the screens themselves.
Tell them which simulator to use (see [Devices](#devices)) and to shoot the whole
set in one appearance, light or dark, never a mix. Drop the PNGs in `sources/`.

**Config and captures exist.** Name each capture in `panels`, write the copy,
run `shotframe`.

**A build failed.** Go to [When a build fails](#when-a-build-fails). Most
failures are copy that is too long, and the fix is shorter copy rather than a
bigger `reservedLines`.

## Commands

```sh
shotframe                     # build every panel
shotframe init                # write a starter config and sources/
shotframe --only watering     # rebuild one panel while tuning its copy
shotframe -c apps/ios/shotframe.config.jsonc
shotframe --help
```

| Flag | | |
| --- | --- | --- |
| `-c`, `--config <path>` | | config file to use |
| `-o`, `--only <text>` | | build the panels whose `slug` or `source` contains `<text>`, case-insensitive |
| `-h`, `--help` | | usage |
| `-v`, `--version` | | version |

Without `-c`, shotframe looks for `shotframe.config.jsonc` then
`shotframe.config.json` **in the current working directory only**. It does not
search upwards. Running it from the repo root when the config lives in
`apps/ios/` fails with "No config at ...", so pass `-c`.

`--only` with no match is an error, not an empty build.

## How paths resolve

Every path in the config resolves against **the config file's own folder**, not
the working directory. So `shotframe -c apps/ios/shotframe.config.jsonc` from
the repo root does exactly what running it from `apps/ios` does. Absolute paths
are left alone.

That applies to `sources`, `out` and `chromePath`.

`out` is created if missing. Existing PNGs with the same names are overwritten.

## Config

`shotframe.config.jsonc` or `shotframe.config.json`. Both allow comments and
trailing commas, because shotframe strips them before parsing. `.jsonc` is the
default because editors and linters already treat that extension as
JSON-with-comments, while a commented `.json` needs a line of biome or prettier
config before it stops being an error.

Only `panels` is required.

```jsonc
{
  "$schema": "./node_modules/@mrmartineau/shotframe/schema.json",

  "device": "iphone-6.9",
  "sources": "sources",
  "out": "fastlane/screenshots/en-GB",

  "theme": {
    "background": "linear-gradient(180deg, #1d4527 0%, #0b1c10 100%)",
    "fonts": {
      "display": "\"SF Pro Rounded\", -apple-system, sans-serif",
      "text": "\"SF Pro Text\", -apple-system, sans-serif"
    },
    "colors": {
      "eyebrow": "#9cd19d",
      "heading": "#f0faef",
      "body": "#c2e6c2"
    }
  },

  "panels": [
    {
      "slug": "01-garden",
      "source": "garden.png",
      "eyebrow": "Your garden",
      "heading": "Everything you're growing, in one place",
      "body": "Six houseplants on a windowsill, or half an acre."
    }
  ]
}
```

| Key | Default | |
| --- | --- | --- |
| `device` | `"iphone-6.9"` | preset name, or `{ width, height, scale }` in CSS points |
| `sources` | `"sources"` | folder of raw captures |
| `out` | `"screenshots"` | where framed screenshots are written |
| `theme` | dark slate | `background`, `fonts.display`, `fonts.text`, `colors.eyebrow`, `colors.heading`, `colors.body` |
| `bezel` | | `pad`, `radius`, `screenRadius`, `background`, `shadow` |
| `type` | | `size`, `leading`, `weight`, `tracking` for `eyebrow`, `heading`, `body`, plus `eyebrow.uppercase` and `body.opacity` |
| `layout` | | `paddingTop`, `paddingX`, `gap`, `stageGap`, `reservedLines` |
| `css` | `""` | appended after all generated CSS, so it wins on ties |
| `chromePath` | auto | a Chromium to render with |
| `panels` | required | see below |

A misspelled **top-level** key is a warning and is ignored. A misspelled key
**inside a panel** fails the build outright. That asymmetry is deliberate: a
stray panel key is nearly always copy that was meant to render and silently
would not.

`theme` is the half that should come from the app's own design tokens. The
defaults are a plain dark slate on purpose so that nobody's blue app quietly
ships a green listing. Pull the palette from wherever the app's colours live
and change them together.

### panels

In upload order. Order matters twice: the store shows the first few in search
results, and `fastlane deliver` uploads in filename order, which is why slugs
are usually numbered.

| Key | | |
| --- | --- | --- |
| `slug` | required | output filename without extension; letters, numbers, `.`, `-`, `_` only, and unique across the set |
| `source` | required | filename of a PNG inside `sources` |
| `heading` | required | about 40 characters at the default type scale |
| `eyebrow` | optional | small caps line above the heading |
| `body` | optional | about 110 characters |

Give every panel an eyebrow or none, and a body or none. A set that mixes them
sits the phone at a different height in each panel and visibly jumps as someone
swipes through it. shotframe warns but still builds.

## The copy budget, and why it is a hard limit

Heading and body each get `layout.reservedLines` lines of space (2 by default)
whether they use them or not. That reserved space is what holds the phone at the
same height in every panel. Copy shorter than the reservation is centred inside
it.

Before taking each picture, shotframe renders the panel once with a measuring
script and asks the browser how many lines the heading and body actually took.
If either needs more lines than are reserved, that panel is skipped and the
build exits non-zero. A third line does not wrap harmlessly. It pushes the phone
down and out of the frame, and at thumbnail size the damage is easy to miss.

Two consequences worth knowing:

- **Shorten the copy first.** Raising `reservedLines` to 3 works, but it shrinks
  the phone in every panel across the whole set.
- **The eyebrow is not measured and not reserved.** A long eyebrow that wraps to
  two lines pushes everything down with no error. Keep eyebrows to two or three
  words.

## Devices

| Preset | Points | Pixels | |
| --- | --- | --- | --- |
| `iphone-6.9` | 440 × 956 @3 | 1320 × 2868 | the size App Store Connect requires for iPhone |
| `iphone-6.7` | 430 × 932 @3 | 1290 × 2796 | |
| `iphone-6.5` | 414 × 896 @3 | 1242 × 2688 | |
| `iphone-5.5` | 414 × 736 @3 | 1242 × 2208 | |
| `ipad-13` | 1032 × 1376 @2 | 2064 × 2752 | |
| `ipad-12.9` | 1024 × 1366 @2 | 2048 × 2732 | |
| `android-phone` | 360 × 640 @3 | 1080 × 1920 | Google Play's minimum phone size, a safe floor rather than a requirement |

The page is authored in CSS points and Chrome renders it at `scale`, so
`width × scale` by `height × scale` is what comes out. For a custom size:

```jsonc
"device": { "width": 440, "height": 956, "scale": 3 }
```

Both products have to be whole numbers. shotframe refuses `{ "width": 440.5 }`
because half a pixel is a rejected upload.

Shoot the captures on a simulator whose aspect ratio matches the device you are
rendering. The capture is scaled to the height the copy leaves free, with width
following the aspect ratio, so a capture from a different phone comes out
narrower or wider than the bezel around it.

## Rendering, Chrome and fonts

shotframe drives whatever Chromium it can find. Any of them render this
identically, because the page is a flexbox column, a gradient and an `<img>`.
It looks for Chrome, Chrome Canary, Brave, Edge and Chromium in the usual
macOS, Linux and Windows locations.

Override with `chromePath` in the config or the `SHOTFRAME_CHROME` environment
variable. `SHOTFRAME_CHROME` is the better answer for CI.

**Fonts must be installed on the machine doing the rendering.** The page has no
network access, so a font name that is not installed silently falls back. For a
webfont, put an `@font-face` with a `data:` URI in `css` and name the family in
`theme.fonts`.

That is the thing that most often makes CI output differ from a local run: the
runner has no SF Pro. Either install the fonts on the runner, embed them, or
render on a machine that has them.

## When a build fails

| Message | What happened |
| --- | --- |
| `No config at ...` | wrong working directory, or no config yet. Use `-c`, or `shotframe init` |
| `Copy too long in N panels` | heading or body needs more lines than `reservedLines`. Shorten the copy. The panels that did fit were still written, and the exit code is 1 |
| `Missing N captures in ...` | a `source` filename does not exist in `sources`. Nothing is rendered until every one resolves |
| `panels[2].headline is not an option shotframe knows` | typo in a panel key |
| `Unknown option "theme.colours" — ignored` | a warning, not a failure, but usually the reason the colour did not change |
| `slug "..." is used twice` | the second panel would overwrite the first |
| `Unknown device "..."` | preset name typo, or a custom device given as a string |
| `device 440×956.5 at scale 3 lands on ...` | custom size that is not a whole number of pixels |
| `No Chrome or Chromium found to render with` | set `SHOTFRAME_CHROME` or `chromePath` |
| `... did not report how the copy laid out` | the measuring pass came back empty, so overflow could not be checked. Usually a broken or sandboxed browser binary |

Config problems are all reported at once, with the warnings appended, so one run
tells you everything that is wrong.

## fastlane and CI

Point `out` at the locale folder `deliver` expects:

```jsonc
"out": "fastlane/screenshots/en-GB"
```

`deliver` then picks the set up in filename order. For more than one locale,
keep one config file per language, each with its own `out` and its own
translated copy, and run shotframe once per config.

Because overflow exits non-zero, `shotframe` in CI catches a listing edit that
no longer fits before it reaches App Store Connect. The runner needs a Chromium
and the fonts.

## Programmatic use

```js
import { loadConfig, runBuild } from '@mrmartineau/shotframe'

const config = loadConfig('shotframe.config.jsonc')
const { written, overflows, warnings } = runBuild(config, {
  filter: null,
  onPanel: (panel, file) => console.log(file),
})
```

`loadConfig` throws on any config problem. `runBuild` returns the files it
wrote, the panels it skipped for overflow, and the consistency warnings. It does
not set an exit code, so check `overflows.length` yourself.

Also exported: `selectPanels`, `findChrome`, `defaults`, `devices`,
`deviceNames`, `resolveDevice`, `runInit`, `parseJsonc`, `buildHtml`,
`buildCss`.

## Writing the copy

The heading sells the screen, the body says why someone would want it. Write in
the user's words, not the app's. Roughly 40 characters of heading and 110 of
body fit at the default type scale, and the build tells you when they do not.

Keep the whole set at one reading level: six panels that each open with a verb
read as a set, while a mix of noun phrases and sentences reads as six unrelated
screenshots that happen to share a background.
