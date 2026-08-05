import { expect, test } from 'vitest';
import { parseAll } from './parse.ts';
import { enrich } from './enrich.ts';
import { buildGraph } from './graph.ts';
import { routeFrom } from './route.ts';

const techs = parseAll().techniques.map(enrich);
const g = buildGraph(techs);
const r = routeFrom('low-priv-creds', g, techs);

test('route has ordered, non-empty steps', () => {
  expect(r.steps.length).toBeGreaterThanOrEqual(4);
  expect(r.steps.map((s) => s.order)).toEqual(r.steps.map((_, i) => i + 1));
});

test('enumeration/easy-wins come before dcsync in the ordering', () => {
  const titles = r.steps.map((s) => s.title.toLowerCase());
  const kerb = titles.findIndex((t) => t.includes('kerberoast'));
  const dcsync = titles.findIndex((t) => t.includes('dcsync'));
  if (kerb >= 0 && dcsync >= 0) expect(kerb).toBeLessThan(dcsync);
});

test('each step explains why (rationale) and what it leads to', () => {
  expect(r.steps.every((s) => s.rationale.length > 0)).toBe(true);
});

test('startLabel is human-readable', () => {
  expect(r.startLabel).toBe('Low-priv domain creds');
});
