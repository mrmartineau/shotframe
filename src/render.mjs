/**
 * The page each screenshot is rendered from.
 *
 * Everything is expressed in CSS points and Chrome is told to render at the
 * device's scale factor, so the frame is authored at a readable size and lands
 * on the store's pixel dimensions exactly. The capture itself is placed at its
 * natural size inside the bezel and never resampled — the point of the whole
 * exercise is that the pixels the simulator produced are the pixels that ship.
 */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** `2 * 1.12 * 30px` — the space held for a block of copy whether it fills it or not. */
const reserved = (lines, { leading, size }) => `calc(${lines} * ${leading} * ${size}px)`

export const buildCss = (config) => {
  const { device, theme, bezel, type, layout } = config
  const { reservedLines } = layout

  return `
  @page { margin: 0 }
  * { margin: 0; padding: 0; box-sizing: border-box }

  html, body {
    width: ${device.width}px;
    height: ${device.height}px;
    overflow: hidden;
  }

  body {
    display: flex;
    flex-direction: column;
    background: ${theme.background};
    -webkit-font-smoothing: antialiased;
  }

  header {
    padding: ${layout.paddingTop}px ${layout.paddingX}px 0;
    text-align: center;
    flex: none;
  }

  header > :first-child { margin-top: 0 }

  .eyebrow {
    font: ${type.eyebrow.weight} ${type.eyebrow.size}px/${type.eyebrow.leading} ${theme.fonts.text};
    letter-spacing: ${type.eyebrow.tracking}px;
    ${type.eyebrow.uppercase ? 'text-transform: uppercase;' : ''}
    color: ${theme.colors.eyebrow};
  }

  /* Reserving ${reservedLines} lines here and below is what keeps the phone at
     the same height in every panel. Without it a short heading lifts the
     device and the set visibly jumps as it is swiped in the store. Copy
     shorter than the reserved space is centred within it. */
  h1 {
    margin-top: ${layout.gap}px;
    min-height: ${reserved(reservedLines, type.heading)};
    display: flex;
    align-items: center;
    justify-content: center;
    font: ${type.heading.weight} ${type.heading.size}px/${type.heading.leading} ${theme.fonts.display};
    letter-spacing: ${type.heading.tracking}px;
    color: ${theme.colors.heading};
    text-wrap: balance;
  }

  p {
    margin-top: ${layout.gap}px;
    min-height: ${reserved(reservedLines, type.body)};
    font: ${type.body.weight} ${type.body.size}px/${type.body.leading} ${theme.fonts.text};
    letter-spacing: ${type.body.tracking}px;
    color: ${theme.colors.body};
    opacity: ${type.body.opacity};
    text-wrap: pretty;
  }

  /* Takes whatever height the copy leaves, and the phone is sized off it. */
  .stage {
    flex: 1;
    min-height: 0;
    margin-top: ${layout.stageGap}px;
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }

  .phone {
    height: 100%;
    padding: ${bezel.pad}px;
    border-radius: ${bezel.radius}px;
    background: ${bezel.background};
    box-shadow: ${bezel.shadow};
  }

  .phone img {
    height: 100%;
    width: auto;
    display: block;
    border-radius: ${bezel.screenRadius}px;
  }
${config.css}
`
}

/**
 * Reports how many lines the heading and body actually took, by way of the
 * document title — the one thing `--dump-dom` will hand back. Only the measure
 * pass includes this; the screenshot pass leaves it out so a slow script can
 * never affect what is captured.
 */
const measureScript = (type) => `
  const lines = (sel, leading, size) => {
    const el = document.querySelector(sel)
    return el ? Math.round(el.getBoundingClientRect().height / (leading * size)) : 0
  }
  document.title = 'lines:' +
    lines('h1 span', ${type.heading.leading}, ${type.heading.size}) + ':' +
    lines('p span', ${type.body.leading}, ${type.body.size})
`

export const buildHtml = (config, panel, { measure = false } = {}) => {
  const src = pathToFileURL(join(config.sources, panel.source)).href

  return `<!doctype html>
<meta charset="utf-8">
<title>${escapeHtml(panel.slug)}</title>
<style>${buildCss(config)}</style>
<header>
${panel.eyebrow ? `  <div class="eyebrow">${escapeHtml(panel.eyebrow)}</div>\n` : ''}\
  <h1><span>${escapeHtml(panel.heading)}</span></h1>
${panel.body ? `  <p><span>${escapeHtml(panel.body)}</span></p>\n` : ''}\
</header>
<div class="stage">
  <div class="phone"><img src="${src}"></div>
</div>
${measure ? `<script>${measureScript(config.type)}</script>` : ''}
`
}
