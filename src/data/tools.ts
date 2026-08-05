/**
 * OpsecAtlas V3 — the curated Tools hub.
 *
 * Not a dump of everything on GitHub. The tools an operator actually reaches for
 * in 2025: the modern ProjectDiscovery chain, the CrackMapExec successor, the new
 * C2s, the AD-CS toolkit, and the reporting stack that turns a shell into a
 * deliverable. Each entry says what it is and WHEN you reach for it — the same
 * "one continuous flow" as the rest of the atlas. Curated, current, no filler.
 */

export interface Tool {
  name: string;
  url: string;
  what: string; // one line: what it is
  when: string; // when you reach for it
  tag?: string; // short modifier (e.g. "modern", "reference")
}

export interface ToolCategory {
  id: string;
  title: string;
  short: string; // 2-4 word chip label
  blurb: string;
  tools: Tool[];
}

export const TOOLS: ToolCategory[] = [
  {
    id: 'recon-osint',
    title: 'Recon & OSINT',
    short: 'recon',
    blurb: 'Map the attack surface before you touch it: subdomains, live hosts, exposed services, and what the internet already knows.',
    tools: [
      { name: 'Amass', url: 'https://github.com/owasp-amass/amass', what: 'In-depth attack-surface mapping and subdomain enumeration.', when: 'Scoping a domain: the widest passive + active subdomain net you can cast.', tag: 'OWASP' },
      { name: 'Subfinder', url: 'https://github.com/projectdiscovery/subfinder', what: 'Fast passive subdomain discovery from dozens of sources.', when: 'The first command on any external engagement, piped into httpx.' },
      { name: 'httpx', url: 'https://github.com/projectdiscovery/httpx', what: 'Fast, multi-purpose HTTP prober and fingerprinter.', when: 'Turn a list of hosts into live web servers with titles, tech, and status.' },
      { name: 'naabu', url: 'https://github.com/projectdiscovery/naabu', what: 'Fast SYN/CONNECT port scanner in Go.', when: 'A quick port sweep across many hosts before a full nmap on the hits.' },
      { name: 'theHarvester', url: 'https://github.com/laramies/theHarvester', what: 'Emails, names, subdomains, and hosts from public sources.', when: 'Building a user list and footprint for phishing or password spraying.' },
      { name: 'waybackurls', url: 'https://github.com/tomnomnom/waybackurls', what: 'Pull every URL a domain has served, straight from the Wayback Machine.', when: 'Surfacing forgotten endpoints, parameters, and old paths before you fuzz.' },
      { name: 'Shodan', url: 'https://www.shodan.io', what: 'Search engine for internet-exposed devices and services.', when: 'Find exposed panels, versions, and known-vulnerable services before scanning.', tag: 'service' },
    ],
  },
  {
    id: 'web-api',
    title: 'Web & API',
    short: 'web',
    blurb: 'Discover content and parameters, crawl the app, and template the checks so nothing hides in a forgotten endpoint.',
    tools: [
      { name: 'ffuf', url: 'https://github.com/ffuf/ffuf', what: 'Fast web fuzzer for content, vhosts, and parameters.', when: 'Directory and parameter discovery: the operator default for fuzzing.' },
      { name: 'feroxbuster', url: 'https://github.com/epi052/feroxbuster', what: 'Fast, recursive content discovery in Rust.', when: 'Deep-crawling a site where directories nest and ffuf gets tedious.' },
      { name: 'Katana', url: 'https://github.com/projectdiscovery/katana', what: 'Next-generation crawling and spidering framework.', when: 'Mapping every endpoint and JS-defined route before you attack.' },
      { name: 'Nuclei', url: 'https://github.com/projectdiscovery/nuclei', what: 'Template-driven vulnerability scanner with a huge community library.', when: 'Sweeping for known CVEs, misconfigs, and exposures at scale, safely.' },
      { name: 'Arjun', url: 'https://github.com/s0md3v/Arjun', what: 'HTTP parameter discovery suite.', when: 'Finding hidden parameters that unlock injection or IDOR.' },
      { name: 'Caido', url: 'https://caido.io', what: 'A modern, lightweight web proxy · a Burp alternative.', when: 'Manual testing when you want speed and a clean workflow.', tag: 'modern' },
      { name: 'WPScan', url: 'https://github.com/wpscanteam/wpscan', what: 'WordPress security scanner: core, plugins, themes, and users.', when: 'The target runs WordPress: enumerate versions and known-vulnerable plugins.' },
    ],
  },
  {
    id: 'active-directory',
    title: 'Active Directory',
    short: 'ad',
    blurb: 'The internal engagement runs on these: enumerate the domain, map the paths, and abuse Kerberos and AD CS.',
    tools: [
      { name: 'NetExec (nxc)', url: 'https://github.com/Pennyw0rth/NetExec', what: 'The maintained successor to CrackMapExec · swiss-army for AD/network protocols.', when: 'Auth checks, share hunting, spraying, and command exec across the domain.', tag: 'modern' },
      { name: 'BloodHound CE', url: 'https://github.com/SpecterOps/BloodHound', what: 'Graphs Active Directory attack paths with Cypher.', when: 'Every AD engagement: find the shortest path from owned to Domain Admin.' },
      { name: 'Impacket', url: 'https://github.com/fortra/impacket', what: 'Python classes for network protocols · secretsdump, GetUserSPNs, psexec, and more.', when: 'The backbone of AD attacks from Linux: roasting, relaying, dumping, executing.' },
      { name: 'Certipy', url: 'https://github.com/ly4k/Certipy', what: 'Enumerate and abuse Active Directory Certificate Services.', when: 'AD CS is present: find and exploit ESC1-ESC16 for privilege escalation.' },
      { name: 'Rubeus', url: 'https://github.com/GhostPack/Rubeus', what: 'Kerberos abuse toolkit for Windows.', when: 'On a Windows foothold: roasting, ticket requests, S4U, and pass-the-ticket.' },
      { name: 'Coercer', url: 'https://github.com/p0dalirius/Coercer', what: 'Coerce a Windows host to authenticate via many methods.', when: 'Setting up NTLM relay or PetitPotam-style coercion to a DC.' },
    ],
  },
  {
    id: 'exploitation-c2',
    title: 'Exploitation & C2',
    short: 'exploit + c2',
    blurb: 'Land the shell, then hold it. The exploitation framework plus the modern open-source command-and-control operators actually run.',
    tools: [
      { name: 'Metasploit', url: 'https://github.com/rapid7/metasploit-framework', what: 'The exploitation framework: modules, payloads, and handlers.', when: 'A known exploit exists, or you need a quick multi/handler and msfvenom.' },
      { name: 'Sliver', url: 'https://github.com/BishopFox/sliver', what: 'Modern, open-source, cross-platform C2 framework in Go.', when: 'A real engagement needs resilient, extensible C2 without a Cobalt license.', tag: 'modern' },
      { name: 'Havoc', url: 'https://github.com/HavocFramework/Havoc', what: 'Modern, malleable post-exploitation C2 framework.', when: 'You want a capable, evasive teamserver and a demon agent, free.', tag: 'modern' },
      { name: 'Villain', url: 'https://github.com/t3l3machus/Villain', what: 'Reverse-shell and C2 handler that shares sessions between operators.', when: 'Fast, lightweight C2 for a small engagement or a CTF.' },
      { name: 'pwncat-cs', url: 'https://github.com/calebstewart/pwncat', what: 'Post-exploitation platform that supercharges a raw reverse shell.', when: 'You caught a shell and want auto-stabilization, persistence, and enum.' },
    ],
  },
  {
    id: 'privesc-postex',
    title: 'PrivEsc & Post-Exploitation',
    short: 'privesc',
    blurb: 'Enumerate the box, find the misconfiguration, and take the creds. The scripts and references that run on every foothold.',
    tools: [
      { name: 'PEASS-ng', url: 'https://github.com/peass-ng/PEASS-ng', what: 'winPEAS and linPEAS · the definitive privesc enumeration scripts.', when: 'First thing on any foothold: automate the whole privesc checklist.' },
      { name: 'pspy', url: 'https://github.com/DominicBreuker/pspy', what: 'Watch Linux processes and cron without root.', when: 'Hunting for a root-run cron or script you can hijack.' },
      { name: 'GTFOBins', url: 'https://gtfobins.github.io', what: 'How to break out of a binary via sudo, SUID, or capabilities.', when: 'sudo -l or a SUID list in hand: look up each binary here.', tag: 'reference' },
      { name: 'LOLBAS', url: 'https://lolbas-project.github.io', what: 'Windows living-off-the-land binaries and scripts.', when: 'Execution, download, or bypass on Windows without dropping tools.', tag: 'reference' },
      { name: 'Mimikatz', url: 'https://github.com/gentilkiwi/mimikatz', what: 'Extract plaintext creds, hashes, tickets, and keys from Windows memory.', when: 'Local admin or SYSTEM on Windows: harvest everything in LSASS.' },
      { name: 'SharpCollection', url: 'https://github.com/Flangvik/SharpCollection', what: 'Nightly-built, ready-to-run offensive .NET binaries.', when: 'You need Rubeus, Certify, SharpHound, or Seatbelt compiled and current.' },
    ],
  },
  {
    id: 'tunneling-pivoting',
    title: 'Tunneling & Pivoting',
    short: 'pivot',
    blurb: 'Reach the next network. Modern tunnels that beat the old plink/socat dance and route your whole toolkit inward.',
    tools: [
      { name: 'Ligolo-ng', url: 'https://github.com/nicocha30/ligolo-ng', what: 'Tunneling via a TUN interface · no SOCKS, no proxychains.', when: 'Pivoting into an internal subnet: the current operator default.', tag: 'modern' },
      { name: 'Chisel', url: 'https://github.com/jpillora/chisel', what: 'Fast TCP/UDP tunnel over HTTP, secured with SSH.', when: 'Port-forwarding or a SOCKS proxy through a single foothold.' },
      { name: 'sshuttle', url: 'https://github.com/sshuttle/sshuttle', what: 'Transparent proxy that routes traffic over an SSH connection.', when: 'You have SSH to a pivot and want a poor-man VPN into its network.' },
      { name: 'proxychains-ng', url: 'https://github.com/rofl0r/proxychains-ng', what: 'Force any TCP tool through a chain of proxies.', when: 'Running nmap, impacket, or a browser through your SOCKS pivot.' },
    ],
  },
  {
    id: 'passwords-cracking',
    title: 'Passwords & Cracking',
    short: 'cracking',
    blurb: 'Identify the hash, feed it the right wordlist, and spray what you already know. The offline half of credential access.',
    tools: [
      { name: 'Hashcat', url: 'https://github.com/hashcat/hashcat', what: 'GPU-accelerated password recovery for hundreds of hash types.', when: 'You captured a crackable hash and have the horsepower.' },
      { name: 'John the Ripper', url: 'https://github.com/openwall/john', what: 'Password cracker with the huge *2john format-conversion toolkit.', when: 'Cracking odd formats (zip, keepass, kerberos) or when GPU is unavailable.' },
      { name: 'name-that-hash', url: 'https://github.com/HashPals/Name-That-Hash', what: 'Identify a hash type from its shape, with hashcat/john modes.', when: 'You have a hash and need to know what mode to crack it with.' },
      { name: 'Kerbrute', url: 'https://github.com/ropnop/kerbrute', what: 'Fast Kerberos pre-auth username enumeration and password spraying.', when: 'A user list against a DC: validate names and spray without lockout noise.' },
      { name: 'SecLists', url: 'https://github.com/danielmiessler/SecLists', what: 'The collection of wordlists for every stage of an assessment.', when: 'Any fuzzing, cracking, or spraying: start from the right list here.', tag: 'reference' },
    ],
  },
  {
    id: 'reporting-ops',
    title: 'Reporting & Engagement Ops',
    short: 'reporting',
    blurb: 'The half that pays: turn findings into a deliverable, and start every engagement with scope and authorization in writing.',
    tools: [
      { name: 'SysReptor', url: 'https://github.com/Syslifters/sysreptor', what: 'Customizable, open-source pentest reporting platform.', when: 'Writing the report without fighting Word: templated, versioned, exportable.', tag: 'modern' },
      { name: 'Ghostwriter', url: 'https://github.com/GhostManager/Ghostwriter', what: 'Red-team engagement management and reporting (SpecterOps).', when: 'Tracking findings, infrastructure, and the report across a team.' },
      { name: 'PwnDoc', url: 'https://github.com/pwndoc/pwndoc', what: 'Pentest report generator with a reusable vulnerability database.', when: 'You want a shared finding library that fills the report for you.' },
      { name: 'Obsidian', url: 'https://obsidian.md', what: 'Local-first, linked markdown notes.', when: 'Live engagement notes, host tracking, and command logs that link together.', tag: 'notes' },
      { name: 'Rules of Engagement & authorization', url: 'https://github.com/juliocesarfort/public-pentesting-reports', what: 'Reference reports and templates for scope, RoE, and authorization letters.', when: 'Before you touch anything: get scope and written permission on file.', tag: 'reference' },
    ],
  },
  {
    id: 'ai-assisted',
    title: 'AI-Assisted',
    short: 'AI',
    blurb: 'The newest lane, and no substitute for judgment: agents that test and prove, an LLM co-pilot that reasons through the engagement with you, and models that read source for the bugs a skim would miss. Fast leverage · verify everything they surface.',
    tools: [
      { name: 'Strix', url: 'https://github.com/usestrix/strix', what: 'Open-source AI agents that autonomously test an app, then prove findings by exploiting them in a sandbox.', when: 'You want an autonomous first pass that surfaces and validates real bugs, not just noise.', tag: 'agents' },
      { name: 'PentestGPT', url: 'https://github.com/GreyDGL/PentestGPT', what: 'An LLM co-pilot that guides a penetration test step by step, tracking state and suggesting the next move.', when: 'You want a reasoning partner to structure the engagement and unstick you, not run it for you.', tag: 'co-pilot' },
      { name: 'Vulnhuntr', url: 'https://github.com/protectai/vulnhuntr', what: 'LLM-driven static analysis that traces user input to dangerous sinks and finds multi-step vulnerabilities in source.', when: 'You have the source: hunt injection, SSRF, and IDOR chains a linter would skip.', tag: 'code' },
    ],
  },
];
