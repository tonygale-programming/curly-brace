# Curly Brace JSON Formatter: notes for Claude

## What this is

A JSON formatter, validator and repair tool that runs entirely in the browser.
Plain HTML, CSS and JavaScript modules, no build step, no server.

- Live site: https://tonygale-programming.github.io/curly-brace/ (GitHub Pages, deploys from `main`)
- Repo: https://github.com/tonygale-programming/curly-brace (public, MIT)
- `README.md` covers features, privacy, file structure, releasing and code style. Read it first.
- `ROADMAP.md` holds the ideas waiting to be built, the rules for accepting ideas, and the "Not doing" list.
- `CHANGELOG.md` is the day-by-day history. Add an entry for every release.
- The look follows Tony's design system: https://claude.ai/artifact/G2fKVhvYDpQxE6Rzz2rTHh
  (it still shows an earlier look; the decisions below win).
- Called "Brace" until 17 November 2026. Settings saved under the old `brace:` keys are moved on start.

## Tony's design decisions (these override the design system)

- **One field**, no separate result pane: Format / Minify / Stringify rewrite the text in place, undoably.
- **Format, Minify, Stringify are three buttons**; Format is filled yellow as the main action. Elsewhere
  yellow means "on" or "selected".
- **Copy and Download are outlined**, not filled. The only ink-filled button is Repair JSON in the error card.
- **One theme button** (moon / sun); a first visit follows the system setting.
- **IBM Plex fonts** for now; Roboto (from the design system) is still to decide.
- **Lucide icons**, inlined as SVG with a `data-lucide` name. Lucide has no brand logos, so GitHub uses `code`.
- **Details:** 16px icons with a 1.5px line (Lucide stroke 2.25); buttons 12px left, 8px icon gap, 16px right;
  focus is a 1.5px yellow ring with a 1.5px gap; dark-mode yellow is `#664C00` with white text; the status chip
  uses a dot, not an icon; the logo is `{Curly Brace}` with Lucide's braces; no privacy line in the header (for now).
- **Toasts are plain text**, no Undo or other buttons: `⌘Z` undoes every change to the field.
- **Header buttons are borderless** (Shortcuts, GitHub, theme); so are Copy path / Copy value in the tree.
- **Tree view**: one Expand / Collapse button; Format, Minify, Stringify and Indent are disabled there.
- **The field's text is kept for the open tab only** (sessionStorage); settings stay in localStorage.
- **Tab icon**: Tony's yellow circle with a 2px outline (`icons/icon.svg`); the installed-app PNGs stay as they are.
- **Shortcuts** live in one list in `js/main.js` (`SHORTCUTS`). Use Shift+Option/Alt + letter; only use ⌘/Ctrl
  for Open and Save. Never take ⌘T, ⌘N, ⌘W, ⌘M (can't be overridden) or ⌘F, ⌘R, ⌘C (people rely on them).
- Keep it simple: "less is more". Prefer fewer controls and disabled states over extra screens or messages.

## Positioning (why decisions go the way they do)

Curly Brace competes with JSONLint, JSONFormatter.org, CodeBeautify, JSON Editor Online, JSON Crack and JSON Hero.
Its three promises: **safe for secrets** (provably nothing leaves the browser; other formatters leaked
80,000+ pasted documents in Nov 2025), **instant** (no ads, account or cookie banner; works offline),
and **fixes messy real-world JSON**. Any change that weakens the privacy promise is out:
no third-party requests, no server storage, no analytics.

## Rules that are easy to break by accident

- **Run `python3 scripts/release.py` before every push that changes the site.** It bumps `?v=` in
  `index.html` and `RELEASE` in `service-worker.js`, and recalculates the CSP hashes. Editing the inline
  theme script or the import map without running it makes the page stop running (CSP blocks it).
- **`python3 scripts/release.py --check`** must pass before a push; the GitHub Action runs it too.
  The release refuses to go back a version and needs a `CHANGELOG.md` heading for the release's date.
- **New module in `js/`**: add it to the import map in `index.html` and `VERSIONED_FILES` in
  `service-worker.js`. The release check fails if you forget.
- **`index.html` in the repo is the only source.** Icons are edited inline there (copy the SVG from lucide.dev,
  keep `data-lucide`). The link preview's source is `scripts/preview-image.html`; redraw with
  `npm run preview-image` in `tests/browser`.
- **Nothing from other sites**: libraries live in `vendor/`, fonts in `fonts/`. The CSP
  (`default-src 'none'`, `connect-src 'none'`) blocks anything else.
- **Spacing**: only `--space-*` tokens (2, 4, 8, 12, 16, 20, 24, 32px); other sizes are multiples of 4px;
  controls share `--control-height` (32px). Exceptions: 1px borders and font sizes.
- **Colours**: tokens written once with `light-dark()`; `data-theme` on `<html>` forces a theme.
- **Names**: full descriptive names, no single letters or abbreviations, in JS, CSS classes and ids.
- **Keep it simple**: one screen, small modules with one job each, no new libraries without a strong reason.

## Working on it

- Serve locally: `python3 -m http.server 8765 --bind 127.0.0.1` in this folder, then open
  http://127.0.0.1:8765/. Modules don't load from `file://`.
- **Tests** live in the repo: `node --test tests/unit/*.test.mjs` and `cd tests/browser && npm install && npm test`
  (installed Chrome via playwright-core; `CHROME_PATH` overrides the macOS default). Run both before a commit,
  and add a test with every fix or feature.
- The Claude app's built-in browser blocks service workers and its screenshots can be stale, so check
  offline behaviour and visuals in real Chrome (the browser tests already cover offline).
- After pushing, wait about a minute for GitHub Pages, then check the live site: no requests to other
  origins, `fetch('https://example.com')` is blocked by the CSP, no console errors.
- The user asks before each commit and push; offer them, don't do them unasked.
- Commit messages: a short summary line, then a body explaining what and why.

## History

An earlier single-file version was published as a claude.ai artifact
(https://claude.ai/artifact/MFhfY6SSAbyQwhxKBTMZ58). It is out of date; the repo is the source of truth.
