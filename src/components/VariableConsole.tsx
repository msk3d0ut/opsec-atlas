/**
 * VariableConsole — set engagement variables once (your IP, target, domain,
 * creds). Every command on the site then fills in your real values and copies
 * ready to run. Client-side only (localStorage), no accounts. The killer
 * never-leave / pure-speed feature.
 */
import { useEffect, useState } from 'preact/hooks';
import { VAR_FIELDS, getVars, setVars, getEnabled, setEnabled, onVarsChange } from '../lib/vars.ts';

export default function VariableConsole() {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [enabled, setEn] = useState(true);

  useEffect(() => {
    const sync = () => { setVals(getVars()); setEn(getEnabled()); };
    sync();
    return onVarsChange(sync);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open && e.key === 'Escape') setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === ';') { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const setField = (key: string, v: string) => {
    const next = { ...getVars(), [key]: v };
    if (!v) delete next[key];
    setVars(next); // emits -> sync updates vals here and every CommandRow
  };
  const clearAll = () => setVars({});
  const count = VAR_FIELDS.filter((f) => vals[f.key]).length;

  return (
    <>
      <button class={`vars-trigger ${count > 0 && enabled ? 'is-active' : ''}`} onClick={() => setOpen(true)} aria-label="Engagement variables">
        <span class="vars-ico" aria-hidden="true">$_</span>
        <span class="vars-word">vars</span>
        {count > 0 && <span class="vars-badge">{count}</span>}
      </button>

      {open && (
        <div class="vars-overlay">
          <div class="vars-panel">
            <div class="vars-head">
              <span class="label">engagement variables</span>
              <button class="hud-close" onClick={() => setOpen(false)} aria-label="Close" title="Close (Esc)">×</button>
            </div>
            <p class="vars-note">Set once. Every command fills in your values and copies ready to run. Stays on this device.</p>
            <div class="vars-grid">
              {VAR_FIELDS.map((f) => (
                <label class="vars-field" title={f.desc}>
                  <span class="vars-flabel">{f.label}</span>
                  <input
                    class="vars-input"
                    value={vals[f.key] || ''}
                    placeholder={f.hint}
                    title={f.desc}
                    aria-label={`${f.label}. ${f.desc}`}
                    spellcheck={false}
                    autocomplete="off"
                    onInput={(e) => setField(f.key, (e.target as HTMLInputElement).value)}
                  />
                </label>
              ))}
            </div>
            <div class="vars-foot">
              <label class="vars-toggle" title="Toggle whether commands show your values or the raw placeholders">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled((e.target as HTMLInputElement).checked)} />
                <span>fill commands</span>
              </label>
              <div class="vars-actions">
                <button class="vars-clear" onClick={clearAll}>clear all</button>
                <button class="vars-done" onClick={() => setOpen(false)}>done</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
