/**
 * JSON with comments and trailing commas, which is what a config file wants to
 * be. Node cannot parse either, so both are blanked out before `JSON.parse`.
 *
 * Comments are replaced with spaces rather than removed, and newlines inside a
 * block comment are kept, so the position `JSON.parse` reports still points at
 * the right line of the file the user actually wrote.
 */

/** Copies a JSON string literal verbatim, escapes and all. Returns the index after it. */
const copyString = (text, start, push) => {
  push(text[start])
  let i = start + 1
  while (i < text.length) {
    const c = text[i]
    push(c)
    i += 1
    if (c === '\\') {
      if (i < text.length) {
        push(text[i])
        i += 1
      }
    } else if (c === '"') {
      break
    }
  }
  return i
}

const blankComments = (text) => {
  let out = ''
  const push = (c) => {
    out += c
  }
  let i = 0

  while (i < text.length) {
    const c = text[i]

    if (c === '"') {
      i = copyString(text, i, push)
      continue
    }

    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') {
        out += ' '
        i += 1
      }
      continue
    }

    if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2)
      const stop = close === -1 ? text.length : close + 2
      while (i < stop) {
        out += text[i] === '\n' ? '\n' : ' '
        i += 1
      }
      continue
    }

    out += c
    i += 1
  }

  return out
}

/** Assumes comments are already blanked, so a comma before a `// note` is still seen as trailing. */
const blankTrailingCommas = (text) => {
  let out = ''
  const push = (c) => {
    out += c
  }
  let i = 0

  while (i < text.length) {
    const c = text[i]

    if (c === '"') {
      i = copyString(text, i, push)
      continue
    }

    if (c === ',') {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) j += 1
      if (text[j] === '}' || text[j] === ']') {
        out += ' '
        i += 1
        continue
      }
    }

    out += c
    i += 1
  }

  return out
}

/**
 * Turns a `JSON.parse` complaint into something with a line number on it.
 *
 * V8 has reported these two ways: older Node gave `at position 123`, current
 * Node quotes a snippet ending at the problem instead. Both are handled, and
 * if a future version does something else again the original message still
 * goes out — it quotes the offending text, which in a file this size is
 * usually enough to find it.
 */
const locate = (text, message) => {
  const lineCol = (index) => {
    const upto = text.slice(0, index)
    return `line ${upto.split('\n').length}, column ${upto.length - upto.lastIndexOf('\n')}`
  }

  const position = /at position (\d+)/.exec(message)
  if (position) {
    return message.replace(/at position \d+/, `at ${lineCol(Number(position[1]))}`)
  }

  /* `Unexpected token '}', ..."anels": [ }" is not valid JSON` — V8 quotes
     roughly thirty characters around the problem. Where inside that the
     problem sits is not stated, so this points at where the quote starts:
     the right line, or the one just before it. */
  const snippet = /"((?:[^"\\]|\\.)*)"\.?\.?\.? is not valid JSON/.exec(message)
  if (snippet) {
    const at = text.indexOf(snippet[1])
    if (at !== -1) {
      return `${message.replace(/ is not valid JSON$/, '')} — near ${lineCol(at)}`
    }
  }

  return message
}

export const parseJsonc = (text, label = null) => {
  const cleaned = blankTrailingCommas(blankComments(text))
  try {
    return JSON.parse(cleaned)
  } catch (error) {
    const where = label ? `${label}: ` : ''
    throw new Error(where + locate(cleaned, error.message))
  }
}
