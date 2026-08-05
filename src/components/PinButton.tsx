/**
 * PinButton — pin a command into the Loadout from any command row across the
 * site. Toggles the item; reflects whether it is already in the loadout. The
 * source is taken from the page title so the exported runbook carries context.
 */
import { useEffect, useState } from 'preact/hooks';
import { toggleLoadout, loadoutHas, onLoadoutChange } from '../lib/loadout.ts';

function pageSource(): string {
  const t = (typeof document !== 'undefined' ? document.title : '') || '';
  // Titles are "<page> · OpsecAtlas"; keep the page name as the runbook source.
  return t.replace(/\s*[·—–-]\s*OpsecAtlas.*$/i, '').trim() || 'OpsecAtlas';
}

export default function PinButton({ cmd, desc = '' }: { cmd: string; desc?: string }) {
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const sync = () => setPinned(loadoutHas(cmd, desc));
    sync();
    return onLoadoutChange(sync);
  }, [cmd, desc]);
  const toggle = () => toggleLoadout({ cmd, desc, source: pageSource() });
  return (
    <button
      class={`cmd-pin ${pinned ? 'is-pinned' : ''}`}
      onClick={toggle}
      aria-label={pinned ? 'Remove from loadout' : 'Add to loadout'}
      title={pinned ? 'In your loadout - click to remove' : 'Pin to your loadout'}
    >
      {pinned ? '✓' : '+'}
    </button>
  );
}
