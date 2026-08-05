/**
 * OpsecAtlas V3 — markdown parsing core (reused from V2, proven byte-exact).
 *
 * Markdown (source) -> typed entity graph of TECHNIQUES made of typed content
 * BLOCKS (commands / prose / table / list / callout / figure / timeline / flow)
 * + a literal, line-addressable search index. Shell commands are atomized so
 * each is individually copyable; comments stay outside the copy target.
 *
 * Reads V1 content read-only. Exports `parseDoc` and `parseAll`; the on-disk
 * write + CLI live in build.ts. No behavior change from V2's parser.
 */
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import type { Root, RootContent, Heading as MdHeading, Code } from 'mdast';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import matter from 'gray-matter';
import type {
  Corpus, Environment, LineIndexEntry, SourceDoc, Technique,
  ContentBlock, CommandGroup, Note, Command, TableBlock, ListBlock, CalloutBlock,
} from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// The authored knowledge base: one Markdown file per doc with YAML frontmatter
// (id/title/tags/noEntry), inside the app at src/content/atlas/. Markdown is the
// SOURCE of truth; the pipeline compiles it to the gitignored typed corpus.
export const CONTENT_DIR = resolve(HERE, '../src/content/atlas');

// Deploy-time base path (same source as astro.config). Root-relative internal
// links in content (`/technique/slug/`) get this prepended so they resolve
// correctly whether we ship at root or under a subpath. Always ends in '/'.
const INTERNAL_BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

export interface ManifestEntry { id: string; filename: string; title: string; tags: string[]; noEntry?: boolean }

const KNOWN_ENVS: Environment[] = ['linux', 'windows', 'active-directory', 'web', 'network', 'all'];
const toEnvTags = (tags: string[]): Environment[] =>
  tags.filter((t): t is Environment => (KNOWN_ENVS as string[]).includes(t));

const slugify = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

const normalizeLang = (lang: string | null | undefined): string =>
  (lang || 'text').toLowerCase().replace(/^shell$/, 'bash').replace(/^console$/, 'bash');

// Shell-family blocks follow "one line = one command" — safe to atomize.
const SHELL_LANGS = new Set(['bash', 'sh', 'powershell', 'ps1', 'cmd', 'bat', 'zsh']);

/* ---- de-em-dash: our house writing rule (no em dashes in authored/displayed
 *  text). Applied to prose/titles/notes/timeline/flow, NEVER to command `raw`,
 *  figure `raw`, or inline code, which stay byte-exact. em -> " · ", en -> "-". */
const deEmDash = (s: string): string =>
  s.replace(/\s*—\s*/g, ' · ').replace(/\s*–\s*/g, '-');

/* Command fidelity: the EXECUTABLE part of a command stays byte-exact. Only the
 *  trailing inline comment (after a whitespace-`#`) follows the no-em-dash rule,
 *  and even there only the typographic dash chars change · shells ignore it. */
