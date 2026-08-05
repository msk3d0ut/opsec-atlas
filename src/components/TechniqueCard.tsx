/**
 * TechniqueCard — one technique unfolded as designed UI, never raw markdown.
 *
 * Elevations (Z's directive · nothing should read like copied Word/markdown):
 *  - blocks group under their subheads into collapsible sections (long pages
 *    stay calm; expand only what you need)
 *  - command "notes" become step labels, reference links, or soft captions,
 *    not flat `# ` lines
 *  - figures get one-click copy; step-list figures render as numbered steps;
 *    "KEY: <value>" figures render as a designed, copyable template
 *  - a bold-only paragraph becomes a lead, not raw bold-white text
 *  - every command stays byte-exact and individually copyable
 *
 * Variable fill is UNIVERSAL: engagement variables (set in the Variable Console)
 * fill EVERY surface a curated placeholder can appear on — commands, note
 * captions, figures/payloads, and inline code inside prose / lists / tables —
 * not just command lines. Subscribed once here and threaded down as `subs`;
 * with none set, everything renders byte-exact as authored.
 */
import { useEffect, useState } from 'preact/hooks';
import type { Technique, ContentBlock } from '../../pipeline/types.ts';
import { STATE_BY_ID } from '../../pipeline/states.ts';
import { activeSubs, onVarsChange, tokenize, fillText, fillHtml } from '../lib/vars.ts';
import PinButton from './PinButton.tsx';

type Subs = { ph: string; value: string }[];

const stateLabel = (id: string): string => STATE_BY_ID[id]?.label ?? id;

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Turn bare URLs in note text into links labeled by hostname (never the naked
 *  URL): a designed reference, not a raw markdown link. Our own trusted content. */
