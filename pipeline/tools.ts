/**
 * OpsecAtlas V3 — the curated tool vocabulary + detection.
 *
 * Tools (impacket, crackmapexec, mimikatz, ...) are first-class entities: every
 * technique that uses one cross-references it. `detectTools` scans a technique's
 * raw command text and returns the tools it invokes, in first-seen order.
 *
 * Detection is by curated pattern, not a blanket word list, so `impacket`
 * matches the `impacket-` tool family and `crackmapexec`/`cme`/`netexec` map to
 * the same lineage without false positives on ordinary prose.
 */

export interface Tool { id: string; label: string; patterns: RegExp[] }

export const TOOLS: Tool[] = [
  { id: 'impacket', label: 'Impacket', patterns: [/impacket[-\s]/i, /\bimpacket\b/i, /\bsecretsdump\b/i, /getuserspns/i, /getnpusers/i, /\bgettgt\b/i, /\bticketer\b/i] },
  { id: 'crackmapexec', label: 'CrackMapExec', patterns: [/crackmapexec/i, /\bcme\b/i, /\bnetexec\b/i, /\bnxc\b/i] },
  { id: 'bloodhound', label: 'BloodHound', patterns: [/bloodhound/i] },
  { id: 'sharphound', label: 'SharpHound', patterns: [/sharphound/i, /invoke-bloodhound/i] },
  { id: 'mimikatz', label: 'Mimikatz', patterns: [/mimikatz/i, /sekurlsa::/i, /lsadump::/i, /kerberos::/i] },
  { id: 'hashcat', label: 'hashcat', patterns: [/\bhashcat\b/i] },
  { id: 'john', label: 'John the Ripper', patterns: [/\bjohn\b\s+--/i, /\bjohn the ripper\b/i] },
  { id: 'evil-winrm', label: 'evil-winrm', patterns: [/evil-winrm/i] },
  { id: 'kerbrute', label: 'Kerbrute', patterns: [/kerbrute/i] },
  { id: 'nmap', label: 'Nmap', patterns: [/\bnmap\b/i] },
  { id: 'ldapsearch', label: 'ldapsearch', patterns: [/ldapsearch/i] },
  { id: 'enum4linux', label: 'enum4linux-ng', patterns: [/enum4linux/i] },
  { id: 'rpcclient', label: 'rpcclient', patterns: [/rpcclient/i] },
  { id: 'powerview', label: 'PowerView', patterns: [/powerview/i, /get-domain/i, /set-domainobject/i, /add-domain/i] },
  { id: 'ffuf', label: 'ffuf', patterns: [/\bffuf\b/i] },
  { id: 'gobuster', label: 'gobuster', patterns: [/gobuster/i] },
  { id: 'sqlmap', label: 'sqlmap', patterns: [/sqlmap/i] },
  { id: 'metasploit', label: 'Metasploit', patterns: [/msfconsole/i, /metasploit/i, /meterpreter/i, /multi\/handler/i] },
];

/** Return the curated tools mentioned in the given text, in first-seen order. */
export function detectTools(text: string): string[] {
  const positions: { id: string; at: number }[] = [];
  for (const tool of TOOLS) {
    let earliest = Infinity;
    for (const p of tool.patterns) {
      const m = p.exec(text);
      if (m && m.index < earliest) earliest = m.index;
    }
    if (earliest !== Infinity) positions.push({ id: tool.id, at: earliest });
  }
  return positions.sort((a, b) => a.at - b.at).map((p) => p.id);
}

export const TOOL_BY_ID: Record<string, Tool> = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