const deEmDashCmd = (raw: string): string =>
  raw
    .split('\n')
    .map((line) => {
      const i = line.search(/\s#/);
      return i === -1 ? line : line.slice(0, i) + deEmDash(line.slice(i));
    })
    .join('\n');

/* ---- inline serialization (safe subset: our own trusted content) ---- */
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Attribute context also needs the double-quote escaped, or a URL containing a
// `"` would break out of href="..." (content is trusted, but this keeps the
// serialized markup well-formed and closes the injection path for the review).
const escAttr = (s: string): string => esc(s).replace(/"/g, '&quot;');

/**
 * Resolve a markdown link URL to a safe href, or null when its scheme is unsafe.
 * Only http(s), mailto, tel, and scheme-less (relative / anchor) URLs may become
 * a live href; `javascript:`, `data:`, `vbscript:`, and any other scheme are
 * NEUTRALIZED (the caller renders the link text with no href) so a link in the
 * source content can never smuggle script execution. Root-relative links become
 * base-aware; http(s) links open in a new tab. Exported for the security test.
 */
export function resolveHref(url: string): { href: string; external: boolean } | null {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase();
  const external = scheme === 'http' || scheme === 'https';
  if (scheme && !external && scheme !== 'mailto' && scheme !== 'tel') return null;
  const href = external ? url : url.startsWith('/') ? INTERNAL_BASE + url.replace(/^\/+/, '') : url;
  return { href, external };
}

function inlineHtml(node: any): string {
  switch (node.type) {
    case 'text': return esc(deEmDash(node.value));
    case 'strong': return `<strong>${childrenHtml(node)}</strong>`;
    case 'emphasis': return `<em>${childrenHtml(node)}</em>`;
    case 'inlineCode': return `<code>${esc(node.value)}</code>`;
    case 'delete': return `<del>${childrenHtml(node)}</del>`;
    case 'break': return '<br>';
    case 'link': {
      // Scheme-checked: an unsafe scheme (javascript:/data:/...) drops the href
      // and renders just the link text, so a link can never smuggle script exec.
      const safe = resolveHref(node.url);
      if (!safe) return childrenHtml(node);
      return `<a href="${escAttr(safe.href)}"${safe.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${childrenHtml(node)}</a>`;
    }
    default:
      return 'children' in node ? childrenHtml(node) : 'value' in node ? esc(node.value) : '';
  }
}
const childrenHtml = (node: any): string => (node.children ?? []).map(inlineHtml).join('');

/* ---- product-native slugs (no source-file artifacts) ---- */
const stripEnumerator = (t: string): string =>
  t
    .replace(/^\[\d+\]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^section\s+[a-z0-9]+\s*[—:·–-]\s*/i, '')
    .replace(/^step\s+\d+:\s*/i, '')
    .replace(/^phase\s+\d+\s*[—:·–-]?\s*/i, '')
    .trim();

/* ---- title overrides: markdown titles are not sacred (Z). Cleaner names for
 *  the clunky ones; keyed by the enumerator-stripped, lowercased title. ---- */
const TITLE_OVERRIDES: Record<string, string> = {
  'the pt / red team lifecycle': 'Red Team Lifecycle',
  'mindset rules · the 10 laws': 'The 10 Laws',
  'priority order table': 'Windows Escalation Priorities',
  'escalation priority order': 'Linux Escalation Priorities',
};
const betterTitle = (text: string): string => {
  const key = stripEnumerator(text).toLowerCase().replace(/\s+/g, ' ').trim();
  return TITLE_OVERRIDES[key] ?? text;
};

function makeSlug(title: string, registry: Set<string>): string {
  const base = slugify(stripEnumerator(title)) || 'section';
  let s = base;
  let n = 1;
  while (registry.has(s)) { n += 1; s = `${base}-${n}`; }
  registry.add(s);
  return s;
}

/* ---- lifecycle ASCII -> structured timeline ---- */
function parseLifecycle(raw: string): { n: number; name: string; does: string[]; done: string }[] | null {
  if (!/PENETRATION TESTING LIFECYCLE/i.test(raw) || !/\[1\]/.test(raw)) return null;
  const strip = (s: string) => s.replace(/[─-◿]/g, '').trim(); // box-drawing + arrows
  const phases: { n: number; name: string; does: string[]; done: string }[] = [];
  let cur: { n: number; name: string; does: string[]; done: string } | null = null;
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*\[(\d+)\]\s+(.+?)\s*$/);
    if (m) { cur = { n: Number(m[1]), name: m[2]!.trim(), does: [], done: '' }; phases.push(cur); continue; }
    if (!cur) continue;
    const text = deEmDash(strip(line));
    if (!text) continue;
    const dm = text.match(/^DONE when:\s*(.+)$/i);
    if (dm) cur.done = dm[1]!.trim();
    else cur.does.push(text);
  }
  return phases.length ? phases : null;
}

/* ---- decision-tree ASCII -> structured flow (a graph SEED in V3) ---- */
function parseDecisionFlow(raw: string): { intro: string; steps: { n: number; title: string; options: string[] }[] } | null {
  if (!/STEP\s*\d+\s*:/i.test(raw) || !/↓/.test(raw)) return null;
  let intro = '';
  const steps: { n: number; title: string; options: string[] }[] = [];
  let cur: { n: number; title: string; options: string[] } | null = null;
  for (const line of raw.split('\n')) {
    const t = deEmDash(line.trim());
    if (!t || t === '↓') continue;
    const sm = t.match(/^STEP\s*(\d+)\s*:\s*(.+)$/i);
    if (sm) { cur = { n: Number(sm[1]), title: sm[2]!.trim(), options: [] }; steps.push(cur); continue; }
    const om = t.match(/^→\s*(.+)$/);
    if (om && cur) { cur.options.push(om[1]!.trim()); continue; }
    if (!cur) intro = t.replace(/\s*→\s*$/, '').trim();
    else cur.options.push(t);
  }
  return steps.length ? { intro, steps } : null;
}

