/**
 * JournalConsole — the engagement journal. Capture findings, credentials, hosts,
 * and notes as you work; export the whole thing as a Markdown report skeleton.
 * The last link in the operator loop (variables · start where you are · loadout ·
 * JOURNAL), so the report writes itself.
 *
 * Mirrors the Variable Console and Loadout: a topbar button with a count badge
 * and a panel that closes on × / Esc / Done, never on an outside click.
 * Client-side only (localStorage) via the journal store.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  getJournal, addEntry, removeEntry, clearJournal, onJournalChange, toMarkdown,
  ENTRY_TYPES, SEVERITIES,
} from '../lib/journal.ts';
import type { JournalEntry, EntryType, Severity } from '../lib/journal.ts';

const TYPE_LABEL: Record<EntryType, string> = { finding: 'finding', cred: 'cred', host: 'host', note: 'note' };

export default function JournalConsole() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [type, setType] = useState<EntryType>('finding');
  const [sev, setSev] = useState<Severity>('medium');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => setEntries(getJournal());
    sync();
    return onJournalChange(sync);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (open && e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Open straight into capture: focus the input so you can log without a click.
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const count = entries.length;
  const hint = ENTRY_TYPES.find((t) => t.type === type)?.hint ?? '';

  const submit = () => {
    if (!text.trim()) return;
    addEntry({ type, text, sev });
    setText('');
    inputRef.current?.focus();
  };

  const dateLabel = () => {
    try { return new Date().toLocaleString(); } catch { return ''; }
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(entries, dateLabel()));
      setCopied(true); setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard unavailable */ }
  };

  const download = () => {
    const blob = new Blob([toMarkdown(entries, dateLabel())], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'opsecatlas-journal.md';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const ordered = [...entries].reverse(); // newest first

  return (
    <>
      <button class={`jrn-trigger ${count > 0 ? 'is-active' : ''}`} onClick={() => setOpen(true)} aria-label="Engagement journal">
        <span class="jrn-ico" aria-hidden="true">✎</span>
        <span class="jrn-word">journal</span>
        {count > 0 && <span class="jrn-badge">{count}</span>}
      </button>

      {open && (
        <div class="jrn-overlay">
          <div class="jrn-panel">
            <div class="jrn-head">
              <span class="label">engagement journal{count > 0 ? ` · ${count}` : ''}</span>
              <button class="hud-close" onClick={() => setOpen(false)} aria-label="Close" title="Close (Esc)">×</button>
            </div>

            <div class="jrn-add">
              <div class="jrn-types" role="group" aria-label="Entry type">
                {ENTRY_TYPES.map((t) => (
                  <button
                    key={t.type}
                    class={`jrn-type ${type === t.type ? 'is-on' : ''}`}
                    onClick={() => setType(t.type)}
                    aria-pressed={type === t.type}
                  >{t.label}</button>
                ))}
              </div>
              {type === 'finding' && (
                <div class="jrn-sevs" role="group" aria-label="Severity">
                  {SEVERITIES.map((s) => (
                    <button
                      key={s}
                      class={`jrn-sev sev-${s} ${sev === s ? 'is-on' : ''}`}
                      onClick={() => setSev(s)}
                      aria-pressed={sev === s}
                    >{s}</button>
                  ))}
                </div>
              )}
              <div class="jrn-inputrow">
                <input
                  ref={inputRef}
                  class="jrn-input"
                  type="text"
                  value={text}
                  placeholder={hint}
                  aria-label={`New ${TYPE_LABEL[type]}`}
                  onInput={(e) => setText((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                />
                <button class="jrn-log" onClick={submit} disabled={!text.trim()}>log</button>
              </div>
            </div>

            {count === 0 ? (
              <p class="jrn-empty">
                Nothing logged yet. Capture a <b>finding</b>, a <b>cred</b>, a <b>host</b>, or a <b>note</b> as you work · then export the lot as a Markdown report skeleton, ready to flesh out.
              </p>
            ) : (
              <div class="jrn-list">
                {ordered.map((e) => (
                  <div class="jrn-item" key={e.id}>
                    <div class="jrn-item-tags">
                      <span class={`jrn-tag jrn-tag-${e.type}`}>{TYPE_LABEL[e.type]}</span>
                      {e.type === 'finding' && e.sev && <span class={`jrn-sevtag sev-${e.sev}`}>{e.sev}</span>}
                    </div>
                    <span class="jrn-text">{e.text}</span>
                    <button class="jrn-remove" onClick={() => removeEntry(e.id)} aria-label="Delete entry" title="Delete">×</button>
                  </div>
                ))}
              </div>
            )}

            <div class="jrn-foot">
              <button class="jrn-clear" onClick={() => clearJournal()} disabled={count === 0}>clear</button>
              <div class="jrn-actions">
                <button class="jrn-dl" onClick={download} disabled={count === 0}>download .md</button>
                <button class="jrn-done" onClick={copyReport} disabled={count === 0}>{copied ? 'copied' : 'copy report'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
