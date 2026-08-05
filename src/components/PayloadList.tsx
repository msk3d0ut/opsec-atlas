/**
 * PayloadList — renders a category of payloads with live variable substitution
 * (via the Variable Console) and one-click copy of the filled form.
 */
import { useEffect, useState } from 'preact/hooks';
import type { Payload } from '../data/payloads.ts';
import { activeSubs, onVarsChange, tokenize } from '../lib/vars.ts';
import { anchorId } from '../lib/anchor.ts';
import PinButton from './PinButton.tsx';

type Subs = { ph: string; value: string }[];

function PayloadRow({ p, subs, domId }: { p: Payload; subs: Subs; domId: string }) {
  const [copied, setCopied] = useState(false);
  const parts = tokenize(p.code, subs);
  const filled = parts.map((t) => t.text).join('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(filled); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* */ }
  };
  return (
    <div class="payload" id={domId}>
      <div class="payload-head">
        <span class="payload-title">{p.title}</span>
        <span class="payload-lang">{p.lang}</span>
      </div>
      {p.note && <p class="cmd-note">{p.note}</p>}
      <div class="cmd">
        <pre class="cmd-raw">{parts.map((t) => (t.isVar ? <span class="cmd-var">{t.text}</span> : t.text))}</pre>
        <PinButton cmd={p.code} desc={p.title} />
        <button class="cmd-copy" onClick={copy} aria-label="Copy">{copied ? 'copied' : 'copy'}</button>
      </div>
    </div>
  );
}

export default function PayloadList({ payloads, catId = '' }: { payloads: Payload[]; catId?: string }) {
  // One vars subscription per island, threaded down (see CmdList).
  const [subs, setSubs] = useState<Subs>([]);
  useEffect(() => { setSubs(activeSubs()); return onVarsChange(() => setSubs(activeSubs())); }, []);

  // The same payload code recurs across categories (a listener reused in "shell
  // upgrade"); scope the anchor by category so ids stay unique page-wide and the
  // omnibox lands on the right category. Must match the omnibox href builder.
  return (
    <div class="payload-list">
      {payloads.map((p) => {
        const domId = anchorId(catId ? `${catId}#${p.code}` : p.code);
        return <PayloadRow key={domId} p={p} subs={subs} domId={domId} />;
      })}
    </div>
  );
}
