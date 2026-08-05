import { expect, test } from 'vitest';
import { STATES, matchStates } from './states.ts';

test('vocabulary is closed and non-trivial', () => {
  expect(STATES.length).toBeGreaterThanOrEqual(12);
});

test('recognizes NT hash phrasing', () => {
  expect(matchStates('Requires: NT hash of the target account').map((m) => m.id)).toContain('nt-hash');
});

test('recognizes authenticated domain user as low-priv-creds', () => {
  expect(matchStates('Any authenticated domain user can request service tickets').map((m) => m.id)).toContain('low-priv-creds');
});

test('recognizes krbtgt hash distinctly from nt-hash', () => {
  const ids = matchStates('Requires krbtgt hash from DCSync').map((m) => m.id);
  expect(ids).toContain('krbtgt-hash');
});

test('recognizes replication rights', () => {
  expect(matchStates('DS-Replication-Get-Changes-All rights on the domain').map((m) => m.id)).toContain('replication-rights');
});

test('does not spuriously tag low-priv-creds on an NT-hash-only sentence', () => {
  expect(matchStates('Requires: NT hash of the target account').map((m) => m.id)).not.toContain('low-priv-creds');
});
