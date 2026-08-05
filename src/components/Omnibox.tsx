/**
 * Omnibox — the command spine. One input, two lanes, no mode toggle:
 *   - literal lane: type a command / flag / technique -> land on the exact line
 *   - routing lane: type a state ("nt hash", "shell") -> get routed to next moves
 * Keyboard-first (Cmd/Ctrl+K or "/" to open, arrows to move, Enter to go, Esc to
 * close). Loads the prebuilt literal line index lazily on first open; works
 * offline (the index is precached by the service worker).
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PAYLOAD_CATEGORIES } from '../data/payloads.ts';
import { COMMAND_LIBRARY } from '../data/commands.ts';
import { CVES } from '../data/cves.ts';
import { OWASP } from '../data/owasp.ts';
import { METHODOLOGIES } from '../data/methodologies.ts';
import { CLOUD } from '../data/cloud.ts';
import { TOOLS } from '../data/tools.ts';
import { WORDLISTS } from '../data/wordlists.ts';
import { anchorId } from '../lib/anchor.ts';

const BASE = import.meta.env.BASE_URL;

/** The library hubs, flattened for search (payloads, commands, CVEs, OWASP, methodologies). */
const LIBRARY: { label: string; sub: string; text: string; href: string }[] = [
  ...PAYLOAD_CATEGORIES.flatMap((c) =>
    c.payloads.map((p) => ({ label: p.title, sub: `payload · ${c.title}`, text: `${p.title} ${p.code}`.toLowerCase(), href: `${BASE}library/payloads#${anchorId(`${c.id}#${p.code}`)}` }))),
  ...COMMAND_LIBRARY.flatMap((pl) =>
    pl.groups.flatMap((g) => g.commands.map((cmd) => ({ label: cmd.desc, sub: `${pl.title} · ${g.title}`, text: `${cmd.cmd} ${cmd.desc}`.toLowerCase(), href: `${BASE}library/commands#${anchorId(cmd.cmd)}` })))),
  ...CVES.map((cve) => ({ label: cve.name, sub: `CVE · ${cve.id}`, text: `${cve.name} ${cve.id} ${cve.what}`.toLowerCase(), href: `${BASE}library/cves#${cve.id}` })),
  ...OWASP.map((e) => ({ label: e.title, sub: `OWASP · ${e.rank}`, text: `${e.rank} ${e.title} ${e.tag} ${e.what}`.toLowerCase(), href: `${BASE}library/owasp#${e.id}` })),
  ...OWASP.flatMap((e) =>
    e.blocks.flatMap((b) => b.rows.map((r) => ({ label: r.desc, sub: `OWASP · ${e.rank} ${e.title}`, text: `${r.cmd} ${r.desc}`.toLowerCase(), href: `${BASE}library/owasp#${anchorId(r.cmd)}` })))),
  ...METHODOLOGIES.map((m) => ({ label: m.title, sub: 'playbook · methodology', text: `${m.title} ${m.tag} ${m.premise}`.toLowerCase(), href: `${BASE}library/methodologies#${m.id}` })),
  ...METHODOLOGIES.flatMap((m) =>
    m.phases.flatMap((ph) => ph.steps.map((s) => ({ label: s.title, sub: `playbook · ${m.title}`, text: `${s.title} ${s.detail || ''} ${(s.moves || []).join(' ')}`.toLowerCase(), href: `${BASE}library/methodologies#${m.id}` })))),
  ...CLOUD.map((p) => ({ label: p.name, sub: `cloud · ${p.short}`, text: `${p.name} ${p.short} ${p.tag} ${p.intro}`.toLowerCase(), href: `${BASE}library/cloud#${p.id}` })),
  ...CLOUD.flatMap((p) =>
    p.phases.flatMap((ph) => ph.cmds.map((c) => ({ label: c.desc, sub: `cloud · ${p.short} ${ph.title}`, text: `${c.cmd} ${c.desc}`.toLowerCase(), href: `${BASE}library/cloud#${anchorId(c.cmd)}` })))),
  ...TOOLS.flatMap((cat) =>
    cat.tools.map((t) => ({ label: t.name, sub: `tool · ${cat.title}`, text: `${t.name} ${t.what} ${t.when} ${cat.title}`.toLowerCase(), href: `${BASE}library/tools#${cat.id}` }))),
  ...WORDLISTS.flatMap((cat) =>
    cat.lists.map((w) => ({ label: w.name, sub: `wordlist · ${cat.title}`, text: `${w.name} ${w.path} ${w.what} ${w.when}`.toLowerCase(), href: `${BASE}library/wordlists#${cat.id}` }))),
];

interface TechIdx { slug: string; title: string; breadcrumb: string[]; phase?: string }
interface LineIdx { slug: string; line: number; raw: string; techniqueTitle: string; isComment: boolean }
interface StateIdx { id: string; label: string; synonyms: string[]; hasRoute: boolean }
interface Index { techniques: TechIdx[]; lines: LineIdx[]; states: StateIdx[] }

type Result =
  | { kind: 'state'; label: string; sub: string; href: string }
  | { kind: 'technique'; label: string; sub: string; href: string }
  | { kind: 'library'; label: string; sub: string; href: string }
  | { kind: 'command'; label: string; sub: string; href: string };

const clean = (t: string): string =>
  t.replace(/^\[\d+\]\s*/, '').replace(/^\d+\.\s*/, '')
    .replace(/^section\s+[a-z0-9]+\s*[-:·–—]\s*/i, '').replace(/^step\s+\d+:\s*/i, '')
    .replace(/\s*—\s*/g, ' · ').trim();

// The literal index stores lines byte-exact (em dashes and all) so search lands
// on the exact source line; the DISPLAYED result label follows the house
// no-em-dash rule, so the dropdown reads the same as the page it lands on.
const deDash = (s: string): string =>
  s.replace(/\s*—\s*/g, ' · ').replace(/\s*–\s*/g, '-');

function search(index: Index, qRaw: string): Result[] {
  const q = qRaw.trim().toLowerCase();
  if (!q) return [];
  const out: Result[] = [];

  // routing lane: state matches (label or synonym), only states that have a route
  const seenState = new Set<string>();
  for (const s of index.states) {
    if (!s.hasRoute || seenState.has(s.id)) continue;
    if (s.label.toLowerCase().includes(q) || s.synonyms.some((syn) => syn.includes(q) || q.includes(syn))) {
      seenState.add(s.id);
      out.push({ kind: 'state', label: `I have: ${s.label}`, sub: 'route to next moves', href: `${BASE}route/${s.id}` });
    }
  }

  // technique-name matches (title first, then breadcrumb), startsWith ranked higher
  const techHits = index.techniques
    .map((t) => ({ t, name: clean(t.title).toLowerCase() }))
    .filter(({ name, t }) => name.includes(q) || t.breadcrumb.join(' ').toLowerCase().includes(q))
    .sort((a, b) => Number(b.name.startsWith(q)) - Number(a.name.startsWith(q)))
    .slice(0, 6);
  for (const { t } of techHits) {
    out.push({ kind: 'technique', label: clean(t.title), sub: t.breadcrumb[0] ?? 'technique', href: `${BASE}technique/${t.slug}` });
  }

  // library lane: payloads, commands, CVEs (curated grab-and-go)
  for (const l of LIBRARY.filter((x) => x.text.includes(q)).slice(0, 6)) {
    out.push({ kind: 'library', label: l.label, sub: l.sub, href: l.href });
  }

  // literal lane: exact substring on a command/line, non-comments first, lands on line
  const seen = new Set<string>();
  const lineHits = index.lines
    .filter((l) => l.raw.toLowerCase().includes(q))
    .sort((a, b) => Number(a.isComment) - Number(b.isComment))
    .filter((l) => { const k = l.slug + l.line; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 8);
  for (const l of lineHits) {
    out.push({ kind: 'command', label: deDash(l.raw.trim()), sub: clean(l.techniqueTitle), href: `${BASE}technique/${l.slug}#L${l.line}` });
  }
  return out;
}

export default function Omnibox() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [index, setIndex] = useState<Index | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Current results, mirrored into a ref so the keydown handler (bound on [open])
  // can clamp against the live length without a stale closure.
  const resultsRef = useRef<Result[]>([]);

  const load = async () => {
    if (index) return;
    try {
      const res = await fetch(`${BASE}search-index.json`);
      setIndex(await res.json());
    } catch { /* offline + not cached yet */ }
  };

  const openIt = (seed = '') => { setQ(seed); setActive(0); setOpen(true); void load(); };
  const close = () => setOpen(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); open ? close() : openIt(); return; }
      if (!open) {
        const t = e.target as HTMLElement;
        const editable = /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName) || t?.isContentEditable;
        if (editable) return;
        // "/" opens empty; any other bare printable key opens seeded with it
        // (type-to-search) so you never have to reach for Ctrl+K first.
        if (e.key === '/') { e.preventDefault(); openIt(); return; }
        if (!mod && !e.altKey && e.key.length === 1 && /\S/.test(e.key)) { e.preventDefault(); openIt(e.key); return; }
        return;
      }
      if (e.key === 'Escape') { close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.max(0, resultsRef.current.length - 1))); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const results = useMemo(() => (index ? search(index, q) : []), [index, q]);
  resultsRef.current = results;
  const clampedActive = Math.min(active, Math.max(0, results.length - 1));

  const go = (r: Result) => {
    close(); // always dismiss the box on selection (it stayed open on same-URL hits)
    const target = new URL(r.href, location.href);
    const samePath = target.pathname.replace(/\/+$/, '') === location.pathname.replace(/\/+$/, '');
    if (samePath && target.hash) {
      if (target.hash === location.hash) {
        // already on the exact target: re-fire the reveal so it re-scrolls + highlights
        window.dispatchEvent(new Event('hashchange'));
      } else {
        location.hash = target.hash; // same page, new section: hashchange drives the reveal
      }
    } else {
      window.location.href = r.href; // a different page
    }
  };

  return (
    <>
      <button class="omni-trigger" onClick={() => openIt()} aria-label="Search">
        <span class="omni-ico" aria-hidden="true">⌕</span>
        <span class="omni-hint">search</span>
        <kbd class="omni-kbd">Ctrl K</kbd>
      </button>

      {open && (
        <div class="omni-overlay" onClick={close}>
          <div class="omni" onClick={(e) => e.stopPropagation()}>
            <div class="omni-inputrow">
              <span class="omni-ico" aria-hidden="true">⌕</span>
              <input
                ref={inputRef}
                class="omni-input"
                type="search"
                aria-label="Search: a command, a technique, or what you have"
                value={q}
                placeholder="Find a command, technique, or what you have..."
                onInput={(e) => { setQ((e.target as HTMLInputElement).value); setActive(0); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && results[clampedActive]) { e.preventDefault(); go(results[clampedActive]!); } }}
              />
              <kbd class="omni-kbd">esc</kbd>
              <button class="hud-close" onClick={close} aria-label="Close search" title="Close (Esc)">×</button>
            </div>
            <div class="omni-results">
              {q && results.length === 0 && <div class="omni-empty">No matches{index ? '' : ' (loading index...)'}</div>}
              {results.map((r, i) => (
                <a
                  key={`${r.href}::${i}`}
                  class={`omni-item ${i === clampedActive ? 'is-active' : ''} omni-${r.kind}`}
                  href={r.href}
                  onMouseEnter={() => setActive(i)}
                  onClick={(e) => { e.preventDefault(); go(r); }}
                >
                  <span class="omni-tag">{r.kind === 'command' ? 'cmd' : r.kind === 'state' ? 'route' : r.kind === 'library' ? 'lib' : 'tech'}</span>
                  <span class="omni-label">{r.label}</span>
                  <span class="omni-sub">{r.sub}</span>
                </a>
              ))}
              {!q && (
                <div class="omni-tip">
                  Type a command or flag to land on the exact line · or what you hold (<em>nt hash</em>, <em>shell</em>) to get routed.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
