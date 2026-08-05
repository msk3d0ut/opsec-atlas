/**
 * OpsecAtlas V3 — route generation (the next-move engine's output).
 *
 * Given a state the operator holds, produce an ORDERED list of high-yield next
 * moves. Ordering follows the kill-chain (enumerate before escalate before
 * persist), so a route reads the way an operator actually works. Each step
 * explains why (rationale, drawn from the technique's own words) and what it
 * leads to (the technique's output states).
 */
import type { PhaseId, StateId, Technique, Route, RouteStep } from './types.ts';
import type { Graph } from './graph.ts';
import { STATE_BY_ID } from './states.ts';

const PHASE_RANK: Record<PhaseId, number> = {
  recon: 1, scanning: 2, enum: 3, exploitation: 4,
  privesc: 5, lateral: 6, 'post-exploit': 7, reporting: 8,
};

const MAX_STEPS = 8;

/** First readable sentence of a technique ("what it is"), for the rationale. */
function descriptor(t: Technique): string {
  for (const b of t.blocks) {
    if (b.kind === 'prose') {
      const text = b.html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
      const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
      if (first) return first.slice(0, 160);
    }
  }
  return '';
}

const labelOf = (id: StateId): string => STATE_BY_ID[id]?.label ?? id;

export function routeFrom(stateId: StateId, graph: Graph, techs: Technique[]): Route {
  const bySlug = new Map(techs.map((t) => [t.slug, t]));
  const slugs = graph.byState[stateId] ?? [];
  const startLabel = labelOf(stateId);

  const resolved = slugs
    .map((s) => bySlug.get(s))
    .filter((t): t is Technique => !!t);

  // Order by kill-chain phase, then alphabetically by title for stability.
  resolved.sort((a, b) => {
    const pr = PHASE_RANK[a.phase ?? 'exploitation'] - PHASE_RANK[b.phase ?? 'exploitation'];
    return pr !== 0 ? pr : a.title.localeCompare(b.title);
  });

  const steps: RouteStep[] = resolved.slice(0, MAX_STEPS).map((t, i) => {
    const leadsTo = t.outputs ?? [];
    const desc = descriptor(t);
    const rationale = desc
      || (leadsTo.length ? `Yields ${leadsTo.map(labelOf).join(', ')}.` : 'Advances your position.');
    return {
      order: i + 1,
      techniqueSlug: t.slug,
      title: t.title,
      phase: t.phase,
      rationale,
      leadsTo,
    };
  });

  return { startState: stateId, startLabel, steps };
}
