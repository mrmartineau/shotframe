/** `3 panels`, `1 panel`. Only ever used on words that take a plain -s. */
export const plural = (count, word) =>
  `${count} ${word}${count === 1 ? '' : 's'}`
