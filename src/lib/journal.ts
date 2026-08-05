/**
 * The Engagement Journal store. Capture what you find as you work · findings,
 * credentials, hosts, and notes · then export the whole thing as a clean
 * Markdown report skeleton. The last link in the operator loop: set your
 * variables, start where you are, pin your loadout, and record as you go, so
 * the report writes itself.
 *
 * Client-side only (localStorage), no accounts, cross-island via the
 * `oa-journal` CustomEvent · the same pattern as the Variable Console and
 * Loadout. Nothing leaves the browser until you export it yourself.
 */
export type EntryType = 'finding' | 'cred' | 'host' | 'note';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface JournalEntry {
  id: string;
  type: EntryType;
  text: string;
  sev?: Severity; // findings only
  ts: number;
}

export const ENTRY_TYPES: { type: EntryType; label: string; hint: string }[] = [
  { type: 'finding', label: 'Finding', hint: 'SQL injection in /login · dumps the users table' },
  { type: 'cred', label: 'Cred', hint: 'corp.local\\j.doe : Winter2024!  ·  from LSASS on WS01' },
  { type: 'host', label: 'Host', hint: '10.10.10.10 · DC01 · Windows Server 2019 · Domain Admin' },
  { type: 'note', label: 'Note', hint: 'coerced DC01 auth to relay host · screenshot 14:22' },
];

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const SEV_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const JKEY = 'opsecatlas.journal';

function ls(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function getJournal(): JournalEntry[] {
  try { const v = JSON.parse(ls()?.getItem(JKEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

function save(entries: JournalEntry[]): void { ls()?.setItem(JKEY, JSON.stringify(entries)); emit(); }

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function addEntry(e: { type: EntryType; text: string; sev?: Severity }): void {
  const text = e.text.trim();
  if (!text) return;
  const entries = getJournal();
  entries.push({ id: uid(), type: e.type, text, sev: e.type === 'finding' ? (e.sev ?? 'medium') : undefined, ts: Date.now() });
  save(entries);
}

export function removeEntry(id: string): void { save(getJournal().filter((e) => e.id !== id)); }
export function clearJournal(): void { save([]); }
export function journalCount(): number { return getJournal().length; }

function emit(): void { window.dispatchEvent(new CustomEvent('oa-journal')); }
export function onJournalChange(fn: () => void): () => void {
  window.addEventListener('oa-journal', fn);
  return () => window.removeEventListener('oa-journal', fn);
}

const TYPE_HEADS: Record<EntryType, string> = {
  finding: 'Findings', cred: 'Credentials', host: 'Hosts', note: 'Notes',
};

/** Render the journal as a Markdown report skeleton, grouped by kind, findings
 *  by severity. Only non-empty sections appear. This is what you paste into the
 *  report and flesh out · the structure is already done. */
export function toMarkdown(entries: JournalEntry[], dateLabel: string): string {
  const out: string[] = ['# Engagement Journal', '', `_OpsecAtlas · exported ${dateLabel}_`, ''];
  const order: EntryType[] = ['finding', 'cred', 'host', 'note'];
  for (const type of order) {
    let group = entries.filter((e) => e.type === type);
    if (!group.length) continue;
    if (type === 'finding') group = [...group].sort((a, b) => SEV_RANK[a.sev ?? 'info'] - SEV_RANK[b.sev ?? 'info']);
    out.push(`## ${TYPE_HEADS[type]}`, '');
    for (const e of group) {
      const prefix = type === 'finding' ? `**[${(e.sev ?? 'info').toUpperCase()}]** ` : '';
      out.push(`- ${prefix}${e.text}`);
    }
    out.push('');
  }
  return out.join('\n');
}
