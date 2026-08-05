/**
 * OpsecAtlas V3 — the curated, closed state vocabulary.
 *
 * A STATE is what an operator holds ("low-priv creds", "an NT hash"). The
 * product routes between states, so this vocabulary IS the domain's spine. It
 * is closed and hand-curated on purpose: routing is RECOGNITION against a known
 * set, never fuzzy NLP guessing. Every synonym is drawn from how the source
 * content actually phrases the precondition/result of a technique.
 *
 * `matchStates(text)` scans free text (a technique's prose/notes) and returns
 * the states it mentions, longest-synonym-first so specific states
 * (krbtgt-hash) are not swallowed by general ones (nt-hash).
 */
import type { StateId, PhaseId } from './types.ts';

export interface State {
  id: StateId;
  label: string;
  phaseHint?: PhaseId;
  synonyms: string[]; // lowercase; matched as substrings
}

export const STATES: State[] = [
  { id: 'external-only', label: 'External access only', phaseHint: 'recon',
    synonyms: ['external only', 'unauthenticated', 'without credentials', 'no creds', 'anonymous access', 'pure unauthenticated'] },
  { id: 'valid-usernames', label: 'Valid usernames', phaseHint: 'enum',
    synonyms: ['valid usernames', 'valid user enumeration', 'user list', 'enumerated users', 'username enumeration', 'users.txt'] },
  { id: 'low-priv-creds', label: 'Low-priv domain creds', phaseHint: 'enum',
    synonyms: ['authenticated domain user', 'low-priv domain user', 'low-priv user creds', 'domain user creds', 'valid credentials', 'with credentials', 'valid creds', 'low-priv', 'low priv', 'standard domain user'] },
  { id: 'foothold-linux', label: 'Foothold (Linux)', phaseHint: 'exploitation',
    synonyms: ['shell on linux', 'linux shell', 'foothold on linux', 'www-data', 'low-priv shell on the linux'] },
  { id: 'foothold-windows', label: 'Foothold (Windows)', phaseHint: 'exploitation',
    synonyms: ['shell on windows', 'windows shell', 'foothold on windows', 'meterpreter session'] },
  { id: 'local-admin', label: 'Local admin', phaseHint: 'privesc',
    synonyms: ['local admin', 'local administrator', 'administrators group', 'local admin rights'] },
  { id: 'root', label: 'root (Linux)', phaseHint: 'privesc',
    synonyms: ['are root', 'become root', 'root shell', 'uid=0', '/ as root'] },
  { id: 'system', label: 'SYSTEM (Windows)', phaseHint: 'privesc',
    synonyms: ['nt authority\\system', 'nt authority/system', 'system privileges', 'as system'] },
  { id: 'nt-hash', label: 'NT hash', phaseHint: 'lateral',
    synonyms: ['nt hash', 'ntlm hash', 'ntlm-authenticated', 'nthash', 'nt-hash', 'ntlm authenticated services'] },
  { id: 'krbtgt-hash', label: 'krbtgt hash', phaseHint: 'post-exploit',
    synonyms: ['krbtgt hash', 'krbtgt-hash', 'krbtgt'] },
  { id: 'kerberos-ticket', label: 'Kerberos ticket', phaseHint: 'lateral',
    synonyms: ['kerberos ticket', 'service ticket', 'valid kerberos ticket', 'tgt or tgs', '.ccache', '.kirbi', 'ticket (tgt', 'tgs)'] },
  { id: 'crackable-hash', label: 'Crackable hash', phaseHint: 'lateral',
    synonyms: ['crack offline', 'crackable offline', 'crack it offline', 'hash is crackable', 'crackable', 'encrypted with the service account', 'request encrypted tgts'] },
  { id: 'service-account-creds', label: 'Service account creds', phaseHint: 'lateral',
    synonyms: ['service account password', 'service account creds', 'service account credentials'] },
  { id: 'replication-rights', label: 'Replication rights', phaseHint: 'post-exploit',
    synonyms: ['replication rights', 'ds-replication-get-changes', 'dcsync rights', 'replicating directory changes', 'replication right'] },
  { id: 'domain-admin', label: 'Domain Admin', phaseHint: 'post-exploit',
    synonyms: ['domain admin', 'domain admins', 'enterprise admin', 'da privileges', 'domain compromise'] },
  { id: 'web-injection-point', label: 'Web injection point', phaseHint: 'exploitation',
    synonyms: ['injection point', 'injection confirmed', 'sql injection', 'injectable', 'vulnerable parameter', 'user-controlled parameter'] },
  { id: 'lfi', label: 'Local File Inclusion', phaseHint: 'exploitation',
    synonyms: ['local file inclusion', 'lfi', 'file inclusion'] },
  { id: 'ssrf', label: 'SSRF', phaseHint: 'exploitation',
    synonyms: ['ssrf', 'server-side request forgery'] },
];

/** All (stateId, synonym) pairs sorted longest-synonym-first for specificity. */
const MATCHERS: { id: StateId; syn: string }[] = STATES
  .flatMap((s) => s.synonyms.map((syn) => ({ id: s.id, syn })))
  .sort((a, b) => b.syn.length - a.syn.length);

/** Scan free text; return the unique states it mentions with a matched quote. */
export function matchStates(text: string): { id: StateId; quote: string }[] {
  const hay = text.toLowerCase();
  const seen = new Set<StateId>();
  const out: { id: StateId; quote: string }[] = [];
  for (const { id, syn } of MATCHERS) {
    if (seen.has(id)) continue;
    if (hay.includes(syn)) { seen.add(id); out.push({ id, quote: syn }); }
  }
  return out;
}

export const STATE_BY_ID: Record<StateId, State> =
  Object.fromEntries(STATES.map((s) => [s.id, s]));