const linkify = (text: string): string =>
  escapeHtml(text).replace(/(https?:\/\/[^\s<>"']+)/g, (url) => {
    if (url.includes('&lt;')) return url; // a placeholder-bearing target/payload, not a navigable reference
    const host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${host}</a>`;
  });

const STEP_LABEL = /^(step|phase|method|option|part|stage|tier)\s*[\dA-Za-z]+\s*[:.)\-]/i;

/** Render a raw string with the operator's variables filled in as amber var
 *  chips (byte-exact text when nothing is set). The shared display primitive. */
function Filled({ raw, subs }: { raw: string; subs: Subs }) {
  return <>{tokenize(raw, subs).map((p) => (p.isVar ? <span class="cmd-var">{p.text}</span> : p.text))}</>;
}

/* ---- small pieces ---- */

function CopyButton({ text, klass = 'cmd-copy' }: { text: string; klass?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text); // byte-exact payload (filled if vars set)
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button class={klass} onClick={copy} aria-label={copied ? 'Copied' : 'Copy'} aria-live="polite">{copied ? 'copied' : 'copy'}</button>
  );
}

function CommandRow({ raw, line, subs }: { raw: string; line: number; subs: Subs }) {
  // Display fills the operator's engagement variables; copy grabs the filled form.
  return (
    <div class="cmd" id={`L${line}`}>
      <pre class="cmd-raw"><Filled raw={raw} subs={subs} /></pre>
      <PinButton cmd={raw} />
      <CopyButton text={fillText(raw, subs)} />
    </div>
  );
}

function NoteRow({ text, subs }: { text: string; subs: Subs }) {
  // An embedded web shell / code payload inside a note -> make it copyable.
  const payload = text.match(/^(.*?)(<\?(?:php|=)[\s\S]*?\?>)(.*)$/);
  if (payload) {
    return (
      <div>
        {payload[1]!.trim() && <p class="cmd-note"><Filled raw={payload[1]!.trim()} subs={subs} /></p>}
        <div class="cmd"><pre class="cmd-raw"><Filled raw={payload[2]!} subs={subs} /></pre><CopyButton text={fillText(payload[2]!, subs)} /></div>
        {payload[3]!.trim() && <p class="cmd-note"><Filled raw={payload[3]!.trim()} subs={subs} /></p>}
      </div>
    );
  }
  if (STEP_LABEL.test(text)) return <div class="cmd-step"><span><Filled raw={text} subs={subs} /></span></div>;
  // A note that carries a URL renders as a reference; escaped placeholders inside
  // it (http://&lt;TARGET-IP&gt;/...) still fill via fillHtml.
  if (/https?:\/\//.test(text)) return <p class="note-ref" dangerouslySetInnerHTML={{ __html: fillHtml(linkify(text), subs) }} />;
  return <p class="cmd-note"><Filled raw={text} subs={subs} /></p>;
}

/* ---- figure classification: step-list / template / code ---- */

function parseSteps(raw: string): { n: string; text: string }[] | null {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;
  const steps: { n: string; text: string }[] = [];
  for (const l of lines) {
    const m = l.match(/^(?:step\s*)?(\d+)\s*[:.)\-]\s*(.+)$/i);
    if (!m) return null; // must be a clean step list
    steps.push({ n: m[1]!, text: m[2]! });
  }
  return steps;
}

function parseTemplate(raw: string): { key: string; val: string }[] | null {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;
  const rows: { key: string; val: string }[] = [];
  for (const l of lines) {
    const m = l.match(/^([A-Z][A-Za-z0-9 _/()-]{1,28}):\s*(.*)$/);
    if (!m) return null;
    rows.push({ key: m[1]!.trim(), val: m[2]!.trim() });
  }
  return rows;
}

function parseRouting(raw: string): { from: string; to: string }[] | null {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const rows: { from: string; to: string }[] = [];
  for (const l of lines) {
    const m = l.match(/^(.+?)\s*→\s*(.+)$/);
    if (!m) return null;
    rows.push({ from: m[1]!.trim(), to: m[2]!.replace(/^go to\s*/i, '').trim() });
  }
  return rows;
}

function Figure({ raw, line, subs }: { raw: string; line?: number; subs: Subs }) {
  // Every figure branch carries the block's first source line as an L-anchor, so
  // a search hit inside it lands on the figure (deeper lines resolve here via the
  // reveal fallback). Only code-derived blocks are line-indexed, so this + the
  // command / timeline / flow anchors make every indexed line reachable.
  const anchor = line != null ? `L${line}` : undefined;
  const routes = parseRouting(raw);
  if (routes) {
    return (
      <ul class="routing" id={anchor}>
        {routes.map((r) => (
          <li class="route-ref">
            <span class="route-from"><Filled raw={r.from} subs={subs} /></span>
            <span class="route-arrow" aria-hidden="true">→</span>
            <span class="route-to"><Filled raw={r.to} subs={subs} /></span>
          </li>
        ))}
      </ul>
    );
  }
  const steps = parseSteps(raw);
  if (steps) {
    return (
      <ol class="proto" id={anchor}>
        {steps.map((s) => (
          <li class="proto-step">
            <span class="proto-n">{String(s.n).padStart(2, '0')}</span>
            <span class="proto-text"><Filled raw={s.text} subs={subs} /></span>
          </li>
        ))}
      </ol>
    );
  }
  const tpl = parseTemplate(raw);
  if (tpl) {
    return (
      <div class="template" id={anchor}>
        <div class="template-head"><span class="label">template</span><CopyButton text={fillText(raw, subs)} klass="tpl-copy" /></div>
        <dl class="tpl-rows">
          {tpl.map((r) => (
            <div class="tpl-row"><dt class="tpl-key">{r.key}</dt><dd class="tpl-val"><Filled raw={r.val} subs={subs} /></dd></div>
          ))}
        </dl>
      </div>
    );
  }
  return (
    <div class="figure-wrap" id={anchor}>
      <CopyButton text={fillText(raw, subs)} klass="fig-copy" />
      <pre class="figure"><Filled raw={raw} subs={subs} /></pre>
    </div>
  );
}

/* ---- state chips ---- */
function Chips({ ids, kind }: { ids: string[]; kind: 'need' | 'gain' }) {
  if (!ids.length) return null;
  return (
    <div class="chips">
      <span class="label">{kind === 'need' ? 'needs' : 'yields'}</span>
      {ids.map((id) => <span class={`chip chip-${kind}`}>{stateLabel(id)}</span>)}
    </div>
  );
}

/* ---- one content block ---- */
function Block({ block, subs }: { block: ContentBlock; subs: Subs }) {
  switch (block.kind) {
    case 'subhead':
      return null; // handled by section grouping
    case 'prose': {
      const html = fillHtml(block.html.trim(), subs);
      // A leading bold LABEL followed by prose ("What it is: ...", "Most common
      // exploit path: ...", "Requires: ...") becomes a designed label/value block,
      // not floating bold text. The colon may sit inside or just outside the bold.
      const m =
        html.match(/^<strong>\s*([^<]{2,46}?)\s*:\s*<\/strong>\s*([\s\S]+)$/) ||
        html.match(/^<strong>\s*([^<]{2,46}?)\s*<\/strong>\s*:\s*([\s\S]+)$/);
      if (m) {
        const label = m[1]!;
        const key = /exploit path|attack path|most common|kill.?chain|why it/i.test(label);
        // "What it is" / "How it works" explanation blocks carry the orange left
        // accent on every technique page (Z's C2 standard); the money line keeps
        // the stronger framed-label treatment on top.
        const explain = !key && /what it is|how it works|what it does|what this is|the idea/i.test(label);
        return (
          <div class={key ? 'lead-note is-key' : explain ? 'lead-note is-explain' : 'lead-note'}>
            <span class="lead-note-label" dangerouslySetInnerHTML={{ __html: label.trim() }} />
            <p class="lead-note-body" dangerouslySetInnerHTML={{ __html: m[2]!.trim() }} />
          </div>
        );
      }
      // A short all-bold line labels the block that follows it (vim: / Tools: / Method 1: ...).
      const cap = html.match(/^<strong>([\s\S]{1,46}?):?\s*<\/strong>$/);
      if (cap) return <p class="block-label" dangerouslySetInnerHTML={{ __html: cap[1]! }} />;
      // A genuine multi-clause all-bold statement stays a lead.
      const isLead = /^<strong>[\s\S]*<\/strong>$/.test(html);
      return <p class={isLead ? 'lead' : 'prose'} dangerouslySetInnerHTML={{ __html: html }} />;
    }
    case 'callout':
      return <div class="callout" dangerouslySetInnerHTML={{ __html: fillHtml(block.html, subs) }} />;
    case 'briefing':
      return (
        <dl class="briefing">
          {block.fields.map((f) => (
            <div class="brief-row">
              <dt class="label brief-label">{f.label}</dt>
              <dd class="brief-val" dangerouslySetInnerHTML={{ __html: fillHtml(f.html, subs) }} />
            </div>
          ))}
        </dl>
      );
    case 'commands':
      return (
        <div class="cmd-group">
          {block.items.map((it) => ('t' in it ? <CommandRow raw={it.raw} line={it.line} subs={subs} /> : <NoteRow text={it.text} subs={subs} />))}
        </div>
      );
    case 'list':
      if (block.ordered && block.items.length > 2 && block.items.every((it) => /^\s*<strong>/.test(it.html))) {
        return (
          <ol class="law-cards">
            {block.items.map((it, i) => (
              <li class="law-card">
                <span class="law-n">{String(i + 1).padStart(2, '0')}</span>
                <span class="law-text" dangerouslySetInnerHTML={{ __html: fillHtml(it.html, subs) }} />
              </li>
            ))}
          </ol>
        );
      }
      return block.ordered ? (
        <ol class="list">{block.items.map((it) => <li dangerouslySetInnerHTML={{ __html: fillHtml(it.html, subs) }} />)}</ol>
      ) : (
        <ul class="list">
          {block.items.map((it) => (
            <li class={it.checked != null ? 'task' : ''}>
              {it.checked != null && <span class="box">{it.checked ? '[x]' : '[ ]'}</span>}
              <span dangerouslySetInnerHTML={{ __html: fillHtml(it.html, subs) }} />
            </li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <div class="table-wrap">
          <table>
            <thead><tr>{block.headers.map((h) => <th dangerouslySetInnerHTML={{ __html: fillHtml(h, subs) }} />)}</tr></thead>
            <tbody>{block.rows.map((row) => <tr>{row.map((c) => <td dangerouslySetInnerHTML={{ __html: fillHtml(c, subs) }} />)}</tr>)}</tbody>
          </table>
        </div>
      );
    case 'figure':
      return <Figure raw={block.raw} line={block.startLine} subs={subs} />;
    case 'timeline':
      return (
        <ol class="timeline" id={`L${block.startLine}`}>
          {block.phases.map((p) => (
            <li class="tl-phase">
              <div class="tl-node"><span>{p.n}</span></div>
              <div class="tl-content">
                <div class="tl-name">{p.name}</div>
                {p.does.length > 0 && <ul class="tl-does">{p.does.map((d) => <li><Filled raw={d} subs={subs} /></li>)}</ul>}
                {p.done && <div class="tl-gate"><span class="label">done when</span><span><Filled raw={p.done} subs={subs} /></span></div>}
              </div>
            </li>
          ))}
        </ol>
      );
    case 'flow':
      return (
        <div class="flow" id={`L${block.startLine}`}>
          {block.intro && <p class="flow-intro"><span class="label">start</span> <Filled raw={block.intro} subs={subs} /></p>}
          <ol class="flow-steps">
            {block.steps.map((s) => (
              <li class="flow-step">
                <div class="flow-node"><span>{s.n}</span></div>
                <div class="flow-content">
                  <div class="flow-title">{s.title}</div>
                  {s.options.length > 0 && <ul class="flow-opts">{s.options.map((o) => <li><Filled raw={o} subs={subs} /></li>)}</ul>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      );
    default:
      return null;
  }
}

/* ---- group blocks into collapsible subhead sections ---- */
interface Section { head: string | null; blocks: ContentBlock[] }
function sectionize(blocks: ContentBlock[]): Section[] {
  const out: Section[] = [];
  let cur: Section = { head: null, blocks: [] };
  for (const b of blocks) {
    if (b.kind === 'subhead') {
      if (cur.head !== null || cur.blocks.length) out.push(cur);
      cur = { head: b.text, blocks: [] };
    } else {
      cur.blocks.push(b);
    }
  }
  if (cur.head !== null || cur.blocks.length) out.push(cur);
  return out;
}

export default function TechniqueCard({ tech }: { tech: Technique }) {
  // Subscribe to the operator's engagement variables once for the whole card;
  // `subs` threads down so every block fills. [] on server + first client render
  // (matches SSR, no hydration mismatch), then live-updates on any var change.
  const [subs, setSubs] = useState<Subs>([]);
  useEffect(() => {
    setSubs(activeSubs());
    return onVarsChange(() => setSubs(activeSubs()));
  }, []);

  const sections = sectionize(tech.blocks);
  const hasMeta =
    (tech.prerequisites?.length ?? 0) + (tech.outputs?.length ?? 0) + (tech.tools?.length ?? 0) > 0;
  return (
    <div class="tech-card">
      {hasMeta && (
        <div class="tech-meta">
          <Chips ids={tech.prerequisites ?? []} kind="need" />
          <Chips ids={tech.outputs ?? []} kind="gain" />
          {(tech.tools ?? []).length > 0 && (
            <div class="chips">
              <span class="label">tools</span>
              {(tech.tools ?? []).map((t) => <span class="chip chip-tool">{t}</span>)}
            </div>
          )}
        </div>
      )}
      <div class="tech-body">
        {sections.map((sec) =>
          sec.head !== null ? (
            <details class="section" open>
              <summary class="section-head"><span class="section-chev" aria-hidden="true">›</span>{sec.head}</summary>
              <div class="section-body">{sec.blocks.map((b) => <Block block={b} subs={subs} />)}</div>
            </details>
          ) : (
            sec.blocks.map((b) => <Block block={b} subs={subs} />)
          )
        )}
      </div>
    </div>
  );
}
