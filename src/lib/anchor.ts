/**
 * Stable, DOM-safe anchor id derived from a library item's own content, so the
 * omnibox and the hub render agree on where an item lives without coupling on
 * array position. Lets search land on the EXACT command/payload (the
 * lands-on-the-line guarantee), not the whole section.
 */
export const anchorId = (s: string): string =>
  'a' + [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7).toString(36);
