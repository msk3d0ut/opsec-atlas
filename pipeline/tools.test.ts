import { expect, test } from 'vitest';
import { detectTools } from './tools.ts';

test('detects impacket + hashcat from a kerberoast block', () => {
  const t = detectTools('impacket-GetUserSPNs DOMAIN/user:pass -request\nhashcat -m 13100 hashes rockyou.txt');
  expect(t).toEqual(expect.arrayContaining(['impacket', 'hashcat']));
});

test('detects crackmapexec', () => {
  expect(detectTools('crackmapexec smb 10.0.0.1 -u a -p b')).toContain('crackmapexec');
});

test('detects mimikatz from a lsadump directive', () => {
  expect(detectTools('lsadump::dcsync /domain:corp.local /all')).toContain('mimikatz');
});

test('returns first-seen order', () => {
  const t = detectTools('nmap -sC target\nthen bloodhound-python -c All');
  expect(t.indexOf('nmap')).toBeLessThan(t.indexOf('bloodhound'));
});

test('no false positives on plain prose', () => {
  expect(detectTools('This technique requires domain credentials and patience.')).toEqual([]);
});