/* ---- classify a non-shell code block: script / ascii / template / steps /
 *  routing / payload-list. Payload-lists get per-line copy (no more "20 SQLi
 *  payloads, one copy button"); everything else stays a whole figure. ---- */
const isScriptish = (raw: string): boolean =>
  /(^|\n)[ \t]{2,}\S/.test(raw) || /<\?php|<\?=|#!\//.test(raw) ||
  /(^|\n)(def |class |function |import |from \w+ import|public |private )/.test(raw);
const isAsciiArt = (raw: string): boolean =>
  /[│┌┐└┘├┤┬┴┼─═║╔╗╚╝▼▲◄►]/.test(raw) || raw.split('\n').some((l) => /\S\s{3,}\S+\s{3,}\S/.test(l));
const looksTemplate = (raw: string): boolean => {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length >= 3 && lines.every((l) => /^[A-Z][A-Za-z0-9 _/()-]{1,28}:\s*\S/.test(l));
};
const looksSteps = (raw: string): boolean => {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length >= 3 && lines.every((l) => /^(?:step\s*)?\d+\s*[:.)\-]\s*.+/i.test(l));
};
/** A natural-language line (a caption/routing sentence), not a payload. */
const NATURAL = (l: string): boolean => {
  const t = l.trim();
  return /^[A-Z(]/.test(t) && (t.match(/\b[a-z]{3,}\b/g) || []).length >= 4 && !/[<>{};|=]|--|\/\*|\$_/.test(t);
};
/** A block that is entirely "A -> go here" routing pointers (even in a shell
 *  fence): it is navigation, not commands. Rendered as designed cross-links. */
const isRoutingBlock = (raw: string): boolean => {
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  return lines.length >= 2 && lines.every((l) => l.includes('→') && /^[A-Za-z]/.test(l));
};

/** A flat list of payloads/commands worth atomizing into per-line copy. */
const isAtomizable = (raw: string): boolean => {
  const lines = raw.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return false;
  if (isScriptish(raw) || isAsciiArt(raw) || looksTemplate(raw) || looksSteps(raw)) return false;
  const natural = lines.filter(NATURAL).length;
  return natural <= lines.length * 0.4;
};

/** Atomize a non-shell list: leading comment markers and natural sentences
 *  become captions; every other line is an individually-copyable payload. */
function parseAtomicList(code: Code): CommandGroup {
  const lang = normalizeLang(code.lang);
  const start = (code.position?.start.line ?? 0) + 1;
  const marker = lang === 'sql' ? /^\s*--\s?/ : /^\s*(#|\/\/)\s?/;
  const items: (Note | (Command & { t: 'cmd' }))[] = [];
  code.value.split('\n').forEach((raw, i) => {
    if (!raw.trim()) return;
    const line = start + i;
    if (marker.test(raw)) items.push({ text: deEmDash(raw.replace(marker, '')), line });
    else if (NATURAL(raw)) items.push({ text: deEmDash(raw.trim()), line });
    else items.push({ t: 'cmd', raw: deEmDashCmd(raw), line });
  });
  return { kind: 'commands', lang, items };
}

/* ---- block parsers ---- */
function parseCommandGroup(code: Code): CommandGroup {
  const lang = normalizeLang(code.lang);
  const start = (code.position?.start.line ?? 0) + 1;
  const lines = code.value.split('\n');
  const items: (Note | (Command & { t: 'cmd' }))[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i]!;
    const line = start + i;
    if (/^\s*#/.test(raw)) {
      items.push({ text: deEmDash(raw.replace(/^\s*#\s?/, '')), line });
      i++;
    } else if (raw.trim() === '') {
      i++;
    } else {
      // one command, joining shell line-continuations (a lone "\" preceded by
      // whitespace/start), but NOT Windows paths like `C:\Temp\`. Byte-exact.
      const continues = (s: string) => /(?:^|\s)\\$/.test(s.replace(/\s+$/, ''));
      let cmdRaw = raw;
      let j = i;
      while (continues(lines[j]!) && j + 1 < lines.length) { j++; cmdRaw += '\n' + lines[j]!; }
      items.push({ t: 'cmd', raw: deEmDashCmd(cmdRaw), line });
      i = j + 1;
    }
  }
  return { kind: 'commands', lang, items };
}

function parseTable(node: any): TableBlock {
  const rows: string[][] = node.children.map((row: any) => row.children.map((cell: any) => childrenHtml(cell)));
  return { kind: 'table', headers: rows[0] ?? [], rows: rows.slice(1) };
}

function parseList(node: any): ListBlock {
  const items = node.children.map((li: any) => ({
    checked: (typeof li.checked === 'boolean' ? li.checked : null) as boolean | null,
    html: li.children
      .filter((c: any) => c.type === 'paragraph' || c.type === 'text')
      .map((c: any) => childrenHtml(c))
      .join(' ')
      .trim(),
  }));
  return { kind: 'list', ordered: !!node.ordered, items };
}

function parseCallout(node: any): CalloutBlock {
  const html = node.children
    .map((c: any) => (c.type === 'paragraph' ? `<p>${childrenHtml(c)}</p>` : childrenHtml(c)))
    .join('');
  return { kind: 'callout', html };
}

/** Detect the doc-intro blockquote ("**One-line description:** ... **Best For:**
 *  ... **Strength:** ...") and lift it into labeled briefing fields. Returns
 *  null for ordinary callouts (they render as a callout). */
function parseBriefing(node: any): { label: string; html: string }[] | null {
  const para = node.children?.find((c: any) => c.type === 'paragraph');
  if (!para) return null;
  const fields: { label: string; html: string }[] = [];
  let cur: { label: string; html: string } | null = null;
  for (const child of para.children) {
    if (child.type === 'strong') {
      const label = childrenHtml(child).replace(/<[^>]+>/g, '').replace(/:\s*$/, '').trim();
      if (label) { cur = { label, html: '' }; fields.push(cur); continue; }
    }
    if (child.type === 'break') continue;
    if (cur) cur.html += inlineHtml(child);
  }
  const clean = fields.map((f) => ({ label: f.label, html: f.html.trim() })).filter((f) => f.html);
  return clean.length >= 2 ? clean : null;
}

/** Index every non-blank physical line of a code/figure block (exhaustive, literal). */
function indexCodeLines(code: Code, tech: Technique, lineIndex: LineIndexEntry[]): void {
  const start = (code.position?.start.line ?? 0) + 1;
  code.value.split('\n').forEach((raw, i) => {
    if (raw.trim() === '') return;
    lineIndex.push({
      docId: tech.docId, techniqueId: tech.id, slug: tech.slug, techniqueTitle: tech.title,
      breadcrumb: tech.breadcrumb, line: start + i, raw, isComment: /^\s*#/.test(raw),
    });
  });
}

export function parseDoc(
  doc: ManifestEntry,
  body: string,
  slugRegistry: Set<string>
): { techniques: Technique[]; lineIndex: LineIndexEntry[] } {
  // Normalize CRLF -> LF so no command copies a stray carriage return (fidelity).
  const raw = body.replace(/\r\n/g, '\n');
  const tree: Root = fromMarkdown(raw, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  const envTags = toEnvTags(doc.tags);

  const techniques: Technique[] = [];
  const lineIndex: LineIndexEntry[] = [];
  const headingStack: { depth: number; text: string }[] = [];
  let current: Technique | null = null;

  const seenSlugs = new Map<string, number>();
  const uniqueSlug = (base: string): string => {
    const n = (seenSlugs.get(base) ?? 0) + 1;
    seenSlugs.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };

  const ensureCurrent = (): Technique => {
    if (current) return current;
    current = {
      id: `${doc.id}#${uniqueSlug(slugify(doc.title))}`,
      slug: makeSlug(doc.title, slugRegistry),
      docId: doc.id, title: doc.title, depth: 1, breadcrumb: [doc.title],
      startLine: 1, envTags, blocks: [],
    };
    techniques.push(current);
    return current;
  };
  const push = (block: ContentBlock) => ensureCurrent().blocks.push(block);

  for (const node of tree.children as RootContent[]) {
    switch (node.type) {
      case 'heading': {
        const h = node as MdHeading;
        // Heading is plain text: strip any inline tags and decode the small
        // entity set our serializer emits (so "Import & Start" is not "&amp;").
        const text = childrenHtml(h)
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .trim();
        const line = h.position?.start.line ?? 0;
        while (headingStack.length && headingStack[headingStack.length - 1]!.depth >= h.depth) headingStack.pop();
        headingStack.push({ depth: h.depth, text });
        if (h.depth === 1) continue;
        // The SECTION (H2) is the technique. Deeper headings (H3/H4) do NOT
        // spawn thin pages; they compose into the current technique as
        // subsection structure. This is the V3 "Technique = substantial unit".
        if (h.depth >= 3) { push({ kind: 'subhead', text, depth: h.depth }); break; }
        current = {
          id: `${doc.id}#${uniqueSlug(slugify(text))}`,
          slug: makeSlug(text, slugRegistry),
          docId: doc.id, title: betterTitle(text), depth: h.depth,
          breadcrumb: headingStack.map((s) => s.text), startLine: line, envTags, blocks: [],
        };
        techniques.push(current);
        break;
      }
      case 'code': {
        const code = node as Code;
        const tech = ensureCurrent();
        indexCodeLines(code, tech, lineIndex);
        const codeStart = (code.position?.start.line ?? 0) + 1; // shared anchor for the block's search hits
        if (isRoutingBlock(code.value)) {
          push({ kind: 'figure', raw: deEmDash(code.value), startLine: codeStart });
        } else if (SHELL_LANGS.has(normalizeLang(code.lang))) {
          push(parseCommandGroup(code));
        } else {
          const phases = parseLifecycle(code.value);
          const flow = phases ? null : parseDecisionFlow(code.value);
          if (phases) push({ kind: 'timeline', title: 'Penetration Testing Lifecycle', phases, startLine: codeStart });
          else if (flow) push({ kind: 'flow', intro: flow.intro, steps: flow.steps, startLine: codeStart });
          else if (isAtomizable(code.value)) push(parseAtomicList(code)); // payload/command list -> per-line copy
          else push({ kind: 'figure', raw: deEmDash(code.value), startLine: codeStart });
        }
        break;
      }
      case 'paragraph': {
        const html = childrenHtml(node);
        if (html.trim()) push({ kind: 'prose', html });
        break;
      }
      case 'table': push(parseTable(node)); break;
      case 'list': push(parseList(node)); break;
      case 'blockquote': {
        const brief = parseBriefing(node);
        push(brief ? { kind: 'briefing', fields: brief } : parseCallout(node));
        break;
      }
      default: break; // thematicBreak, html, etc. — ignored
    }
  }

  // A doc flagged noEntry contributes its H2 sections but NOT a depth-1 entry
  // page (its front door lives elsewhere, e.g. a library hub). Drop the lazily
  // created intro technique and any line-index rows that pointed at it.
  if (doc.noEntry) {
    const entryId = techniques.find((t) => t.depth === 1)?.id;
    if (entryId) {
      return {
        techniques: techniques.filter((t) => t.id !== entryId),
        lineIndex: lineIndex.filter((li) => li.techniqueId !== entryId),
      };
    }
  }
  return { techniques, lineIndex };
}

/** Read one technique doc: parse its YAML frontmatter (id/title/tags/noEntry) and
 *  return the raw Markdown body byte-exact. The body is split off by hand (not via
 *  the frontmatter lib) so its line numbers match the source below the frontmatter,
 *  which the literal line index / lands-on-line search depends on. */
function readEntry(filename: string): ManifestEntry & { body: string } {
  const norm = readFileSync(resolve(CONTENT_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
  const data = matter(norm).data as { id: string; title: string; tags: string[]; noEntry?: boolean };
  const close = norm.indexOf('\n---\n', 3); // closing frontmatter delimiter ('---\n' opens the file)
  const body = close === -1 ? norm : norm.slice(close + 5);
  return { id: data.id, filename, title: data.title, tags: data.tags, noEntry: data.noEntry, body };
}

export function parseAll(): Corpus {
  // Each doc is a Markdown file + YAML frontmatter in CONTENT_DIR. Sort by id so
  // slug assignment (a global, order-sensitive registry) stays deterministic.
  const entries = readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map(readEntry)
    .sort((a, b) => a.id.localeCompare(b.id));
  const docs: SourceDoc[] = [];
  const techniques: Technique[] = [];
  const lineIndex: LineIndexEntry[] = [];
  const slugRegistry = new Set<string>();

  for (const entry of entries) {
    docs.push({ id: entry.id, title: entry.title, file: entry.filename, envTags: toEnvTags(entry.tags) });
    const { techniques: t, lineIndex: li } = parseDoc(entry, entry.body, slugRegistry);
    techniques.push(...t);
    lineIndex.push(...li);
  }

  const commands = techniques.reduce(
    (n, t) => n + t.blocks.reduce((m, b) => m + (b.kind === 'commands' ? b.items.filter((it) => 't' in it).length : 0), 0), 0);
  const blocks = techniques.reduce((n, t) => n + t.blocks.length, 0);

  return {
    builtAt: new Date().toISOString(),
    docs, techniques, lineIndex,
    stats: { docs: docs.length, techniques: techniques.length, commands, blocks, indexedLines: lineIndex.length },
  };
}
