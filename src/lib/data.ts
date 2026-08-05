/**
 * OpsecAtlas V3 — app-side accessors over the generated pipeline data.
 * Imports the JSON (build-time) + pure types only. Never imports the pipeline
 * runtime (parse/build use node:fs and must not reach the client).
 */
import corpusJson from '../generated/corpus.json';
import graphJson from '../generated/graph.json';
import type { Corpus, Technique, Route, StateId, PhaseId } from '../../pipeline/types.ts';
import { METHODOLOGIES } from '../data/methodologies.ts';
import { OWASP, OWASP_TECHNIQUES } from '../data/owasp.ts';

export const corpus = corpusJson as unknown as Corpus;
export const graphData = graphJson as unknown as {
  builtAt: string;
  graph: { edges: unknown[]; byState: Record<StateId, string[]> };
  routes: Record<StateId, Route>;
};

export const techBySlug: Map<string, Technique> =
  new Map(corpus.techniques.map((t) => [t.slug, t]));

/** Strip source enumerators for display ("2. BloodHound" -> "BloodHound") and
 *  drop any stray em dashes (house rule). Titles are de-em-dashed at parse time;
 *  this is belt-and-suspenders for display. */
export function cleanTitle(t: string): string {
  return t
    .replace(/^\[\d+\]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^section\s+[a-z0-9]+\s*[-:·–—]\s*/i, '')
    .replace(/^step\s+\d+:\s*/i, '')
    .replace(/^phase\s+\d+\s*[-:·–—]?\s*/i, '')
    .replace(/\s*—\s*/g, ' · ')
    .trim();
}

/** Count-aware label so nothing ever reads "1 moves". Regular +s plurals only. */
export function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

/** The doors, ordered as an engagement actually runs: from "just landed, external
 *  only" through the footholds and domain creds to Domain Admin. Reads as a
 *  timeline, so "Start where you are" scans the way an operator thinks. Any state
 *  with a route but not listed here falls to the end, richest route first. */
const DOOR_ORDER: StateId[] = [
  'external-only', 'valid-usernames', 'web-injection-point', 'lfi', 'ssrf',
  'foothold-linux', 'foothold-windows', 'low-priv-creds',
  'local-admin', 'root', 'system',
  'crackable-hash', 'service-account-creds', 'nt-hash', 'kerberos-ticket',
  'replication-rights', 'krbtgt-hash', 'domain-admin',
];

/** States that actually have a route with at least one step (for the doors). */
export function activeStates(): { id: StateId; label: string; count: number }[] {
  const rank = (id: StateId) => { const i = DOOR_ORDER.indexOf(id); return i === -1 ? 999 : i; };
  return Object.values(graphData.routes)
    .filter((r) => r.steps.length > 0)
    .map((r) => ({ id: r.startState, label: r.startLabel, count: r.steps.length }))
    .sort((a, b) => rank(a.id) - rank(b.id) || b.count - a.count);
}

/* ---- domains: the operator's environments, mapped from source docs ---- */
const DOMAIN_OF: Record<string, { id: string; label: string }> = {
  '00': { id: 'essentials', label: 'Essentials' },
  '01': { id: 'essentials', label: 'Essentials' },
  '02': { id: 'network', label: 'Network' },
  '03': { id: 'web', label: 'Web' },
  '07': { id: 'web', label: 'Web' },
  '04': { id: 'active-directory', label: 'Active Directory' },
  '05': { id: 'linux', label: 'Linux' },
  '06': { id: 'windows', label: 'Windows' },
};
const DOMAIN_ORDER = ['essentials', 'network', 'web', 'active-directory', 'linux', 'windows'];

export function domainOf(docId: string): { id: string; label: string } {
  return DOMAIN_OF[docId] ?? { id: 'other', label: 'Other' };
}

/** All techniques grouped by domain, in operator order (for the browse view). */
export function techniquesByDomain(): { id: string; label: string; techniques: Technique[] }[] {
  const groups = new Map<string, { id: string; label: string; techniques: Technique[] }>();
  for (const t of corpus.techniques) {
    const d = domainOf(t.docId);
    if (!groups.has(d.id)) groups.set(d.id, { id: d.id, label: d.label, techniques: [] });
    groups.get(d.id)!.techniques.push(t);
  }
  return DOMAIN_ORDER.map((id) => groups.get(id)).filter((g): g is NonNullable<typeof g> => !!g);
}

/** A domain entry may absorb the sections of another doc that shares its domain
 *  but carries no entry page of its own (noEntry). The web entry (doc 03) hosts
 *  the OWASP reference sections (doc 07) so they stay reachable from the map. */
