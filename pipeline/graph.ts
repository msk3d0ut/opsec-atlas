/**
 * OpsecAtlas V3 — the edge graph (state -> technique -> new state).
 *
 * Two grounded sources, no hand-invented folklore:
 *   1. ENRICHMENT edges: for each enriched technique, one edge per prerequisite
 *      state -> the technique -> its output states.
 *   2. DECISION-TREE seeds: the files already contain hand-authored decision
 *      trees ("I have low-priv creds -> what first?"). Each flow's steps/options
 *      are mapped back to real techniques, seeding edges from the flow's start
 *      state. This is the operator's own routing, lifted from the source.
 *
 * Trust rule (priority #1): every edge carries provenance; edges without it are
 * dropped. `byState` is the lookup the route engine consumes.
 */
import type { StateId, Technique, Provenance } from './types.ts';
import { matchStates } from './states.ts';

export interface Edge {
  fromState: StateId;
  techniqueSlug: string;
  toStates: StateId[];
  provenance: Provenance[];
  seededBy: 'enrichment' | 'decision-tree';
}

export interface Graph {
  edges: Edge[];
  byState: Record<StateId, string[]>; // stateId -> technique slugs reachable from it
}

const norm = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Enrichment edges: prerequisite -> technique -> outputs. */
function enrichmentEdges(techs: Technique[]): Edge[] {
  const edges: Edge[] = [];
  for (const t of techs) {
    const prereqs = t.prerequisites ?? [];
    if (!prereqs.length) continue;
    const prov: Provenance[] = t.provenance?.length
      ? t.provenance
      : [{ docId: t.docId, line: t.startLine, quote: t.title }];
    for (const from of prereqs) {
      edges.push({ fromState: from, techniqueSlug: t.slug, toStates: t.outputs ?? [], provenance: prov, seededBy: 'enrichment' });
    }
  }
  return edges;
}

/** Decision-tree seeds: map a flow's steps/options back to techniques in the same doc. */
function decisionTreeEdges(techs: Technique[]): Edge[] {
  const edges: Edge[] = [];
  for (const t of techs) {
    for (const b of t.blocks) {
      if (b.kind !== 'flow') continue;
      const start = matchStates(b.intro)[0]?.id;
      if (!start) continue;
      const texts: string[] = [];
      for (const step of b.steps) { texts.push(step.title); for (const o of step.options) texts.push(o); }
      const sameDoc = techs.filter((x) => x.docId === t.docId && x.slug !== t.slug);
      for (const text of texts) {
        const low = norm(text);
        for (const cand of sameDoc) {
          // Match on the STRIPPED slug, not the raw title: a title like
          // "2. BloodHound" carries an enumerator that blocks the match.
          const key = cand.slug.replace(/-\d+$/, '').replace(/-/g, ' ');
          const firstWords = key.split(' ').slice(0, 2).join(' ');
          if (key.length > 3 && (low.includes(key) || (firstWords.length > 3 && low.includes(firstWords)))) {
            edges.push({
              fromState: start,
              techniqueSlug: cand.slug,
              toStates: cand.outputs ?? [],
              provenance: [{ docId: t.docId, line: t.startLine, quote: text.slice(0, 140) }],
              seededBy: 'decision-tree',
            });
          }
        }
      }
    }
  }
  return edges;
}

export function buildGraph(techs: Technique[]): Graph {
  const edges = [...enrichmentEdges(techs), ...decisionTreeEdges(techs)]
    .filter((e) => e.provenance.length > 0); // trust rule

  const byState: Record<StateId, string[]> = {};
  for (const e of edges) {
    const arr = (byState[e.fromState] ??= []);
    if (!arr.includes(e.techniqueSlug)) arr.push(e.techniqueSlug);
  }
  return { edges, byState };
}
