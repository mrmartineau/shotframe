/**
 * Canvas presets, in CSS points plus a scale factor.
 *
 * The page is authored in points and rendered by headless Chrome at `scale`, so
 * `width × scale` by `height × scale` is the pixel size that comes out. Each
 * preset below is chosen so that product is exactly a size the store accepts —
 * nothing is resampled on the way, which is the whole reason for doing it this
 * way rather than rendering big and shrinking.
 *
 * If none of these fit, `device` also takes an object:
 *
 *   "device": { "width": 440, "height": 956, "scale": 3 }
 */
export const devices = {
  // App Store Connect display sizes. The 6.9" set is the only one Apple still
  // requires for iPhone; the rest are here for older listings that still carry
  // them.
  'iphone-6.9': { width: 440, height: 956, scale: 3 }, // 1320 × 2868
  'iphone-6.7': { width: 430, height: 932, scale: 3 }, // 1290 × 2796
  'iphone-6.5': { width: 414, height: 896, scale: 3 }, // 1242 × 2688
  'iphone-5.5': { width: 414, height: 736, scale: 3 }, // 1242 × 2208
  'ipad-13': { width: 1032, height: 1376, scale: 2 }, // 2064 × 2752
  'ipad-12.9': { width: 1024, height: 1366, scale: 2 }, // 2048 × 2732

  // Google Play's minimum phone screenshot. Play accepts a range rather than a
  // fixed size, so this is a floor that is always safe, not a requirement.
  'android-phone': { width: 360, height: 640, scale: 3 }, // 1080 × 1920
}

export const deviceNames = Object.keys(devices)

export const resolveDevice = (device) => {
  if (typeof device === 'string') {
    const preset = devices[device]
    if (!preset) {
      throw new Error(
        `Unknown device "${device}". Use one of ${deviceNames.join(', ')}, ` +
          `or give { "width": …, "height": …, "scale": … } instead.`,
      )
    }
    return { ...preset, name: device }
  }

  const { width, height, scale } = device
  for (const [key, value] of Object.entries({ width, height, scale })) {
    if (typeof value !== 'number' || !(value > 0)) {
      throw new Error(`device.${key} must be a positive number.`)
    }
  }
  if (!Number.isInteger(width * scale) || !Number.isInteger(height * scale)) {
    throw new Error(
      `device ${width}×${height} at scale ${scale} lands on ` +
        `${width * scale}×${height * scale}, which is not a whole number of ` +
        `pixels. Pick numbers that multiply cleanly.`,
    )
  }
  return { width, height, scale, name: 'custom' }
}
