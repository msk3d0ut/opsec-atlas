/**
 * The Variable Console store. Set engagement variables once (your IP, target,
 * domain, creds); every command across the site fills in your real values, and
 * copy grabs the filled command. Client-side only (localStorage), no accounts.
 *
 * Fidelity: the corpus stays byte-exact. Substitution is an opt-in DISPLAY/COPY
 * convenience over a CURATED placeholder map, so XSS tags like <script> and
 * arbitrary <...> are never touched. With no variables set, commands render and
 * copy exactly as authored.
 */
export interface VarField { key: string; label: string; hint: string; desc: string; placeholders: string[] }

/** Curated placeholders only (never bare `<...>`), longest tokens first. */
export const VAR_FIELDS: VarField[] = [
  { key: 'LHOST', label: 'Your IP (LHOST)', hint: '10.10.14.5', desc: 'Your attacker / listener IP. Fills reverse shells, file transfers, and MSFvenom LHOST.', placeholders: ['<YOUR-IP>', '<ATTACKER-IP>', '<LHOST>', '<KALI-IP>'] },
  { key: 'LPORT', label: 'Listener port', hint: '4444', desc: 'The port your listener / handler waits on for reverse shells.', placeholders: ['<LPORT>', '<YOUR-PORT>'] },
  { key: 'RHOST', label: 'Target IP', hint: '10.10.10.10', desc: "The target machine's IP address (the box you are attacking).", placeholders: ['<TARGET-IP>', '<VICTIM-IP>', '<RHOST>', '<TARGET>'] },
  { key: 'RANGE', label: 'Subnet / range', hint: '10.10.10.0/24', desc: 'Target subnet in CIDR notation. Fills network sweeps and password spraying.', placeholders: ['<RANGE>'] },
  { key: 'DCIP', label: 'DC IP', hint: '10.10.10.2', desc: 'Domain Controller IP. Fills AD enumeration and Kerberos commands.', placeholders: ['<DC-IP>'] },
  { key: 'DOMAIN', label: 'Domain', hint: 'corp.local', desc: 'The Active Directory domain name, e.g. corp.local.', placeholders: ['<DOMAIN-NAME>', '<DOMAIN>'] },
  { key: 'USER', label: 'Username', hint: 'j.doe', desc: 'A username you control or are testing.', placeholders: ['<USERNAME>', '<YOUR-USER>', '<USER>'] },
  { key: 'PASS', label: 'Password', hint: 'Winter2024!', desc: 'Password for the username above.', placeholders: ['<PASSWORD>', '<YOUR-PASS>', '<PASS>'] },
  { key: 'HASH', label: 'NT hash', hint: 'aad3b435...:31d6c...', desc: 'NTLM hash for pass-the-hash, as LM:NT or :NT.', placeholders: ['<NTLM-HASH>', '<NT-HASH>', '<HASH>'] },
];

const VKEY = 'opsecatlas.vars';
const FKEY = 'opsecatlas.varsOn';

function ls(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function getVars(): Record<string, string> {
  try { return JSON.parse(ls()?.getItem(VKEY) || '{}'); } catch { return {}; }
}
export function setVars(v: Record<string, string>): void {
  ls()?.setItem(VKEY, JSON.stringify(v));
  emit();
}
export function getEnabled(): boolean {
  return ls()?.getItem(FKEY) !== '0'; // default on
}
export function setEnabled(on: boolean): void {
  ls()?.setItem(FKEY, on ? '1' : '0');
  emit();
}
export function setCount(): number {
  const v = getVars();
  return VAR_FIELDS.filter((f) => v[f.key]).length;
}

function emit(): void { window.dispatchEvent(new CustomEvent('oa-vars')); }
export function onVarsChange(fn: () => void): () => void {
  window.addEventListener('oa-vars', fn);
  return () => window.removeEventListener('oa-vars', fn);
}

/** The active (placeholder -> value) list, or [] when disabled / unset. */
export function activeSubs(): { ph: string; value: string }[] {
  if (!getEnabled()) return [];
  const vars = getVars();
  const subs: { ph: string; value: string }[] = [];
  for (const f of VAR_FIELDS) {
    const val = vars[f.key];
    if (val && val.trim()) for (const ph of f.placeholders) subs.push({ ph, value: val });
  }
  return subs;
}

export interface Token { text: string; isVar: boolean }

/** Split a command into text/variable tokens, longest placeholder first. */
export function tokenize(raw: string, subs: { ph: string; value: string }[]): Token[] {
  if (!subs.length) return [{ text: raw, isVar: false }];
  const sorted = [...subs].sort((a, b) => b.ph.length - a.ph.length);
  const map = new Map(sorted.map((s) => [s.ph, s.value]));
  const re = new RegExp('(' + sorted.map((s) => s.ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  const parts: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) parts.push({ text: raw.slice(last, m.index), isVar: false });
    parts.push({ text: map.get(m[0]) ?? m[0], isVar: true });
    last = m.index + m[0].length;
  }
  if (last < raw.length || parts.length === 0) parts.push({ text: raw.slice(last), isVar: false });
  return parts;
}

/** The filled string (for copy). */
export function fillText(raw: string, subs: { ph: string; value: string }[]): string {
  return tokenize(raw, subs).map((p) => p.text).join('');
}

/** HTML-escape a substituted value before it enters a serialized HTML string. */
const escHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Fill placeholders inside an ALREADY-serialized HTML fragment (prose, list,
 * table, callout, briefing). There the placeholders are HTML-escaped
 * (`&lt;DC-IP&gt;`), so we match the escaped form: real tags use bare `<`/`>` and
 * are never touched. Each hit becomes the amber var chip, matching command fill;
 * the value is HTML-escaped. Returns the input unchanged when no vars are set,
 * so default display stays byte-exact. Same curated map as commands, so `<script>`
 * and arbitrary `<...>` are never substituted.
 */
export function fillHtml(html: string, subs: { ph: string; value: string }[]): string {
  if (!subs.length) return html;
  const sorted = [...subs].sort((a, b) => b.ph.length - a.ph.length);
  const fillSeg = (seg: string): string => {
    for (const { ph, value } of sorted) {
      const escPh = ph.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (seg.includes(escPh)) seg = seg.split(escPh).join(`<span class="cmd-var">${escHtml(value)}</span>`);
    }
    return seg;
  };
  // Fill only TEXT between tags; pass tags through untouched, so a substituted
  // value can never land inside an href / attribute and break the markup.
  return html.replace(/<[^>]*>|[^<]+/g, (m) => (m[0] === '<' ? m : fillSeg(m)));
}
