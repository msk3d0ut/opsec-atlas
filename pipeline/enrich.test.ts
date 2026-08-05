import { expect, test } from 'vitest';
import { parseAll } from './parse.ts';
import { enrich } from './enrich.ts';

const techs = parseAll().techniques.map(enrich);
const byTitle = (s: string) => techs.find((t) => t.title.toLowerCase().includes(s))!;

test('Kerberoasting: prereq low-priv-creds -> output crackable-hash, tools impacket+hashcat', () => {
  const k = byTitle('kerberoasting');
  expect(k).toBeTruthy();
  expect(k.prerequisites).toContain('low-priv-creds');
  expect(k.outputs).toContain('crackable-hash');
  expect(k.tools).toEqual(expect.arrayContaining(['impacket', 'hashcat']));
});

test('DCSync: outputs nt-hash + krbtgt-hash', () => {
  const d = byTitle('dcsync');
  expect(d.outputs).toEqual(expect.arrayContaining(['nt-hash', 'krbtgt-hash']));
});

test('Golden Ticket: prereq krbtgt-hash -> output domain-admin', () => {
  const g = byTitle('golden ticket');
  expect(g.prerequisites).toContain('krbtgt-hash');
  expect(g.outputs).toContain('domain-admin');
});

test('Pass-the-Hash: prereq nt-hash', () => {
  expect(byTitle('pass-the-hash').prerequisites).toContain('nt-hash');
});

test('every extracted state carries provenance with a real line + quote', () => {
  const k = byTitle('kerberoasting');
  expect(k.provenance!.length).toBeGreaterThan(0);
  expect(k.provenance!.every((p) => p.line > 0 && p.quote.length > 0)).toBe(true);
});
