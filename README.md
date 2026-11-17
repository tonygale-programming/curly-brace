# {Curly Brace} JSON Formatter

Format, validate and repair JSON in your browser. **Private: nothing you paste leaves your device.**

**Open it:** https://tonygale-programming.github.io/curly-brace/

## Why Curly Brace

There are dozens of online JSON formatters. Curly Brace makes three promises:

1. **Safe for secrets.** JSON often contains passwords, tokens and customer data. In November 2025,
   researchers found that two popular formatting sites had exposed more than 80,000 pasted documents
   through their "save and share" links, including cloud keys and bank credentials. Curly Brace has no
   server, no saving and no sharing, and its security policy stops the page from sending data anywhere.
   You can check this yourself (see [Privacy](#privacy)).
2. **Instant.** No ads, no cookie banner, no account. Paste, and the result is already there.
   After the first visit it works offline, and you can install it as an app.
3. **Fixes messy, real-world JSON.** Repairs broken JSON, keeps big numbers exact, catches duplicate
   keys, and explains every error in plain words.

## Features

- **One field**: paste, then **Format** (2 spaces, 4 spaces or tabs), **Minify** or **Stringify** rewrite it in place; `Ctrl/⌘ + Z` goes back
- Pasting into an empty field, or over all of its text, formats it straight away
- Line numbers and coloured JSON in the field itself; the line with an error is marked
- **Stringify**: turn the JSON into one escaped string (`{"a":1}` becomes `"{\"a\":1}"`), ready to paste into code, an environment variable or a request body
- Optional key sorting, in the same order everywhere (by character code, like `jq -S`); turning it off brings the original order back
- Validation with the exact line and column of each error, and a plain explanation
- **Repair**: fixes trailing commas, single quotes, comments, unquoted keys, missing commas, Python-style `True`/`None` and more (undo with `Ctrl/⌘ + Z`)
- **Exact numbers**: large IDs like `12345678901234567890` and values like `129.0` stay exactly as written instead of being rounded
- Catches duplicate keys with conflicting values, which most tools accept silently
- Tree view; click a key to copy its path (for example `$.order.items[0].sku`) or its value
- Open a file (up to 10 MB) or drop it anywhere on the page; **Download** the result as `curly-brace.json` (or the opened file's name), or **Copy** it
- `⌘Z` undoes every change to the field: Format, Minify, Stringify, Repair, Sample and Clear
- Light and dark themes: a first visit follows your system setting; the theme button switches and remembers it
- **Works offline** and can be installed as an app (in Chrome or Edge: the install icon in the address bar)
- Keyboard shortcuts: `⇧⌥F` Format, `⇧⌥M` Minify, `⇧⌥S` Stringify, `⇧⌥R` Repair, `⇧⌥T` Text / Tree, `⌘O` Open, `⌘S` Download, `?` lists them all (`Shift+Alt` and `Ctrl` on Windows and Linux)

## Privacy

Everything happens in your browser. There is no server code, no analytics, no ads and no cookies.

The page enforces this with a **Content Security Policy** (the first `<meta>` tag in `index.html`):

| Rule | What it means |
|---|---|
| `default-src 'none'` | Nothing may load unless a rule below allows it |
| `script-src 'self' 'sha256-…'` | Only this site's own scripts, plus the two inline scripts with exactly these contents |
| `style-src`, `font-src`, `img-src 'self'` | Styles, fonts and images come only from this site |
| `connect-src 'none'` | **The page cannot send network requests at all**: no `fetch`, XHR, WebSocket or beacon |
| `form-action 'none'` | No form can submit data anywhere |

The two libraries and the fonts are served from this site too, so opening Curly Brace contacts no one else.
Your settings (theme, indent, sort keys) are kept in this browser. The JSON in the field is kept
only for the open tab, so it survives a reload but is gone when you close the tab.

**Check it yourself:** open the browser's developer tools, go to the **Network** tab, reload, and use
Curly Brace. Every request goes to this site only, and nothing new is requested while you paste or format.
In the **Console**, `fetch('https://example.com')` is refused by the policy.

## Project structure

```
index.html              page markup and the security policy
styles.css              fonts, theme colours (light and dark), spacing scale and layout
service-worker.js       keeps a copy of every file so Curly Brace works offline
manifest.webmanifest    lets browsers install Curly Brace as an app
js/
  main.js               entry point: the field's state, Format / Minify / Stringify, and the controls
  json-engine.js        parse, format, sort and repair JSON (wraps the two libraries)
  syntax-checker.js     finds the first syntax error and explains it in plain words
  editor.js             the one field: line numbers and coloured JSON under a transparent textarea
  error-card.js         the card that explains an error, at the bottom of the field
  status-bar.js         the Valid / Invalid chip and the figures under the field
  highlighter.js        colours one line of JSON
  tree-view.js          draws the collapsible tree and builds key paths
  tree-panel.js         the tree's controls: selecting a key, Copy path / value, Expand / Collapse
  sort-memory.js        remembers the key order from before sorting, so Sort keys off can restore it
  files.js              reads an opened or dropped file (up to 10 MB)
  notifications.js      toast messages and copying to the clipboard
  storage.js            settings in this browser; the field's text for this tab only
  theme.js              the light / dark theme button
  download.js           saves the JSON as a file, made inside the browser
  keyboard.js           keyboard shortcuts: one list drives the keys, the shortcuts dialog and tooltips
  offline.js            registers the service worker
  html.js               escapes text before it goes into HTML
vendor/                 lossless-json and jsonrepair, copied unchanged from npm
fonts/                  IBM Plex Sans and Mono (Latin), with their license
icons/                  app icons, the link preview image and the Lucide icon license
scripts/
  release.py            prepares and checks a release (see Releasing)
  preview-image.html    source of icons/preview.png
tests/
  unit/                 the JSON engine, syntax checker and highlighter, in plain Node
  browser/              the whole page in Chrome: editing, tree, shortcuts, privacy, offline
.github/workflows/      runs the release check and all tests on every push
```

## Run locally

The app uses JavaScript modules, which browsers only load over HTTP. Serve the folder,
then open http://localhost:8000:

```bash
python3 -m http.server 8000
```

Opening `index.html` directly from disk will show the page without any behaviour.

## Releasing

Before every push that changes the site, add what changed to `CHANGELOG.md`, then run:

```bash
python3 scripts/release.py
```

Why it is needed: GitHub Pages lets browsers reuse files for 10 minutes, and the offline service worker
keeps them until the next release. So every file URL carries a release version (`?v=2026-11-10.1`), and
each release needs a new one. The script:

1. sets a new version (today's date plus a counter) in `index.html` and `service-worker.js`,
2. recalculates the security policy hashes for the inline scripts, because the import map
   contains the version (a wrong hash would stop the page from running),
3. checks the result (the same checks as `--check` below).

It refuses a version older than the live one. `python3 scripts/release.py --check` changes nothing
and stops with a list of problems if the versions disagree, the security policy hashes don't match,
a module in `js/` is missing from the import map or the service worker (or a listed file is missing),
or `CHANGELOG.md` has no entry for the release's date. The GitHub Action runs it on every push.

When you add a module to `js/`, add it to the import map in `index.html` and to `VERSIONED_FILES`
in `service-worker.js`.

## Testing

Unit tests need only Node 20 or later:

```bash
node --test tests/unit/
```

Browser tests drive the Chrome installed on your computer (nothing is downloaded but the small
`playwright-core` package). They start their own local server:

```bash
cd tests/browser && npm install && npm test
```

If Chrome is not in the usual place, set `CHROME_PATH` to the Chrome program.
To redraw the link preview image after changing `scripts/preview-image.html`: `npm run preview-image` in the same folder.

## Code style

The goal is code a person can read without running it.

- **Full names, no abbreviations.** `position`, not `i`; `repairInput`, not `rep`; `.token-string`, not `.t-s`.
  The only exception is a name the whole industry uses, like `id` or `html`.
- **One job per file.** If a module starts doing two things, split it.
- **Small functions that say what they do.** A function name is a verb phrase (`showError`, `getLineAndColumn`).
  If you need a comment to explain *what* a block does, make it a function with that name instead.
- **Comments explain *why*, not *what*.** For example, why the tree builds children lazily, or why
  Repair uses `execCommand`.
- **Named constants instead of magic numbers.** `TYPING_DELAY_MS`, not `180`.
- **Return early** instead of nesting `if` blocks.
- **CSS uses design tokens.** Every colour is a `--variable` in the Theme section at the top of `styles.css`,
  written once as `light-dark(<light>, <dark>)`, so both themes change in one place. One declaration per line.
- **Spacing follows a 4px scale.** Gaps, paddings and margins use only the `--space-*` tokens
  (2, 4, 8, 12, 16, 20, 24, 32px). Other sizes, such as heights, widths and radii, are multiples of 4px.
  Buttons, dropdowns and switches all share `--control-height` (32px), so rows line up.
  The only exceptions are 1px borders and font sizes.
- **Nothing from other sites.** Every file the page needs lives in this repository, so the privacy
  promise holds. The security policy enforces this.
- **No build step.** Anything added must still run when the folder is served as plain files.

Formatting rules for editors are in `.editorconfig`.

## Tech

Plain HTML, CSS and JavaScript with no build step and no server. Two small libraries, copied into
`vendor/` unchanged and checked with integrity hashes:

| Library | Version | Used for |
|---|---|---|
| [lossless-json](https://github.com/josdejong/lossless-json) | 4.3.3 | Parsing and formatting without rounding numbers; duplicate key detection |
| [jsonrepair](https://github.com/josdejong/jsonrepair) | 3.15.0 | The Repair button |

If a library fails to load, the page still works: it falls back to the browser's built-in JSON and hides Repair.

Fonts: [IBM Plex](https://github.com/IBM/plex) Sans and Mono, under the SIL Open Font License (`fonts/OFL.txt`).

Icons: [Lucide](https://lucide.dev) 1.64.0, under the ISC license (`icons/LUCIDE-LICENSE.txt`), inlined in `index.html`.
Each icon has a `data-lucide` attribute with its name, so it can be swapped by copying another one from lucide.dev.

Design: Tony's [design system](https://claude.ai/artifact/G2fKVhvYDpQxE6Rzz2rTHh) sets the colours, shapes and layout.

Works in current Chrome, Edge, Firefox and Safari. The colour themes use CSS `light-dark()`, which needs
browsers from 2024 or later (Chrome 123, Firefox 120, Safari 17.5).

## History and roadmap

What changed and when: see [CHANGELOG.md](CHANGELOG.md). Planned improvements, ideas, and the ideas we decided against: see [ROADMAP.md](ROADMAP.md).

## License

[MIT](LICENSE)
