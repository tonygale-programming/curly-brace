# Roadmap and ideas

Ideas waiting to be built. Nothing here is implemented yet.

## How an idea gets in

Curly Brace stays one screen that anyone understands in five seconds, and code anyone can read.
An idea is welcome when it:

- **solves something people hit often**, not a rare edge case,
- **fits the existing screen**: a button, a toggle or a small menu, never a new page or mode,
- **lives in one small module** (or a few lines in an existing one) and needs **no new library**,
- **keeps the privacy promise**: nothing is sent anywhere, nothing is stored on a server.

If an idea fails one of these, it goes to [Not doing](#not-doing) with the reason.

## Next up: small UX improvements

Each is small (S = an hour or two, M = about a day).

| Idea | Why it helps | How, simply | Size |
|---|---|---|---|
| **Cursor position** | Developers expect "Ln 12, Col 5" next to line numbers | Show it in the status row, from `selectionStart` and the existing `getLineAndColumn` | S |
| **Remember the output mode** | Someone who always minifies has to click Minify every visit | Remember the last of Format / Minify for paste and open, like the indent setting | S |
| **Wrap long lines** | Long string values push the text far to the right | A "Wrap" toggle next to Text · Tree; remembered like the theme | S |
| **Expand to level 1, 2, 3** | "Expand all" on big data is too much; "Collapse all" is too little | Give the Expand / Collapse button a small menu: 1 · 2 · 3 · All | S |
| **Keyboard navigation** | Moving through the tree with the mouse only is slow | Arrow keys in the tree (open, close, next, previous) and between Text · Tree | M |
| **Text size** | Small screens and presentations need bigger code text | `A−` / `A+` changes one CSS variable for code size; remembered like the theme | S |

## Housekeeping

- **Sync the design system artifact** with what is live: one field, Lucide 16px icons, the olive dark-mode
  accent, plain toasts, borderless header buttons, the Curly Brace name and the new tab icon.
- **Match the installed-app icons** to the new tab icon (kept as they are for now).
- Still to decide: a "Buy me a coffee" link, and Roboto versus IBM Plex.

## Bigger: large files

Files over 10 MB are refused today, because parsing, colouring and drawing them freezes the tab.
Parsing in a Web Worker and drawing only the visible lines would lift the limit. Worth it only if people ask.

## Done

Built (see CHANGELOG.md): Download as file, Copy a value from the tree, Drop a file anywhere, Keyboard shortcuts and their list, "Show in input" for errors, one Expand / Collapse button, Stringify. `⌘Z` undoes Clear, Sample and Repair, so toasts need no Undo button. Input / Result tabs on phones are no longer needed, because there is only one field.

## Phase 2: messy real-world JSON

- **JSON inside a string**: Format already unwraps what Stringify made; still to do: JSON strings nested inside values
- **JSON Lines**: one JSON object per line (common in logs); format each line, show errors per line
- **Secret detection**: notice AWS keys, GitHub tokens, private keys and JWTs, and show a calm note that they stay on this device
- **Search in the tree**: a filter box that shows only matching keys and values
- **Value previews**: dates as readable text, colour swatches, clickable URLs

## Phase 3: power features

- **Table view** for arrays of objects, with "Copy as CSV"
- **Private share links**: the data, compressed, goes after the `#` in the link, which browsers never send to a server;
  warn first if the data looks like it contains secrets
- **Compare two documents**, ignoring key order
- **Generate TypeScript types** from the data

## Phase 4: getting known

- A short custom domain
- Launch posts: Hacker News "Show HN", Reddit r/webdev, Product Hunt. Lead with privacy you can verify
- A browser extension that opens JSON URLs in Curly Brace

## Not doing

| Idea | Why not |
|---|---|
| Accounts, saving or sharing on a server | Breaks the privacy promise; this is exactly how other formatters leaked secrets |
| Ads, analytics, cookie banners | Same reason, and they slow the page down |
| A graph view (boxes and arrows) | Hard to read on real data and a lot of code to maintain |
| Dozens of converters (XML, YAML, CSV, …) on separate pages | Turns one clear tool into a maze; CSV comes with the table view only |
| Indent as `2 · 4 · Tab` buttons | Tried on 18 November 2026: "2" and "4" need a label or units, and then the control is wider and busier. The dropdown is clearer |
| A full code editor (Monaco) | Several megabytes for a quick-look tool. If the input box needs more, CodeMirror 6 is the lighter option |
