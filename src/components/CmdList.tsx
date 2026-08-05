/**
 * CmdList — renders a group of library commands: each with its intent caption,
 * live variable substitution (Variable Console), and one-click copy of the
 * filled form.
 */
import { useEffect, useState } from 'preact/hooks';
import type { Cmd } from '../data/commands.ts';
import { activeSubs, onVarsChange, tokenize } from '../lib/vars.ts';
import { anchorId } from '../lib/anchor.ts';
import PinButton from './PinButton.tsx';

type Subs = { ph: string; value: string }[];

function CmdRow({ c, subs, domId }: { c: Cmd; subs: Subs; domId: string }) {
  const [copied, setCopied] = useState(false);
  const parts = tokenize(c.cmd, subs);
  const filled = parts.map((t) => t.text).join('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(filled); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* */ }
  };
  return (
    <div class="libcmd" id={domId}>
      <p class="libcmd-desc">{c.desc}</p>
      <div class="cmd">
        <pre class="cmd-raw">{parts.map((t) => (t.isVar ? <span class="cmd-var">{t.text}</span> : t.text))}</pre>
        <PinButton cmd={c.cmd} desc={c.desc} />
        <button class="cmd-copy" onClick={copy} aria-label="Copy">{copied ? 'copied' : 'copy'}</button>
      </div>
      {c.note && <p class="cmd-note">{c.note}</p>}
    </div>
  );
}

export default function CmdList({ commands }: { commands: Cmd[] }) {
  // Subscribe to the operator's variables ONCE per island (not once per row) and
  // thread `subs` down, mirroring TechniqueCard. A hub page mounts one CmdList
  // island per block, so this keeps a single oa-vars listener per list instead of
  // one per command; a var change re-renders each list once, not row by row.
  const [subs, setSubs] = useState<Subs>([]);
  useEffect(() => { setSubs(activeSubs()); return onVarsChange(() => setSubs(activeSubs())); }, []);

  // Content-hash anchors must be unique within a page; suffix any repeat so the
  // DOM stays valid and the omnibox still lands on the first (canonical) row.
  const seen = new Map<string, number>();
  return (
    <div class="libcmd-list">
      {commands.map((c) => {
        const base = anchorId(c.cmd);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const domId = n === 0 ? base : `${base}-${n}`;
        return <CmdRow key={domId} c={c} subs={subs} domId={domId} />;
      })}
    </div>
  );
}
