/**
 * OpsecAtlas V3 — technique enrichment (the domain extraction).
 *
 * Reads a Technique's own text surface (prose, callouts, list items, and the
 * comment/notes inside command blocks) and extracts, GROUNDED IN THE SOURCE:
 *   - prerequisites: states you must hold to run it   (prereq-signal sentences)
 *   - outputs:       states it yields                 (output-signal sentences)
 *   - tools:         detected from the command text
 *   - phase:         kill-chain phase (for route ordering)
 *   - provenance:    the exact sentence + line that justified each state
 *
 * Classification is per-sentence and signal-gated on purpose: a state only
 * counts as a prerequisite/output when a nearby signal word says so. Precision
 * over recall — a wrong edge is the worst trust failure (priority #1). The
 * graph layer adds more edges from the files' own decision-trees.
 */
import type { PhaseId, StateId, Technique, Provenance } from './types.ts';
import { matchStates } from './states.ts';
import { detectTools } from './tools.ts';

const PREREQ_SIGNAL = /requires?|requirement|needs?|must have|with (valid )?cred|any authenticated|in hand|you (already )?have|once you have|from a domain-joined|given/i;
const OUTPUT_SIGNAL = /done when|crack|dump|produces?|yields?|forge|forged|create (a|golden|silver)|→|game over|valid for|open cmd with|extract|obtain|now run|gives you|results? in|allows? you to|inject|reset (the )?target|add yourself|survives/i;

/** Decode the small entity set our inline serializer emits, strip tags. */
const toText = (html: string): string =>
  html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/** Split a text unit into sentence-ish fragments so signals stay local.
 *  NB: do not split on ':' (it severs a signal "Requires:" from its state
 *  "NT hash") nor on the arrow '→' (it severs "krbtgt hash" from the result
 *  signal in "krbtgt hash → create Golden Ticket"). Split on enders + newlines. */
const sentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Pull the inline comment off a command line (` # ...`), where operators note
 *  what a step yields ("# Open cmd with DA privileges"). The command's `raw`
 *  copy payload is untouched; this only reads a copy for state extraction. */
const inlineComments = (raw: string): string[] =>
  raw
    .split('\n')
    .map((l) => l.match(/\s#\s?(.+)$/)?.[1]?.trim())
    .filter((c): c is string => !!c);

interface TextUnit { text: string; line: number }

/** Gather the technique's readable text units (with best-known line) + all command text. */
function surface(tech: Technique): { units: TextUnit[]; commandText: string } {
  const units: TextUnit[] = [];
  const cmds: string[] = [];
  for (const b of tech.blocks) {
    switch (b.kind) {
      case 'prose': units.push({ text: toText(b.html), line: tech.startLine }); break;
      case 'callout': units.push({ text: toText(b.html), line: tech.startLine }); break;
      case 'list':
        for (const it of b.items) units.push({ text: toText(it.html), line: tech.startLine });
        break;
      case 'commands':
        for (const it of b.items) {
          if ('t' in it) {
            cmds.push(it.raw);
            for (const c of inlineComments(it.raw)) units.push({ text: c, line: it.line });
          } else {
            units.push({ text: it.text, line: it.line }); // a standalone comment/note
          }
        }
        break;
      case 'figure': cmds.push(b.raw); break;
      default: break;
    }
  }
  return { units, commandText: cmds.join('\n') };
}

const uniq = <T>(a: T[]): T[] => [...new Set(a)];

/** Map the technique to its kill-chain phase.
 *
 *  TITLE FIRST, breadcrumb only as a fallback: a technique's phase is what the
 *  technique DOES, not the theme of the file it lives in. The old version merged
 *  title + breadcrumb, so a doc-level theme (e.g. "...PostExploitation") stamped
 *  its phase onto every child (UAC Bypass, a privesc, read "Post-Ex"); and AD
 *  domain-dominance (AD CS, Delegation) fell to the default and read "Foothold".
 *  Checked most-specific first; the breadcrumb only decides when the title is
 *  silent. */
function inferPhase(tech: Technique): PhaseId {
  const title = tech.title.toLowerCase();
  const crumb = tech.breadcrumb.join(' ').toLowerCase();
  const T = (re: RegExp) => re.test(title);

  if (T(/\breport|documentation/)) return 'reporting';
  if (T(/dcsync|golden ticket|silver ticket|mimikatz|lsass|dpapi|secretsdump|ntds|\bsam\b|persist|exfil|maintain access|stored cred|registry password|browser cred|sysprep|unattend|post-explo/)) return 'post-exploit';
  if (T(/lateral|pass-the|\bpth\b|\bptt\b|psexec|wmiexec|smbexec|evil-winrm|pivot|tunnel|\bmovement\b/)) return 'lateral';
  if (T(/privesc|escalat|priority order|\bsuid\b|\bsudo\b|capabilit|potato|seimpersonate|uac bypass|alwaysinstallelevated|service misconfig|unquoted|token impersonat|dll hijack|ad ?cs|esc[0-9]|delegation|\brbcd\b|\bacl\b|writable|\bcron\b|systemd|kernel|container escape|ld_?preload/)) return 'privesc';
  if (T(/kerberoast|as-?rep|spray|relay|coercion|poison|\bmitm\b|deserial|ssti|template injection|\bxxe\b|injection|sqli|\bxss\b|ssrf|\blfi\b|\brfi\b|\bjwt\b|nosql|file upload|file inclusion|owasp|auth\w* bypass|command inject|\bcms\b|shellshock|exploit/)) return 'exploitation';
  if (T(/enum|bloodhound|winpeas|linpeas|situational awareness|fingerprint|discovery|service enumeration|host discovery|\brecon\b/)) return 'enum';
  if (T(/\bscan\b|nmap|\bport\b/)) return 'scanning';

  // Breadcrumb fallback: only when the title itself carries no phase signal.
  // post-exploitation is checked before privesc: a doc titled "PrivEsc &
  // PostExploitation" carries both words, and a title-less support technique
  // there (file transfer) belongs to the later, more general phase.
  if (/post-explo/.test(crumb)) return 'post-exploit';
  if (/privesc|escalat/.test(crumb)) return 'privesc';
  if (/lateral|movement/.test(crumb)) return 'lateral';
  if (/recon|scanning/.test(crumb)) return 'enum';
  return 'exploitation';
}

/** Enrich one technique with grounded domain fields. Pure: returns a new object. */
export function enrich(tech: Technique): Technique {
  const { units, commandText } = surface(tech);
  const prereq: StateId[] = [];
  const outputs: StateId[] = [];
  const provenance: Provenance[] = [];

  for (const unit of units) {
    for (const frag of sentences(unit.text)) {
      const states = matchStates(frag);
      if (!states.length) continue;
      const isPrereq = PREREQ_SIGNAL.test(frag);
      const isOutput = OUTPUT_SIGNAL.test(frag);
      if (!isPrereq && !isOutput) continue; // signal-gated: precision over recall
      for (const { id } of states) {
        if (isPrereq) prereq.push(id);
        if (isOutput) outputs.push(id);
        provenance.push({ docId: tech.docId, line: unit.line, quote: frag.slice(0, 140) });
      }
    }
  }

  return {
    ...tech,
    prerequisites: uniq(prereq),
    outputs: uniq(outputs),
    tools: detectTools(commandText),
    phase: inferPhase(tech),
    provenance,
  };
}
