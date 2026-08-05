# Contributing to OpsecAtlas

OpsecAtlas is a **docs-as-code** offensive-security knowledge base: the entire reference is authored as plain Markdown in this repo and compiled into the live app at build time. Adding or fixing a technique is a **single Markdown pull request** — no build artifacts, no data structures to hand-edit. If you can write a fenced code block, you can contribute.

> **Command fidelity is the #1 rule.** Commands are copied and run verbatim by operators mid-engagement. We never rewrite, sanitize, or reformat a command. What you put in a fenced code block is byte-for-byte what a user copies.

---

## The two kinds of content

| Content | Lives in | Format |
|---|---|---|
| **Techniques / methodology** (prose + commands) | `src/content/atlas/*.md` | Markdown + YAML frontmatter |
| **Reference libraries** (command lists, CVEs, payloads, tools, wordlists — pure data) | `src/data/*.ts` | Typed TypeScript records |

Most contributions are **techniques** — that's this guide. Prose belongs in Markdown; tabular data belongs in the typed library files.

Everything is compiled to a generated corpus at build time (`src/generated/`, git-ignored). **You never edit generated files** — you edit the Markdown source, the build does the rest.

---

## Add or edit a technique

1. Create or edit a file in **`src/content/atlas/`** (start from [`.github/TECHNIQUE_TEMPLATE.md`](.github/TECHNIQUE_TEMPLATE.md)). One domain per file; filenames are lowercase-kebab and become part of the URL — never renumber or add numeric prefixes.
2. Give it **YAML frontmatter**:
   ```yaml
   ---
   id: "08"                       # stable, unique, immutable (never reused/renumbered)
   title: "Cloud Exploitation"    # the display title
   tags: ["all"]                  # one or more of: linux windows active-directory web network all
   # noEntry: true                # optional — contributes sections but no standalone entry page
   ---
   ```
3. Write the body in Markdown:
   - An **`## H2` heading is one technique** (its own page). `### H3`/`#### H4` compose *into* it as sub-sections — they never create thin standalone pages.
   - **Commands go in fenced code blocks** with a language (` ```bash `, ` ```powershell `, ` ```sql `…). **One command per line** — each becomes individually copyable. A line starting with `#` is a caption/comment, kept *outside* the copy target.
   - Use the shared **placeholders** where a value is engagement-specific: `<TARGET-IP>`, `<DOMAIN>`, `<USER>`, `<PASS>`, `<DC-IP>`, `<LHOST>`, `<LPORT>`, etc. The Variable Console fills them in site-wide, so authors write placeholders, never real values.
   - Prose, tables, and lists are normal GitHub-Flavored Markdown.

That's it. The pipeline atomizes your commands, builds the search index, and renders the page.

---

## Rules that keep the reference trustworthy

- **Never reformat commands.** No smart quotes, no tab/space "cleanup", no reflowing. The literal, lands-on-the-exact-line search depends on exact bytes and line numbers — content Markdown is **never auto-formatted** (a `.prettierignore` + `.gitattributes` enforce this; please don't run a formatter over `src/content/`).
- **LF line endings** (handled automatically by `.gitattributes`).
- **Real, tested commands only.** Do **not** commit real client/engagement data, live credentials or keys, or active C2 infrastructure. Generic, educational, authorized-testing material only.
- **Plain CommonMark + GFM** in technique bodies — no MDX, no embedded components.

---

## Local development

```bash
npm install
npm run dev        # pipeline + Astro dev server
npm run build      # production build (pipeline -> corpus -> static site)
npm test           # pipeline tests (parsing, byte-exact fidelity, link safety)
```

Before opening a PR: `npm test` passes and `npm run build` is clean.

---

## Pull requests

Fork → branch → PR against `main`. Keep PRs focused (one technique or one fix). CI validates frontmatter, unique ids, byte-exact command fidelity, and the build. A maintainer reviews the Markdown diff — which, because it's plain Markdown, reads exactly like the change it makes.

## License

By contributing you agree your work is licensed under the project's terms: **code under MIT**, **content (techniques/methodology/commands) under CC-BY-SA-4.0**. You keep authorship credit; the knowledge stays free and open.

Thank you for making the atlas sharper. Every exact command helps someone in the field.
