# Bot Master

A local, vanilla-JS web UI for creating custom AI bot personas and chatting with them through a
local OpenAI-compatible model server (llama.cpp `llama-server`, LM Studio, Ollama's OpenAI-compat
endpoint, etc). No frameworks, no build step, no bundler, no npm install to run it — just static
files served over HTTP (or opened directly as `file://`).

Everything runs 100% locally. There are no CDN links, no external network calls, and no analytics.
All libraries (math.js, Lucide icons, OpenDyslexic font) are vendored into `js/vendor/`.

## Running it

1. Start your local model server. `launch.bat` starts `llama-server.exe` with `--host 0.0.0.0`
   (so it's reachable from other devices on your LAN, not just localhost) on the default port
   the app expects (`http://127.0.0.1:8081`).
2. Serve this folder over HTTP, e.g. `python -m http.server 8000`, and open it in a browser.
   (Opening `index.html` directly via `file://` also works for most features.)
3. Open Settings in the app and confirm/change the API base URL if your server isn't on the
   default `127.0.0.1:8081`.

## Architecture at a glance

- **No build step.** Every `js/*.js` file is loaded as a plain `<script>` tag from `index.html`,
  in a specific order (see below). They all share one global scope — there is no module system,
  so top-level `const`/`function` names must be unique across every file.
- **No frameworks.** Direct DOM manipulation via small helpers in `js/ui.js` (`$`, `el`, etc).
- **Storage:** everything (bots, chats, settings) lives in `localStorage`, managed by `js/storage.js`
  through the `DB` object.
- **Chat API:** OpenAI-compatible streaming (`/v1/chat/completions` with SSE) in `js/api.js`.

### Script load order (from `index.html`, order matters — don't reshuffle carelessly)

```
js/vendor/mathjs.min.js      -- vendored math.js UMD build, global `math` object
js/vendor/lucide-icons.js    -- vendored ~2000-icon fallback set, global `LUCIDE_ICONS`
js/icons.js                  -- hand-drawn ICONS + icon resolution chain (uses LUCIDE_ICONS)
js/storage.js                -- DB object: bots, chats, settings, migrations
js/markdown.js                -- renderMarkdown(): the custom safe markdown/formatting engine
js/ui.js                     -- tiny DOM helpers ($ , el, toast, modals, etc)
js/api.js                    -- streamChat(), model listing
js/home.js                   -- home screen (bot grid, search)
js/bots.js                   -- bot editor modal (create/edit/delete/duplicate/share)
js/chats.js                  -- chat view: message list, system prompt building, generate()/streaming
js/settings.js               -- settings modal
js/blocks2.js                 -- extra fenced blocks: compare/quote/checklist/reveal
js/app.js                    -- app init, global click delegation, routing between views
```

`js/blocks2.js` must load right after `js/markdown.js` — it calls `escapeHtml`/`icon`/`mdInline`/
`renderMarkdown`/`codeBlockHtml` and is dispatched from `renderMarkdown()`'s block-type switch.

If you add a new `.js` file, add its `<script>` tag in a sane position in this list (usually right
before `js/app.js`, unless it's a dependency other files need earlier) and pick names that won't
collide with existing top-level identifiers.

### CSS load order

```
css/base.css            -- resets, variables, layout shell, typography
css/home.css             -- bot grid / home screen
css/chat.css             -- message bubbles, input bar, chat layout
css/timeline.css         -- ```timeline``` blocks
css/interactive.css      -- ```details```, ```poll```/```choices```
css/prose.css            -- ```story```/```poem``` blocks
css/math.css             -- ```math``` / inline math styling
css/stats.css            -- ```stats``` blocks
css/tabs.css             -- ```tabs``` blocks
css/roll.css             -- ```roll```/```dice``` blocks
css/rate.css             -- ```rate``` blocks
css/codetools.css        -- code block Save/Preview/Copy buttons, live HTML preview iframe
css/blocks2.css          -- ```compare```/```quote```/```checklist```/```reveal``` blocks
css/animations.css       -- shared motion (message entrance animation)
css/accessibility.css    -- OpenDyslexic @font-face + dyslexia-font toggle
css/modals.css           -- bot editor / settings modals
```

**Rule this project follows (and you should too): when adding a new feature/system, create a new
dedicated `.css` and/or `.js` file for it instead of growing an existing file indefinitely.** That's
why there's a `timeline.css`, `math.css`, `tabs.css`, etc. instead of one giant `chat.css`. Keep
doing this for new features — it keeps each file reviewable and merge conflicts rare.

## The markdown/formatting engine (`js/markdown.js`)

This is the most complex and most-edited file in the project. `renderMarkdown(src)` is the single
entry point — it takes raw bot-generated text and returns safe HTML.

**Security model:** the *entire* source string is HTML-escaped (`escapeHtml()`) near the top of
`renderMarkdown()`, before any line-by-line processing happens. Fenced code blocks and inline code
are pulled out **first** and replaced with sentinel placeholders (`MD_CODE`/`MD_BLOCK`, built from
`String.fromCharCode(1)`/`(2)` — characters that will never appear in normal text) so their content
survives the escape step, then swapped back in afterward with syntax highlighting applied directly
(never escaped twice). **Do not reorder this** — `escapeHtml(s)` must always run after fence/inline
extraction and before `s.split("\n")`. Deleting or moving this line reintroduces a real XSS hole
(raw `<script>` tags render live) and also breaks blockquote/callout parsing, which matches against
the escaped `&gt;` prefix. There is a regression test for exactly this — see "Testing" below.

### Fenced "mini-language" blocks

Bots are instructed (via the shared formatting block in `js/chats.js`, see below) to use these
triple-backtick block types. Each has a small parser + renderer function in `markdown.js`:

| Fence | Renderer | What it does |
|---|---|---|
| `\`\`\`js` / any language | `codeBlockHtml()` | Syntax-highlighted code block with Copy/Save/Preview buttons |
| `\`\`\`html` (+ optional adjacent `\`\`\`css`/`\`\`\`js`) | `codeBlockHtml()` + sibling-stitching in `renderMarkdown()` | Live sandboxed `<iframe>` preview; adjacent CSS/JS blocks (separated only by blank lines) get auto-inlined into the preview doc |
| `\`\`\`chart` / `\`\`\`chart:progress` | `parseChartLines`, `chartBlockHtml` | Bar charts / progress bars |
| `\`\`\`timeline` | `parseTimelineLines`, `timelineBlockHtml` | Timeline/event list |
| `\`\`\`details: Summary` | `detailsBlockHtml` | Collapsible `<details>`-style section |
| `\`\`\`poll` / `\`\`\`choices` | `pollBlockHtml` | Clickable option buttons |
| `\`\`\`story` / `\`\`\`poem` | `proseBlockHtml` | Prose block styled like a code block, with a Copy button |
| `\`\`\`math` | `mathBlockHtml` → `mathLineHtml` | Styled math notation (fractions, sqrt, exponents) |
| `\`\`\`calc` | `calcBlockHtml` | Evaluates the expression live via vendored `math.js` (`math.evaluate()`) |
| `\`\`\`stats` / `\`\`\`stats:bar` | `parseStatsLines`, `statsBlockHtml` | Stat cards or progress-bar list |
| `\`\`\`tabs` | `tabsBlockHtml` | Splits on `## Heading` lines into clickable tab panels (recursively runs `renderMarkdown()` per panel) |
| `\`\`\`roll` / `\`\`\`dice` | `parseDiceNotation`, `rollBlockHtml` | Animated dice roll with a precomputed real result |
| `\`\`\`rate: question` | `rateBlockHtml` | Numeric range or comma-list rating buttons |
| `\`\`\`compare: Left \| Right` | `compareBlockHtml` (`js/blocks2.js`) | Side-by-side comparison rows, `"left \| right"` per line |
| `\`\`\`quote: Attribution` | `quoteBlockHtml` (`js/blocks2.js`) | Styled quotation card with optional byline |
| `\`\`\`checklist` | `checklistBlockHtml` (`js/blocks2.js`) | Independently clickable checkboxes with a live done-count |
| `\`\`\`reveal: teaser` | `revealBlockHtml` (`js/blocks2.js`) | Click-to-flip card for twists/riddle answers/surprises |

There's also a fallback in `renderMarkdown()` that detects an **unterminated** trailing fence (from
a response that got cut off mid-code-block) and still renders it as an open code block, so cut-off
generations don't dump raw backticks into the chat.

### Inline formatting (`mdInline()`)

`` `code` ``, `**bold**`, `*italic*`, `~~strike~~`, `||spoiler||`, `[[Key]]` → `<kbd>`, `==highlight==`
→ `<mark>`, `` {green|red|blue|yellow}text{/color} `` → colored span, `(pill: label)` → pill badge,
`:icon-name:` → icon (falls back to an emoji if the name doesn't resolve to a real icon), automatic
emoji → icon conversion, and LaTeX tolerance (`delatex()` converts stray `\frac{}`, `\times`,
`\sqrt{}`, `$...$`, etc. into the app's own plain math notation — bots are told never to use raw
LaTeX, but this catches it if they slip).

### Icon system (`js/icons.js`)

Three-tier resolution via `icon(name, cls)` / `hasIcon(name)` / `resolveIconName(name)`:

1. Hand-drawn `ICONS` (~75 entries, square-cap/miter-join SVG style, used for the icon picker grid
   `AVATAR_ICONS` in the bot editor)
2. Vendored `LUCIDE_ICONS` (~2000 icons in `js/vendor/lucide-icons.js`, generated from the npm
   `lucide-static` package)
3. `ICON_ALIASES` — maps common English words bots might use (`gear`, `fire`, `sad`, `idea`, etc.)
   to their real Lucide names, for cases where the obvious word isn't the exact icon name
4. Falls back to the `"bot"` icon if nothing resolves

If you add new icons to the hand-drawn set, also add them to `AVATAR_ICONS` if they should show up
in the bot editor's icon picker.

## Bots (`js/storage.js`)

`DEFAULT_BOTS` is the array of built-in bot personas, currently 46 entries. Each bot object has:

```js
{
  id, name, icon, color, image /* dataURL or null */, tagline,
  prompt,       // system prompt, second-person ("You are X, who...")
  greeting,     // bot's first message
  temp,         // 0.3-0.6 factual, 0.7-0.9 balanced, 1.0-1.2 wild/character bots
  category,     // category id (see DEFAULT_CATEGORIES) or "uncategorized"
  favorite,     // boolean, toggled from the home screen star button
  scenario,     // optional, one sentence of situational context
  example,      // optional but recommended: a "User:...\nBotName:..." demo exchange —
                // the single highest-leverage field for a distinctive voice
  topP,         // optional, defaults to 1
  nickname,     // optional, what the bot calls the user
  traits,       // optional, comma-separated personality traits
  backstory,    // optional, a sentence or two of history/origin
  speechStyle,  // optional, concrete speech quirks/verbal habits
  likes,        // optional, comma-separated
  dislikes      // optional, comma-separated
}
```

The advanced persona fields (`traits`, `backstory`, `speechStyle`, `likes`, `dislikes`) are optional
supplements to `prompt`, not replacements — they're appended into the composed system prompt by
`buildCharacterPrompt()` in `js/chats.js`. The bot editor's "Advanced persona" section shows a live,
read-only preview (`#bot-prompt-preview`) of exactly what gets composed, built by the same function
so it can never drift from what's actually sent.

### Categories & favouriting

`DB.categories` (seeded from `DEFAULT_CATEGORIES` in `js/storage.js`, persisted at `bf2_categories`)
holds `{ id, name }` category records. Users can add/rename/delete categories from the "Manage
categories" button in the bot editor (`openCategoryManager()` in `js/bots.js`); deleting a category
falls its bots back to the built-in `"uncategorized"` bucket rather than deleting them. The home
screen (`renderHome()` in `js/home.js`) renders a Favourites section (bots with `favorite: true`)
followed by one section per non-empty category, each sorted by most recent chat activity.

### Adding a new built-in bot

1. Add the object to `DEFAULT_BOTS` in `js/storage.js`. Give it a unique `icon` (check it resolves
   via the icon system above) and a unique `id` ending in `-default`.
2. **Bump the seed-version flag.** `DB.init()` only adds missing `DEFAULT_BOTS` entries to an
   existing install when `this.settings.seededVN` is false for the *current* `N`. If you don't bump
   it, anyone with an existing `localStorage` (i.e. basically every returning user) will never see
   your new bot. This has been the single most common bug in this project's history — bump both the
   `if (!this.settings.seededVN)` check and the `this.settings.seededVN = true;` assignment to the
   next number, in the same change that adds new bots. Current flag: `seededV8`.
3. If you need to force-update an *existing* bot's prompt for everyone (not just seed a new one),
   add a separate one-time migration flag (see `refreshedMathbotV2`/`refreshedGmV2`/`refreshedCoderV2`/
   `refreshedCreatorV2` for the pattern) guarded by checking the current prompt for stale text, so you
   don't clobber a user's own edits to that bot.
4. Don't add a roster-trimming/deletion migration that filters `DEFAULT_BOTS` by a hardcoded
   keep-list — this was tried once and caused a race condition where newly-seeded bots got
   immediately deleted again. If bots need to be retired, remove them from `DEFAULT_BOTS` and let
   users delete their own copy manually; don't auto-delete.

### Shared formatting instructions

Every bot's system prompt gets a large shared "Formatting" instructions block appended in
`buildApiMessages()` (`js/chats.js`) — this is where bots are told about all the fenced block types
above, told to always use code fences for code, told never to use raw LaTeX, and given the current
confirmed list of icon names. If you add a new fenced block type or inline syntax to `markdown.js`,
document it here too or bots won't know to use it.

## Settings (`js/settings.js`, `DB.settings`)

Stored flat in `DB.settings` (see `DEFAULT_SETTINGS` in `js/storage.js`). Notable ones:

- `autoContinue` — when a response looks cut off (`finish_reason === "length"` or an odd number of
  `` ``` `` fences), `generate()` in `js/chats.js` automatically asks the model to continue, up to
  `MAX_AUTO_CONTINUES` (3) times.
- `dyslexiaFont` — toggles the vendored OpenDyslexic font via `applyDyslexiaFont()` in `js/settings.js`.
- Max tokens slider goes up to 15000.

## HTML live preview sandboxing

The `\`\`\`html\`\`\`` preview iframe uses `sandbox="allow-scripts"` **without** `allow-same-origin`
on purpose — this gives the iframe an opaque origin so bot-generated code can never reach the real
app's DOM, `localStorage`, or cookies. The iframe is destroyed and recreated (not reused) on every
open/close toggle, because reusing one iframe and reassigning `srcdoc` doesn't reliably re-render in
all browsers. Adjacent `\`\`\`html\`\`\` + \`\`\`css\`\`\` + \`\`\`javascript\`\`\`` blocks (only
blank lines between them, no other text) get auto-detected in `renderMarkdown()` and stitched into
one combined `srcdoc` document for the preview, while still rendering as separate, individually
copyable/downloadable code cards.

## Testing

There's no formal test framework — this project uses small throwaway Node scripts (run with plain
`node`) that load the real browser files via Node's `vm` module (not `eval`, which has different
top-level-`const` scoping semantics than sequential `<script>` tags) to simulate the actual browser
load order and call `renderMarkdown()` / other functions directly.

If you're an AI picking this project back up: **write one of these scripts and run it after any
`js/markdown.js` change**, at minimum checking: XSS escaping still works, sentinels don't leak into
output, syntax highlighting still works, tables/lists/task-lists render, and each fenced block type
still renders. This has caught real regressions before (see the escapeHtml deletion incident in the
git history / conversation logs) — don't skip it just because there's no `npm test` to run.

Also run `node --check js/storage.js` (or any edited file) after edits to catch syntax errors before
reloading the app.

## Conventions / house rules

- **No frameworks, no build step, no bundler.** Keep it that way unless the user explicitly asks to
  change the architecture.
- **No external network calls.** Vendor any library you need into `js/vendor/` (check its license
  is redistributable) rather than linking a CDN.
- **New feature = new file(s).** Don't keep growing `chat.css`/`chats.js`/`storage.js` forever —
  give each new system its own CSS/JS file, per the standing rule noted above.
- **Bump seed/migration version flags** whenever `DEFAULT_BOTS` changes, in the same commit/turn.
- **Never regress the `escapeHtml(s)` ordering** in `renderMarkdown()`.
