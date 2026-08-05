import { expect, test } from 'vitest';
import { parseAll, resolveHref } from './parse.ts';

const corpus = parseAll();

test('parses all 8 docs', () => {
  expect(corpus.docs.length).toBe(8);
});

test('composes to substantial section-level techniques (not thin H3 fragments)', () => {
  // H2 sections are the unit; H3/H4 compose in. Far fewer, far richer than
  // V2's 230 heading-fragments — the thin-page failure cannot recur.
  expect(corpus.techniques.length).toBeGreaterThan(50);
  expect(corpus.techniques.length).toBeLessThan(140);
});

test('command copy payload is byte-exact: no stray carriage returns', () => {
  const withCr = corpus.lineIndex.filter((l) => l.raw.includes('\r'));
  expect(withCr.length).toBe(0);
});

test('finds a known literal line (impacket-GetUserSPNs)', () => {
  const hit = corpus.lineIndex.find((l) => l.raw.includes('impacket-GetUserSPNs'));
  expect(hit).toBeTruthy();
});

test('neutralizes dangerous link schemes, keeps safe ones (link-serializer XSS guard)', () => {
  // Unsafe schemes -> null (caller renders the text with no live href).
  expect(resolveHref('javascript:alert(1)')).toBeNull();
  expect(resolveHref('JavaScript:alert(1)')).toBeNull(); // case-insensitive
  expect(resolveHref('data:text/html,<script>alert(1)</script>')).toBeNull();
  expect(resolveHref('vbscript:msgbox(1)')).toBeNull();
  // Safe schemes / shapes pass through; http(s) is external (new tab).
  expect(resolveHref('https://book.hacktricks.xyz')).toEqual({ href: 'https://book.hacktricks.xyz', external: true });
  expect(resolveHref('/technique/kerberoasting')?.external).toBe(false);
  expect(resolveHref('mailto:a@b.com')?.href).toBe('mailto:a@b.com');
  expect(resolveHref('#section')?.href).toBe('#section');
});

test('no live dangerous-scheme href survives into any serialized block html', () => {
  const bad = /href="\s*(javascript|data|vbscript):/i;
  const offenders = corpus.techniques.flatMap((t) =>
    t.blocks.filter((b: any) => typeof b.html === 'string' && bad.test(b.html))
  );
  expect(offenders.length).toBe(0);
});

test('atomizes commands (Kerberoasting block yields individual commands)', () => {
  const kerb = corpus.techniques.find((t) => t.title.toLowerCase().includes('kerberoasting'));
  expect(kerb).toBeTruthy();
  const cmds = kerb!.blocks.flatMap((b) =>
    b.kind === 'commands' ? b.items.filter((it) => 't' in it) : []);
  expect(cmds.length).toBeGreaterThan(2);
});