const ENTRY_ABSORBS: Record<string, string[]> = { '03': ['03', '07'] };

/** The depth-2 sections an entry page maps, in source order (drives the
 *  "domain map"). Excludes the entry's own depth-1 intro. Doc-scoped by default;
 *  an entry in ENTRY_ABSORBS also pulls in its absorbed docs' sections. */
export function siblingsInDoc(docId: string, excludeSlug: string): { slug: string; title: string }[] {
  const docs = ENTRY_ABSORBS[docId] ?? [docId];
  return corpus.techniques
    .filter((t) => docs.includes(t.docId) && t.depth >= 2 && t.slug !== excludeSlug)
    .map((t) => ({ slug: t.slug, title: cleanTitle(t.title) }));
}

/** Curated lateral exits for a domain entry page: the sibling doc, the matching
 *  library hubs, and the relevant playbook. Authored (grounded), never fuzzy. */
const ENTRY_RELATED: Record<string, { label: string; to: string }[]> = {
  '00': [{ label: 'Command Library', to: 'library/commands' }, { label: 'Payloads & Shells', to: 'library/payloads' }, { label: 'Methodologies', to: 'library/methodologies' }],
  '01': [{ label: 'Enumeration Strategy', to: 'library/methodologies#enumeration-strategy' }, { label: 'Command Library', to: 'library/commands' }, { label: 'CVE Vault', to: 'library/cves' }],
  '02': [{ label: 'Command Library', to: 'library/commands' }, { label: 'Enumeration Strategy', to: 'library/methodologies#enumeration-strategy' }, { label: 'Lateral Movement', to: 'library/methodologies#lateral-movement' }],
  '03': [{ label: 'OWASP Top 10', to: 'library/owasp' }, { label: 'Payloads & Shells', to: 'library/payloads' }, { label: 'Web Testing', to: 'library/methodologies#web-testing' }],
  '04': [{ label: 'AD Attack Path', to: 'library/methodologies#active-directory' }, { label: 'Command Library', to: 'library/commands' }, { label: 'Windows', to: 'technique/windows-privesc-post-exploitation' }],
  '05': [{ label: 'Privilege Escalation', to: 'library/methodologies#privilege-escalation' }, { label: 'Payloads & Shells', to: 'library/payloads' }, { label: 'Command Library', to: 'library/commands' }],
  '06': [{ label: 'Privilege Escalation', to: 'library/methodologies#privilege-escalation' }, { label: 'Active Directory', to: 'technique/active-directory' }, { label: 'Command Library', to: 'library/commands' }],
  '07': [{ label: 'Web Application PT', to: 'technique/web-application-pt' }, { label: 'Web Testing', to: 'library/methodologies#web-testing' }, { label: 'Payloads & Shells', to: 'library/payloads' }],
};
export function entryRelated(docId: string): { label: string; to: string }[] {
  return ENTRY_RELATED[docId] ?? [];
}

/** Which state-routes reference this technique (for "appears in" on its page). */
export function routesContaining(slug: string): { id: StateId; label: string }[] {
  return Object.values(graphData.routes)
    .filter((r) => r.steps.some((s) => s.techniqueSlug === slug))
    .map((r) => ({ id: r.startState, label: r.startLabel }));
}

/* ---- knowledge-graph cross-links: the whole atlas as one connected system ----
 * All relationships are GROUNDED (never fuzzy): state edges come from the
 * enriched prerequisites/outputs, tool links only from SPECIFIC shared tools,
 * and playbook backlinks from the methodologies' authored cross-links. */

/** tool -> the technique slugs that use it (built once). */
const TOOL_USERS: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const t of corpus.techniques) for (const tool of t.tools ?? []) {
    const arr = m.get(tool) ?? [];
    arr.push(t.slug);
    m.set(tool, arr);
  }
  return m;
})();
/** A tool is a useful link only if it clusters a few techniques, not everything
 *  (nmap/impacket are too broad -> noise) and not a singleton (no one to link). */
function isSpecificTool(tool: string): boolean {
  const n = (TOOL_USERS.get(tool) ?? []).length;
  return n >= 2 && n <= 8;
}

export interface Conn { slug: string; title: string }
/** Techniques that share one specific tool (the tool is the visible reason). */
export interface ToolCluster { tool: string; techniques: Conn[] }
export interface Connections { leadsTo: Conn[]; reachedFrom: Conn[]; tooling: ToolCluster[] }

