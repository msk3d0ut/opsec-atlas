import { expect, test } from 'vitest';
import { parseAll } from './parse.ts';
import { enrich } from './enrich.ts';
import { buildGraph } from './graph.ts';

const g = buildGraph(parseAll().techniques.map(enrich));
const slugsFor = (s: string) => g.byState[s] ?? [];

test('low-priv-creds reaches kerberoasting + as-rep roasting', () => {
  const s = slugsFor('low-priv-creds').join(' ');
  expect(s).toMatch(/kerberoast/);
  expect(s).toMatch(/rep-roasting|asrep/);
});

test('nt-hash reaches pass-the-hash', () => {
  expect(slugsFor('nt-hash').join(' ')).toMatch(/pass-the-hash/);
});

test('krbtgt-hash reaches golden-ticket', () => {
  expect(slugsFor('krbtgt-hash').join(' ')).toMatch(/golden-ticket/);
});

test('every edge is grounded (has provenance)', () => {
  expect(g.edges.length).toBeGreaterThan(0);
  expect(g.edges.every((e) => e.provenance.length > 0)).toBe(true);
});

test('the decision-tree seeds low-priv-creds with several moves', () => {
  expect(slugsFor('low-priv-creds').length).toBeGreaterThanOrEqual(3);
});
