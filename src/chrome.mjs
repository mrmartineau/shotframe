/**
 * Finding and driving a headless Chromium.
 *
 * Any Chromium renders this identically — the page is a flexbox column, a
 * gradient and an image — so Brave, Edge or a plain Chromium are all fine
 * stand-ins if Chrome is not installed.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const CANDIDATES = [
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/brave-browser',
  '/usr/bin/microsoft-edge',
  // Windows, if this is ever run through a POSIX-ish shell
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
]

export const findChrome = (configured) => {
  const explicit = configured ?? process.env.SHOTFRAME_CHROME
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new Error(`No browser at ${explicit}.`)
    }
    return explicit
  }

  const found = CANDIDATES.find(existsSync)
  if (!found) {
    throw new Error(
      'No Chrome or Chromium found to render with. Install one, or point ' +
        'shotframe at it with "chromePath" in the config or the ' +
        'SHOTFRAME_CHROME environment variable.',
    )
  }
  return found
}

export const makeRunner = (binary, device) => (args) =>
  execFileSync(
    binary,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      // Captures are referenced with file://, which a file:// page will not
      // load without this.
      '--allow-file-access-from-files',
      `--force-device-scale-factor=${device.scale}`,
      `--window-size=${device.width},${device.height}`,
      ...args,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  )