/** The grounded technique-to-technique connections for one technique. */
export function connectionsFor(slug: string): Connections {
  const t = techBySlug.get(slug);
  if (!t) return { leadsTo: [], reachedFrom: [], tooling: [] };
  const outs = new Set(t.outputs ?? []);
  const pres = new Set(t.prerequisites ?? []);
  const toConn = (x: Technique): Conn => ({ slug: x.slug, title: cleanTitle(x.title) });

  // state graph: what this technique's outputs unlock, and what unlocks it
  const leadsTo = outs.size
    ? corpus.techniques.filter((x) => x.slug !== slug && (x.prerequisites ?? []).some((p) => outs.has(p))).slice(0, 8).map(toConn)
    : [];
  const leadsSlugs = new Set(leadsTo.map((c) => c.slug));
  const reachedFrom = pres.size
    ? corpus.techniques.filter((x) => x.slug !== slug && !leadsSlugs.has(x.slug) && (x.outputs ?? []).some((o) => pres.has(o))).slice(0, 8).map(toConn)
    : [];

  // shared tooling, GROUPED by the specific tool so the reason is visible.
  // Rarer tool first (higher signal); up to 3 tools; no repeats of the state
  // links above or across tool groups.
  const seen = new Set<string>([slug, ...leadsTo.map((c) => c.slug), ...reachedFrom.map((c) => c.slug)]);
  const myTools = (t.tools ?? []).filter(isSpecificTool)
    .sort((a, b) => (TOOL_USERS.get(a)!.length) - (TOOL_USERS.get(b)!.length))
    .slice(0, 3);
  const tooling: ToolCluster[] = [];
  for (const tool of myTools) {
    const techniques: Conn[] = [];
    for (const s of TOOL_USERS.get(tool)!) {
      if (seen.has(s) || techniques.length >= 5) continue;
      seen.add(s);
      techniques.push({ slug: s, title: cleanTitle(techBySlug.get(s)!.title) });
    }
    if (techniques.length) tooling.push({ tool, techniques });
  }
  return { leadsTo, reachedFrom, tooling };
}

/** Methodologies whose steps cross-link to this technique (reverse index). */
export function playbooksReferencing(slug: string): { title: string; to: string }[] {
  const target = `technique/${slug}`;
  const out: { title: string; to: string }[] = [];
  const seen = new Set<string>();
  for (const m of METHODOLOGIES) {
    const hit = m.phases.some((ph) => ph.steps.some((s) => s.link?.to === target));
    if (hit && !seen.has(m.id)) { seen.add(m.id); out.push({ title: m.title, to: `library/methodologies#${m.id}` }); }
  }
  return out;
}

/** An OWASP category -> its hands-on technique pages (curated map, titles resolved). */
export function owaspHandsOn(categoryId: string): { slug: string; title: string }[] {
  return (OWASP_TECHNIQUES[categoryId] ?? [])
    .map((slug) => techBySlug.get(slug))
    .filter((t): t is Technique => !!t)
    .map((t) => ({ slug: t.slug, title: cleanTitle(t.title) }));
}

/* ---- kill-chain position: "where am I in the engagement?" ----
 * The corpus phase (grounded per technique) mapped onto the operator's kill
 * chain, so every technique page can show a "you are here" strip. */
export const KILLCHAIN: { label: string; phases: PhaseId[] }[] = [
  { label: 'Recon', phases: ['recon', 'scanning'] },
  { label: 'Enumerate', phases: ['enum'] },
  { label: 'Foothold', phases: ['exploitation'] },
  { label: 'PrivEsc', phases: ['privesc'] },
  { label: 'Lateral', phases: ['lateral'] },
  { label: 'Post-Ex', phases: ['post-exploit', 'reporting'] },
];

/** Index into KILLCHAIN for a technique's phase, or -1 if unknown. */
export function killchainIndex(phase?: PhaseId): number {
  if (!phase) return -1;
  return KILLCHAIN.findIndex((s) => s.phases.includes(phase));
}

/** Corpus totals for the footer coordinate line (map-margin annotation). */
export function footerStats(): { techniques: number; commands: number } {
  let commands = 0;
  for (const t of corpus.techniques)
    for (const b of t.blocks)
      if (b.kind === 'commands') commands += b.items.filter((it) => 't' in it).length;
  return { techniques: corpus.techniques.length, commands };
}

/** The reverse: which OWASP categories this technique implements. */
export function owaspForTechnique(slug: string): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  for (const [cat, slugs] of Object.entries(OWASP_TECHNIQUES)) {
    if (slugs.includes(slug)) {
      const e = OWASP.find((o) => o.id === cat);
      if (e) out.push({ id: e.id, title: e.title });
    }
  }
  return out;
}
