/**
 * OpsecAtlas V3 — the curated Wordlists library.
 *
 * The other half of every fuzz, crack, and spray: the list. Not a catalogue of
 * every file in SecLists · the ones operators actually reach for, with the exact
 * path they live at on Kali and the moment you reach for each. Grab the path,
 * point your tool at it, move. Paths assume a standard Kali install (SecLists at
 * /usr/share/seclists, symlinked under /usr/share/wordlists/seclists).
 */

export interface Wordlist {
  name: string;
  path: string; // where it lives on Kali (the grab-and-go value)
  what: string; // one line: what it is
  when: string; // when you reach for it
  url?: string; // upstream source, when it is not shipped by default
  tag?: string; // short modifier (e.g. "huge", "external")
}

export interface WordlistCategory {
  id: string;
  title: string;
  short: string; // 2-4 word chip label
  blurb: string;
  lists: Wordlist[];
}

export const WORDLISTS: WordlistCategory[] = [
  {
    id: 'passwords',
    title: 'Passwords & Cracking',
    short: 'passwords',
    blurb: 'Offline cracking and online spraying. rockyou for a first pass, the big leaked sets when it holds out, rules to stretch a small list into a large one.',
    lists: [
      { name: 'rockyou.txt', path: '/usr/share/wordlists/rockyou.txt', what: '14M real leaked passwords · the universal first pass.', when: 'Cracking any hash or NetNTLM capture · always start here. Kali ships it gzipped: gunzip it once.', tag: 'default' },
      { name: '10-million top 1M', path: '/usr/share/seclists/Passwords/Common-Credentials/10-million-password-list-top-1000000.txt', what: 'The million most common passwords, frequency-ranked.', when: 'A larger, cleaner pass when rockyou comes up empty · or a fast top-N spray.' },
      { name: 'darkweb2017 top 10k', path: '/usr/share/seclists/Passwords/darkweb2017-top10000.txt', what: 'The 10k most common passwords from the 2017 dark-web dumps.', when: 'Password spraying AD: small enough to stay under lockout, strong hit rate.', tag: 'spraying' },
      { name: 'Default credentials', path: '/usr/share/seclists/Passwords/Default-Credentials/default-passwords.csv', what: 'Vendor default user:pass pairs by product.', when: 'A login panel, router, DB, or appliance that may never have been changed.' },
      { name: 'best64.rule', path: '/usr/share/hashcat/rules/best64.rule', what: 'The 64 highest-yield mangling rules for hashcat.', when: 'Squeezing more out of any list: hashcat -r best64.rule before going bigger.', tag: 'rules' },
      { name: 'OneRuleToRuleThemAll', path: '~/OneRuleToRuleThemAll.rule', what: 'A single heavy rule set that folds in the best public rules.', when: 'One serious GPU pass on a stubborn hash before you escalate to a bigger list.', url: 'https://github.com/NotSoSecure/password_cracking_rules', tag: 'external' },
    ],
  },
  {
    id: 'web-content',
    title: 'Web Content · Dirs & Files',
    short: 'dirs',
    blurb: 'Directory and file discovery. raft lists are drawn from real responses (better signal than brute); directory-list-2.3 goes deep when raft runs dry.',
    lists: [
      { name: 'raft-large-directories', path: '/usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt', what: 'Directories seen in real-world responses, frequency-ordered.', when: 'The default first ffuf/feroxbuster directory pass · high signal, low noise.', tag: 'default' },
      { name: 'directory-list-2.3-medium', path: '/usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt', what: 'The classic deep dirbuster list, ~220k entries.', when: 'raft came up short and you want depth · expect longer runs.' },
      { name: 'common.txt', path: '/usr/share/seclists/Discovery/Web-Content/common.txt', what: 'A tight ~4.7k list of the usual web paths.', when: 'A fast first look when time is short or the target is slow.' },
      { name: 'raft-large-files', path: '/usr/share/seclists/Discovery/Web-Content/raft-large-files.txt', what: 'Real filenames · pair with -e to append extensions.', when: 'Hunting backups, configs, and leftovers: .bak, .old, .zip, .config.' },
      { name: 'API endpoints', path: '/usr/share/seclists/Discovery/Web-Content/api/api-endpoints.txt', what: 'Common REST/API route fragments.', when: 'The target is an API or SPA backend · fuzz /api/, /v1/, and friends.', tag: 'api' },
    ],
  },
  {
    id: 'subdomains',
    title: 'Subdomains & DNS',
    short: 'subdomains',
    blurb: 'DNS brute-forcing to complement passive discovery. Start small and fast, widen only if the target warrants it.',
    lists: [
      { name: 'subdomains-top1million-5000', path: '/usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt', what: 'The 5k most common subdomain labels.', when: 'A quick DNS brute (ffuf/puredns) alongside subfinder · fast and usually enough.', tag: 'fast' },
      { name: 'subdomains-top1million-110000', path: '/usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt', what: 'The 110k-label extended set.', when: 'A wide, in-scope target where 5k missed something worth the extra time.' },
      { name: 'n0kovo_subdomains_huge', path: '~/n0kovo_subdomains_huge.txt', what: '~3M labels mined from mass internet scans.', when: 'Bug-bounty breadth on a resolver you control · pair with puredns + a resolver list.', url: 'https://github.com/n0kovo/n0kovo_subdomains', tag: 'huge' },
    ],
  },
  {
    id: 'usernames',
    title: 'Usernames',
    short: 'usernames',
    blurb: 'Build the account list before you spray or roast. Short lists for a first look, name-derived lists when you know the naming scheme.',
    lists: [
      { name: 'top-usernames-shortlist', path: '/usr/share/seclists/Usernames/top-usernames-shortlist.txt', what: 'The ~17 most common service/account names.', when: 'A fast first guess at admin, root, svc, and the usual suspects.', tag: 'fast' },
      { name: 'xato-net 10M usernames', path: '/usr/share/seclists/Usernames/xato-net-10-million-usernames.txt', what: 'The most common usernames from real breaches.', when: 'Broad username enumeration on a login or SMTP VRFY endpoint.' },
      { name: 'Names (first/last)', path: '/usr/share/seclists/Usernames/Names/names.txt', what: 'Human first and last names.', when: 'Feed a username generator (e.g. namemash) to build j.doe / jdoe / doej lists for AD.' },
    ],
  },
  {
    id: 'fuzzing',
    title: 'Fuzzing & Injection',
    short: 'fuzzing',
    blurb: 'Payload lists for the injection classes. Point them at a discovered parameter to probe LFI, XSS, SQLi, and the edges special characters expose.',
    lists: [
      { name: 'burp-parameter-names', path: '/usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt', what: '~2.5k common parameter names.', when: 'Hidden-parameter discovery with ffuf or Arjun before you fuzz values.' },
      { name: 'LFI-Jhaddix', path: '/usr/share/seclists/Fuzzing/LFI/LFI-Jhaddix.txt', what: 'Path-traversal and local-file-inclusion payloads.', when: 'A parameter that loads a file · sweep for traversal and wrappers.' },
      { name: 'XSS payloads', path: '/usr/share/seclists/Fuzzing/XSS/XSS-Jhaddix.txt', what: 'Reflected/stored XSS probe strings.', when: 'A reflected input · fuzz for a context that fires, then hand-craft.' },
      { name: 'Quick-SQLi', path: '/usr/share/seclists/Fuzzing/SQLi/Generic-SQLi.txt', what: 'Generic SQL-injection probe strings.', when: 'A first manual poke before reaching for sqlmap.' },
      { name: 'special-chars', path: '/usr/share/seclists/Fuzzing/special-chars.txt', what: 'Single special characters, one per line.', when: 'Mapping how an input handles quotes, brackets, and metacharacters.' },
    ],
  },
  {
    id: 'services',
    title: 'Services & Defaults',
    short: 'services',
    blurb: 'The non-web lists: SNMP community strings, default appliance creds, and the small sets that open a service without touching a browser.',
    lists: [
      { name: 'SNMP community strings', path: '/usr/share/seclists/Discovery/SNMP/snmp.txt', what: 'Common SNMP community strings.', when: 'UDP 161 is open · brute the community string with onesixtyone or snmpwalk.' },
      { name: 'Default passwords (by vendor)', path: '/usr/share/seclists/Passwords/Default-Credentials/', what: 'Per-product default-credential lists.', when: 'A named appliance or device · try the vendor set before brute-forcing.' },
      { name: 'ftp-betterdefaultpasslist', path: '/usr/share/seclists/Passwords/Default-Credentials/ftp-betterdefaultpasslist.txt', what: 'Common FTP default user:pass pairs.', when: 'FTP is open and anonymous is off · a quick default-cred pass.' },
    ],
  },
];
