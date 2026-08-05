/**
 * OpsecAtlas V3 — pipeline entity model.
 *
 * The Markdown files are SOURCE, never surface. The parsing core (reused from
 * V2, proven byte-exact) shreds them into a typed entity graph of TECHNIQUES
 * made of typed content BLOCKS. On TOP of that, V3 extracts a real domain model:
 * a curated closed set of STATES (what an operator holds), grounded EDGES between
 * them (state -> technique -> new state), and ROUTES (ordered next-moves for a
 * state). That domain model is the product; the blocks are the reference substrate.
 *
 * Command fidelity is a hard constraint (master §5): every command's `raw`
 * string is byte-exact to source and is the exact copy payload. Nothing here
 * rewrites, sanitizes, or reformats a command.
 */

export type Environment =
  | 'linux' | 'windows' | 'active-directory' | 'web' | 'network' | 'all';

export interface SourceDoc {
  id: string;
  title: string;
  file: string;
  envTags: Environment[];
}

/* ---- content blocks (discriminated union) ---- */

/** A single, individually-copyable command. `raw` is the exact copy payload. */
export interface Command {
  raw: string; // byte-exact (may span lines via trailing "\")
  line: number; // source line of the command's first line -> deep-link + search
}
/** A comment/explanation line that sits OUTSIDE any copy target. */
export interface Note {
  text: string; // leading `#` stripped
  line: number;
}
/** A run of shell/code: notes and commands interleaved in source order.
 *  Each command copies on its own — never "copy 10 to run 1". */
export interface CommandGroup {
  kind: 'commands';
  lang: string;
  items: (Note | (Command & { t: 'cmd' }))[];
}
/** A subsection heading (a composed H3/H4) inside a technique. The section is
 *  the unit; its subheadings become internal structure, not separate pages. */
export interface SubheadBlock { kind: 'subhead'; text: string; depth: number }
export interface ProseBlock { kind: 'prose'; html: string }
export interface TableBlock { kind: 'table'; headers: string[]; rows: string[][] } // cells = inline HTML
export interface ListItem { html: string; checked: boolean | null }
export interface ListBlock { kind: 'list'; ordered: boolean; items: ListItem[] }
export interface CalloutBlock { kind: 'callout'; html: string }
/** A structured briefing (the doc-intro "description / best for / strength")
 *  lifted from a run-on blockquote into labeled fields, rendered as a panel. */
export interface BriefingBlock { kind: 'briefing'; fields: { label: string; html: string }[] }
/** Non-command monospace: ASCII diagrams, tables-as-art, sample output. */
export interface FigureBlock { kind: 'figure'; raw: string; startLine: number }

/** A phased process (e.g. the PT lifecycle) lifted from ASCII into structure.
 *  `startLine` anchors search hits on the block's source lines (lands-on-line). */
export interface TimelinePhase { n: number; name: string; does: string[]; done: string }
export interface TimelineBlock { kind: 'timeline'; title: string; phases: TimelinePhase[]; startLine: number }

/** A decision flow ("I have X -> what first?") lifted from ASCII into structure.
 *  In V3 this is a first-class SEED for the edge graph, not only a view. */
export interface FlowStep { n: number; title: string; options: string[] }
export interface FlowBlock { kind: 'flow'; intro: string; steps: FlowStep[]; startLine: number }

export type ContentBlock =
  | CommandGroup | ProseBlock | TableBlock | ListBlock | CalloutBlock | BriefingBlock | FigureBlock | TimelineBlock | FlowBlock | SubheadBlock;

/* ---- V3 domain model (the next-move engine) ---- */

/** An operator STATE: what you hold. The vocabulary is curated + closed. */
export type StateId = string; // e.g. 'low-priv-creds', 'nt-hash', 'krbtgt-hash'

/** Kill-chain phase, used to order route steps sensibly. */
export type PhaseId =
  | 'recon' | 'scanning' | 'enum' | 'exploitation'
  | 'privesc' | 'lateral' | 'post-exploit' | 'reporting';

/** Grounding for a derived fact: which source line justifies it. Trust rule. */
export interface Provenance { docId: string; line: number; quote: string }

/** A Technique — the atomic reading/reference unit AND a graph transition.
 *  Domain fields are populated by enrich.ts; undefined before enrichment. */
export interface Technique {
  id: string; // internal key: docId + "#" + unique-slug
  slug: string; // product-native URL slug (globally unique)
  docId: string;
  title: string;
  depth: number;
  breadcrumb: string[];
  startLine: number;
  envTags: Environment[];
  blocks: ContentBlock[];
  // ---- domain model (filled by enrich.ts) ----
  prerequisites?: StateId[]; // states you must hold to run this
  outputs?: StateId[];       // states this yields
  tools?: string[];          // detected tools
  phase?: PhaseId;           // kill-chain phase
  provenance?: Provenance[]; // grounding for the extracted states
}

/** One ordered next-move in a route: which technique, why, and what it yields. */
export interface RouteStep {
  order: number;
  techniqueSlug: string;
  title: string;
  phase?: PhaseId;
  rationale: string;
  leadsTo: StateId[];
}

/** The next-move engine's output for a state the operator holds. */
export interface Route {
  startState: StateId;
  startLabel: string;
  steps: RouteStep[];
}

/** One row of the literal search index: every command/comment line is findable. */
export interface LineIndexEntry {
  docId: string;
  techniqueId: string;
  slug: string;
  techniqueTitle: string;
  breadcrumb: string[];
  line: number;
  raw: string;
  isComment: boolean;
}

export interface Corpus {
  builtAt: string;
  docs: SourceDoc[];
  techniques: Technique[];
  lineIndex: LineIndexEntry[];
  stats: {
    docs: number;
    techniques: number;
    commands: number;
    blocks: number;
    indexedLines: number;
  };
}
