---
id: "NN"                         # unique, stable, immutable (never reuse or renumber)
title: "Your Technique Domain"   # display title
tags: ["all"]                    # one or more of: linux windows active-directory web network all
# noEntry: true                  # optional: contributes sections but no standalone entry page
---

# Domain Overview

> **Description:** One line on what this covers.
> **Best For:** When an operator reaches for it.
> **Strength:** What makes this reference complete.

---

## First Technique

Short prose explaining what this is and, in a sentence, the exploit path or why it matters.

```bash
# A comment line becomes a caption, kept OUTSIDE the copy target
nmap -sC -sV <TARGET-IP>
crackmapexec smb <TARGET-IP> -u <USER> -p <PASS>
```

Use the shared placeholders so the Variable Console fills real values site-wide:
`<TARGET-IP>` `<DOMAIN>` `<USER>` `<PASS>` `<DC-IP>` `<LHOST>` `<LPORT>` `<RANGE>` `<HASH>`.

### A Sub-section

`### H3` and `#### H4` compose INTO the technique above (same page): they never create thin standalone pages. Put related steps, variants, or tables here.

| Tool | When |
|---|---|
| example | why you reach for it |

---

## Second Technique

Each `## H2` is its own technique page. One command per fenced line = one copyable command. Commands are byte-exact, never reformatted.
