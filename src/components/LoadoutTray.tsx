/**
 * LoadoutTray — the kit you assemble as you move through the atlas. Pin any
 * command (the + on any command row) and it lands here; the tray fills every
 * command with your engagement variables and exports the whole thing as a
 * ready-to-run runbook. Operate the whole engagement without leaving.
 *
 * Mirrors the Variable Console: a topbar button with a count badge and a panel.
 * Client-side only (localStorage) via the loadout store.
 */
import { useEffect, useState } from 'preact/hooks';
import { getLoadout, removeLoadout, clearLoadout, onLoadoutChange } from '../lib/loadout.ts';
import type { LoadoutItem } from '../lib/loadout.ts';
import { activeSubs, onVarsChange, tokenize, fillText } from '../lib/vars.ts';

type Sub = { ph: string; value: string };

/** A shell-style runbook, grouped by source, filled with the current variables. */
function buildRunbook(items: LoadoutItem[], subs: Sub[]): string {
  const out: string[] = [
    '#!/usr/bin/env bash',
    '# OpsecAtlas loadout · generated runbook',
    '# Values are filled from your Variable Console. Review before you run anything.',
    '',
  ];
  let last = '';
  for (const it of items) {
    if (it.source !== last) { out.push(`# ===== ${it.source} =====`); last = it.source; }
    if (it.desc) out.push(`# ${it.desc}`);
    out.push(fillText(it.cmd, subs));
    out.push('');
  }
  return out.join('\n');
}

export default function LoadoutTray() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LoadoutItem[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const syncItems = () => setItems(getLoadout());
    const syncSubs = () => setSubs(activeSubs());
    syncItems(); syncSubs();
    const offL = onLoadoutChange(syncItems);
    const offV = onVarsChange(syncSubs);
    return () => { offL(); offV(); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (open && e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const count = items.length;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(buildRunbook(items, subs));
      setCopied(true); setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard unavailable */ }
  };

  const download = () => {
    const blob = new Blob([buildRunbook(items, subs)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'opsecatlas-loadout.sh';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button class={`load-trigger ${count > 0 ? 'is-active' : ''}`} onClick={() => setOpen(true)} aria-label="Loadout">
        <span class="load-ico" aria-hidden="true">⊕</span>
        <span class="load-word">loadout</span>
        {count > 0 && <span class="load-badge">{count}</span>}
      </button>

      {open && (
        <div class="load-overlay">
          <div class="load-panel">
            <div class="load-head">
              <span class="label">your loadout{count > 0 ? ` · ${count}` : ''}</span>
              <button class="hud-close" onClick={() => setOpen(false)} aria-label="Close" title="Close (Esc)">×</button>
            </div>

            {count === 0 ? (
              <p class="load-empty">
                Your loadout is empty. Hit <span class="load-plus">+</span> on any command to build a runbook for this engagement, then copy or download it ready to run.
              </p>
            ) : (
              <div class="load-list">
                {items.map((it) => {
                  const parts = tokenize(it.cmd, subs);
                  return (
                    <div class="load-item" key={it.id}>
                      <div class="load-item-top">
                        <span class="load-item-desc">{it.desc || it.source}</span>
                        <button class="load-remove" onClick={() => removeLoadout(it.id)} aria-label="Remove from loadout" title="Remove">×</button>
                      </div>
                      <pre class="load-cmd">{parts.map((p) => (p.isVar ? <span class="cmd-var">{p.text}</span> : p.text))}</pre>
                      {it.desc && <span class="load-src">{it.source}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            <div class="load-foot">
              <button class="load-clear" onClick={() => clearLoadout()} disabled={count === 0}>clear</button>
              <div class="load-actions">
                <button class="load-dl" onClick={download} disabled={count === 0}>download .sh</button>
                <button class="load-done" onClick={copyAll} disabled={count === 0}>{copied ? 'copied' : 'copy runbook'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
