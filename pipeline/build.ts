/**
 * OpsecAtlas V3 — pipeline build orchestration.
 *
 * parse -> enrich -> graph -> routes, then write the generated data the app
 * reads: corpus.json (enriched techniques), graph.json (the edge graph + a
 * precomputed route per state), and search-index.json (literal line index).
 *
 * Prints the low-priv-creds route so route QUALITY can be judged at the data
 * level before any UI exists (the core risk lives here).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseAll } from './parse.ts';
import { enrich } from './enrich.ts';
import { buildGraph } from './graph.ts';
import { routeFrom } from './route.ts';
import { STATES } from './states.ts';
import type { Route, StateId } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../src/generated');
const PUBLIC_DIR = resolve(HERE, '../public');

const base = parseAll();
const techniques = base.techniques.map(enrich);
const corpus = { ...base, techniques };
const graph = buildGraph(techniques);

const routes: Record<StateId, Route> = {};
for (const s of STATES) routes[s.id] = routeFrom(s.id, graph, techniques);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'corpus.json'), JSON.stringify(corpus, null, 2), 'utf8');
writeFileSync(resolve(OUT_DIR, 'graph.json'), JSON.stringify({ builtAt: corpus.builtAt, graph, routes }, null, 2), 'utf8');

const searchIndex = {
  // builtAt is intentionally omitted here: the search index is served as a
  // standalone, service-worker-precached asset, so stamping the build time would
  // change its bytes (and its cache hash) on every build even when no content
  // changed, forcing a needless re-precache each deploy. builtAt still lives in
  // corpus.json / graph.json for provenance.
  techniques: corpus.techniques.map((t) => ({
    id: t.id, slug: t.slug, title: t.title, breadcrumb: t.breadcrumb,
    docId: t.docId, envTags: t.envTags, depth: t.depth,
    prerequisites: t.prerequisites, outputs: t.outputs, tools: t.tools, phase: t.phase,
  })),
  lines: corpus.lineIndex,
  // the state vocabulary, so the omnibox can offer "I have: X -> route"
  states: STATES.map((s) => ({
    id: s.id, label: s.label, synonyms: s.synonyms,
    hasRoute: (routes[s.id]?.steps.length ?? 0) > 0,
  })),
};
mkdirSync(PUBLIC_DIR, { recursive: true });
writeFileSync(resolve(PUBLIC_DIR, 'search-index.json'), JSON.stringify(searchIndex), 'utf8');

// ---- report ----
const line = '─'.repeat(56);
console.log('\n  OpsecAtlas V3 — pipeline\n  ' + line);
console.log(`  ${corpus.stats.docs} docs → ${corpus.stats.techniques} techniques → ${corpus.stats.commands} copyable commands`);
console.log(`  ${corpus.stats.indexedLines} indexed lines · ${graph.edges.length} grounded edges`);

const enriched = techniques.filter((t) => (t.prerequisites?.length || t.outputs?.length));
console.log(`  ${enriched.length} techniques carry a state transition`);

const r = routes['low-priv-creds']!;
console.log('\n  ROUTE · you have: ' + r.startLabel + '\n  ' + line);
for (const step of r.steps) {
  console.log(`  ${step.order}. [${step.phase}] ${step.title}`);
  if (step.leadsTo.length) console.log(`       leads to → ${step.leadsTo.join(', ')}`);
  console.log(`       ${step.rationale.slice(0, 90)}`);
}
console.log('');
