/**
 * RouteView — the next-move engine's output as one surface at two zooms.
 * The ordered route is the "zoom out"; clicking a step expands its
 * TechniqueCard in place (the "zoom in"), so the operator never leaves the map.
 * Numbered markers use the chart/reticle language; a hairline connects them.
 */
import { useState } from 'preact/hooks';
import type { Route, Technique, StateId } from '../../pipeline/types.ts';
import { STATE_BY_ID } from '../../pipeline/states.ts';
import TechniqueCard from './TechniqueCard.tsx';

// Local (island stays self-contained; importing lib/data would bundle the corpus).
const clean = (t: string): string =>
  t.replace(/^\[\d+\]\s*/, '').replace(/^\d+\.\s*/, '')
    .replace(/^section\s+[a-z0-9]+\s*[-:·–—]\s*/i, '')
    .replace(/^step\s+\d+:\s*/i, '').replace(/\s*—\s*/g, ' · ').trim();

const phaseLabel: Record<string, string> = {
  recon: 'recon', scanning: 'scan', enum: 'enumerate', exploitation: 'exploit',
  privesc: 'escalate', lateral: 'move', 'post-exploit': 'own', reporting: 'report',
};

export default function RouteView(
  { route, techniques }: { route: Route; techniques: Record<string, Technique> }
) {
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <ol class="route rail-col">
      {route.steps.map((step, i) => {
        const isOpen = open.has(i);
        const tech = techniques[step.techniqueSlug];
        return (
          <li class={`route-step ${isOpen ? 'is-open' : ''}`}>
            <button class="step-head" aria-expanded={isOpen} onClick={() => toggle(i)}>
              <span class="marker" aria-hidden="true">
                <span class="marker-n">{String(step.order).padStart(2, '0')}</span>
              </span>
              <span class="step-main">
                <span class="step-top">
                  <span class="label">{phaseLabel[step.phase ?? ''] ?? step.phase}</span>
                  {step.leadsTo.length > 0 && (
                    <span class="leadsto">
                      leads to
                      {step.leadsTo.map((s: StateId) => <span key={s} class="chip chip-gain sm">{STATE_BY_ID[s]?.label ?? s}</span>)}
                    </span>
                  )}
                </span>
                <span class="step-title">{clean(step.title)}</span>
                <span class="step-why">{step.rationale}</span>
              </span>
              <span class={`chev ${isOpen ? 'up' : ''}`} aria-hidden="true">›</span>
            </button>
            {isOpen && tech && (
              <div class="step-body">
                <TechniqueCard tech={tech} />
                <a class="permalink" href={`${import.meta.env.BASE_URL}technique/${tech.slug}`}>
                  open full technique <span aria-hidden="true">&#8599;</span>
                </a>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
