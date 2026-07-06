"use strict";
/* ============================================================
   Markdown renderer (no external libraries). Supports:
   headings, bold/italic/strike, inline code, fenced code
   blocks with syntax highlighting + copy button, lists,
   task lists, tables, blockquotes, links, spoilers, rules.
   HTML is escaped first, so model output can't inject markup.
   ============================================================ */

/* callout/admonition types: > [!note] ... renders as a colored icon box */
const CALLOUT_TYPES = {
  note: { icon: "info", label: "Note" },
  info: { icon: "info", label: "Info" },
  tip: { icon: "zap", label: "Tip" },
  success: { icon: "check", label: "Success" },
  warning: { icon: "alert", label: "Warning" },
  danger: { icon: "flame", label: "Danger" }
};

/* common emoji a bot might type -> matching icon from the shared icon
   library, so replies look consistent with the rest of the flat-icon UI
   instead of falling back to the OS emoji font */
const MD_EMOJI_TO_ICON = {
  "👍": "check", "✅": "check", "☑️": "check",
  "❤️": "heart", "💖": "heart", "😍": "heart",
  "⭐": "star", "🌟": "star",
  "🔥": "flame",
  "⚠️": "alert", "❗": "alert",
  "🎯": "target",
  "💎": "gem",
  "👑": "crown",
  "🛡️": "shield",
  "⚔️": "sword",
  "🚀": "rocket",
  "🎮": "gamepad",
  "🎵": "music", "🎶": "music",
  "📖": "book", "📚": "book",
  "👻": "ghost",
  "💀": "skull",
  "🐱": "cat",
  "🌍": "globe", "🌎": "globe", "🌏": "globe",
  "⚓": "anchor",
  "🎲": "dice",
  "❄️": "snowflake",
  "👁️": "eye",
  "⚡": "zap",
  "💡": "info"
};

/* :name: fallback for when a bot uses a plausible-sounding icon name that
   isn't in our hand-drawn set OR the vendored Lucide catalogue (js/icons.js
   resolveIconName/ICON_ALIASES) — rather than printing broken literal text
   like ":soccer:", degrade gracefully to a representative emoji */
const NAME_TO_EMOJI = {
  soccer: "⚽", basketball: "🏀", tennis: "🎾", golf: "⛳", swim: "🏊",
  volleyball: "🏐", football: "🏈", baseball: "⚾",
  sad: "😢", angry: "😠", happy: "😊", laugh: "😂", think: "🤔", thinking: "🤔",
  thinking_face: "🤔", shrug: "🤷",
  wave: "👋", clap: "👏", question: "❓", exclamation: "❗", idea: "💡",
  bullseye: "🎯", fire: "🔥", water: "💧", ocean: "🌊", rain: "🌧️",
  snow: "🌨️", tree: "🌳", palm: "🌴", flower: "🌸", ball: "🏀",
  cheese: "🧀", chocolate: "🍫", bread: "🍞", coconut: "🥥", pizza: "🍕",
  cake: "🍰", coffee: "☕", beer: "🍺", apple: "🍎", egg: "🥚", salad: "🥗",
  trophy: "🏆", medal: "🏅", award: "🏅", money: "💵", cash: "💵",
  piggybank: "🐷", backpack: "🎒", graduation: "🎓", school: "🏫",
  glue: "🧴", tape: "📼", person: "🧑", people: "👥", group: "👥",
  help: "❓", lock: "🔒", link: "🔗", share: "📤", bookmark: "🔖",
  map: "🗺️", compass: "🧭", umbrella: "☂️", thermometer: "🌡️",
  brain: "🧠", tooth: "🦷", pill: "💊", stethoscope: "🩺", syringe: "💉",
  bone: "🦴", wallet: "👛"
};

/* control-char sentinels - can never appear in escaped user text */
const MD_CODE = String.fromCharCode(1);   // inline code placeholder
const MD_BLOCK = String.fromCharCode(2);  // fenced code block placeholder

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
          .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------------- syntax highlighting ---------------- */

const HL_KEYWORDS = new Set(("function,const,let,var,if,else,for,while,return,class,new,import,from,export,default,async,await,try,catch,finally,throw,switch,case,break,continue,typeof,instanceof,in,of,this,null,undefined,true,false,def,elif,lambda,pass,print,not,and,or,is,None,True,False,self,then,do,fn,pub,struct,enum,match,impl,use,mut,void,int,float,double,char,bool,string,static,public,private,protected,final,extends,implements,interface,package,namespace,select,insert,update,delete,where,order,group,by,echo,foreach,end,begin,raise,except,with,as,yield,global,local,require,module,exports").split(","));

function highlightCode(code) {
  const re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|\d+(?:\.\d+)?|[A-Za-z_]\w*|\s+|[^\s\w]+)/g;
  let out = "", m;
  while ((m = re.exec(code))) {
    const t = m[0];
    const esc = escapeHtml(t);
    if (t.startsWith("//") || t.startsWith("#") || t.startsWith("/*")) {
      out += '<span class="tok-com">' + esc + "</span>";
    } else if (t[0] === '"' || t[0] === "'" || t[0] === "`") {
      out += '<span class="tok-str">' + esc + "</span>";
    } else if (/^\d/.test(t)) {
      out += '<span class="tok-num">' + esc + "</span>";
    } else if (HL_KEYWORDS.has(t)) {
      out += '<span class="tok-kw">' + esc + "</span>";
    } else if (/^[A-Za-z_]/.test(t) && /^\s*\(/.test(code.slice(re.lastIndex))) {
      out += '<span class="tok-fn">' + esc + "</span>";
    } else {
      out += esc;
    }
  }
  return out;
}

/* maps a fenced code block's language tag to a file extension, for the
   download button. "html:index.html" style tags let a bot name the file
   explicitly; otherwise we guess a sensible extension from the language. */
const LANG_EXT = {
  html: "html", htm: "html", css: "css", javascript: "js", js: "js",
  typescript: "ts", ts: "ts", jsx: "jsx", tsx: "tsx", json: "json",
  python: "py", py: "py", java: "java", c: "c", cpp: "cpp", "c++": "cpp",
  csharp: "cs", "c#": "cs", go: "go", rust: "rs", rb: "rb", ruby: "rb",
  php: "php", sql: "sql", sh: "sh", bash: "sh", shell: "sh", yaml: "yaml",
  yml: "yaml", xml: "xml", md: "md", markdown: "md", txt: "txt"
};

function codeBlockMeta(rawLang) {
  const parts = (rawLang || "").split(":");
  const lang = parts[0].toLowerCase();
  const namedFile = parts[1] && parts[1].trim();
  const ext = LANG_EXT[lang] || (/^[a-z0-9]{1,8}$/.test(lang) ? lang : "txt");
  const filename = namedFile || ("snippet." + ext);
  return { lang, filename, isHtml: lang === "html" || lang === "htm" };
}

let codeBlockCounter = 0;
function codeBlockHtml(block, combinedSrc) {
  const meta = codeBlockMeta(block.lang);
  const id = "codeblock-" + (codeBlockCounter++);
  const previewBtn = meta.isHtml
    ? '<button class="code-preview-btn" type="button" title="Live preview" data-target="' + id + '">' +
      icon("eye") + "<span>Preview</span></button>" +
      '<button class="code-expand-btn" type="button" title="Expand preview fullscreen" data-target="' +
      id + '" hidden>' + icon("maximize") + "<span>Expand</span></button>"
    : "";
  const previewSrcAttr = combinedSrc
    ? ' data-preview-src="' + escapeHtml(combinedSrc) + '"' : "";
  return '<div class="codeblock"><div class="codeblock-head"><span>' +
    escapeHtml(block.lang || "code") +
    (combinedSrc ? '<span class="codeblock-combined-note"> (combined with linked CSS/JS for preview)</span>' : "") +
    '</span><div class="codeblock-actions">' +
    previewBtn +
    '<button class="code-download" type="button" title="Download as ' + escapeHtml(meta.filename) + '" ' +
    'data-filename="' + escapeHtml(meta.filename) + '">' + icon("download") + "<span>Save</span></button>" +
    '<button class="code-copy" type="button" title="Copy code">' +
    icon("copy") + "<span>Copy</span></button></div></div>" +
    "<pre><code>" + highlightCode(block.code) + "</code></pre>" +
    (meta.isHtml ? '<div class="code-preview" id="' + id + '" hidden' + previewSrcAttr + '></div>' : "") +
    "</div>";
}

/* ---------------- fenced prose blocks ----------------
   ```story              renders as a copyable prose card, no code
   Once upon a time...    highlighting, line breaks preserved
   ```
   ```poem                same card but centered/italic styling
   Roses are red...
   ``` */
function proseBlockHtml(block, kind) {
  const label = kind === "poem" ? "Poem" : "Story";
  return '<div class="proseblock proseblock-' + kind + '"><div class="proseblock-head"><span>' +
    icon(kind === "poem" ? "star" : "book") + label +
    '</span><button class="code-copy" type="button" title="Copy text">' +
    icon("copy") + "<span>Copy</span></button></div>" +
    '<div class="proseblock-body">' + escapeHtml(block.code) + "</div></div>";
}

/* ---------------- fenced math blocks ----------------
   ```math
   x^2 + 3x - 4 = 0
   (x+4)(x-1) = 0
   sqrt(16) = 4
   ```
   lightweight LaTeX-ish notation, no external math renderer:
   x^2 -> superscript, sqrt(x) -> radical, a/b -> stacked fraction.
   also tolerates stray LaTeX a bot slips in anyway (\frac, \times, ...)
   by converting it to our plain notation before rendering. */
function delatex(raw) {
  let s = raw;
  s = s.replace(/\$\$?/g, "");
  /* \frac{a}{b} -> a/b, handling one level of nesting in a or b */
  const frac = /\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g;
  for (let i = 0; i < 3 && frac.test(s); i++) { frac.lastIndex = 0; s = s.replace(frac, "($1)/($2)"); }
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)");
  s = s.replace(/\\(times|cdot)/g, "*");
  s = s.replace(/\\div/g, "/");
  s = s.replace(/\\pm/g, "+/-");
  s = s.replace(/\\le(q)?/g, "<=");
  s = s.replace(/\\ge(q)?/g, ">=");
  s = s.replace(/\\neq/g, "!=");
  s = s.replace(/\^\{([^{}]*)\}/g, "^($1)");
  s = s.replace(/_\{([^{}]*)\}/g, "_($1)");
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\[a-zA-Z]+/g, "");
  s = s.replace(/[{}]/g, "");
  return s;
}

function mathLineHtml(line) {
  let s = escapeHtml(delatex(line));
  s = s.replace(/sqrt\(([^()]+)\)/g, '<span class="m-sqrt">$1</span>');
  s = s.replace(/([A-Za-z0-9\.]+)\^(-?[A-Za-z0-9\.]+)/g, '$1<sup>$2</sup>');
  /* (a)/(b) — parenthesized fraction, as produced by delatex() from \frac{a}{b} */
  s = s.replace(/\((-?[\w.+\- ]+)\)\/\((-?[\w.+\- ]+)\)/g,
    '<span class="m-frac"><span class="m-num">$1</span><span class="m-den">$2</span></span>');
  /* plain a/b — bare numeric fraction with no surrounding parens/word chars */
  s = s.replace(/(?<![\w)])(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)(?![\w(])/g,
    '<span class="m-frac"><span class="m-num">$1</span><span class="m-den">$2</span></span>');
  return s;
}

function mathBlockHtml(block) {
  const lines = block.code.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return codeBlockHtml(block);
  const rows = lines.map(l => '<div class="m-line">' + mathLineHtml(l) + "</div>").join("");
  return '<div class="mathblock"><div class="mathblock-head"><span>' + icon("cpu") +
    "Math</span><button class=\"code-copy\" type=\"button\" title=\"Copy\">" +
    icon("copy") + "<span>Copy</span></button></div>" +
    '<div class="mathblock-body">' + rows + "</div></div>";
}

/* ---------------- fenced calc blocks ----------------
   ```calc
   (2/5) * (3/4)
   ```
   evaluated live with math.js (js/vendor/mathjs.min.js) and shown
   alongside the expression; falls back to plain math styling if
   math.js failed to load or the expression can't be evaluated */
function calcBlockHtml(block) {
  const lines = block.code.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return codeBlockHtml(block);
  const rows = lines.map(raw => {
    const expr = delatex(raw);
    let result = null;
    if (typeof math !== "undefined") {
      try { result = math.evaluate(expr); } catch { result = null; }
    }
    const shown = mathLineHtml(raw);
    if (result === null || result === undefined || typeof result === "function") {
      return '<div class="m-line">' + shown + "</div>";
    }
    const resStr = typeof result === "number" ? String(+result.toFixed(6)) : String(result);
    return '<div class="m-line">' + shown + '<span class="m-eq"> = </span>' +
      '<span class="m-result">' + escapeHtml(resStr) + "</span></div>";
  }).join("");
  return '<div class="mathblock calcblock"><div class="mathblock-head"><span>' + icon("zap") +
    "Calc</span><button class=\"code-copy\" type=\"button\" title=\"Copy\">" +
    icon("copy") + "<span>Copy</span></button></div>" +
    '<div class="mathblock-body">' + rows + "</div></div>";
}

/* ---------------- fenced chart blocks ----------------
   ```chart              horizontal bar chart, bars scaled to the max value
   Label: 42
   ```
   ```chart:progress      each line is its own 0-100 progress bar
   Health: 75
   ``` */
function parseChartLines(code) {
  const rows = [];
  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.+?):\s*(-?\d+(?:\.\d+)?)\s*(%?)$/);
    if (m) rows.push({ label: m[1].trim(), value: parseFloat(m[2]), pct: m[3] === "%" });
  }
  return rows;
}

/* ---------------- fenced timeline blocks ----------------
   ```timeline
   Step 1: Gather wood
   Step 2: Build shelter
   ```
   each non-empty line becomes a connected step; "Label: text" splits
   into a bold head + body, plain lines render as body-only steps */
function parseTimelineLines(code) {
  const rows = [];
  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.+?):\s*(.+)$/);
    if (m) rows.push({ label: m[1].trim(), body: m[2].trim() });
    else rows.push({ label: "", body: line });
  }
  return rows;
}

function timelineBlockHtml(block) {
  const rows = parseTimelineLines(block.code);
  if (!rows.length) return codeBlockHtml(block);
  const steps = rows.map((r, i) =>
    '<div class="tl-step"><div class="tl-marker"><span class="tl-num">' + (i + 1) +
    "</span></div><div class=\"tl-content\">" +
    (r.label ? "<div class=\"tl-label\">" + escapeHtml(r.label) + "</div>" : "") +
    '<div class="tl-body">' + escapeHtml(r.body) + "</div></div></div>"
  ).join("");
  return '<div class="timeline">' + steps + "</div>";
}

/* ---------------- fenced details blocks ----------------
   ```details: Click for lore
   Long hidden text here...
   ```
   collapsed by default; click the summary to expand */
let detailsCounter = 0;
function detailsBlockHtml(block, lang) {
  const m = lang.match(/^details:?\s*(.*)$/i);
  const summary = (m && m[1].trim()) || "Details";
  const id = "details-" + (detailsCounter++);
  return '<div class="details-block"><button class="details-summary" type="button" ' +
    'aria-expanded="false" data-target="' + id + '">' + icon("chevron-down") +
    "<span>" + escapeHtml(summary) + '</span></button><div class="details-body" id="' + id + '" hidden>' +
    renderMarkdown(block.code) + "</div></div>";
}

/* ---------------- fenced poll/choices blocks ----------------
   ```poll
   Fight the dragon
   Run away
   Try to negotiate
   ```
   renders clickable buttons; clicking one sends that text as the
   user's next message (wired up in app.js via .choice-btn) */
function pollBlockHtml(block) {
  const opts = block.code.split("\n").map(l => l.trim()).filter(Boolean);
  if (!opts.length) return codeBlockHtml(block);
  const btns = opts.map(o =>
    '<button class="choice-btn" type="button">' + escapeHtml(o) + "</button>"
  ).join("");
  return '<div class="pollblock">' + btns + "</div>";
}

/* ---------------- fenced stats blocks ----------------
   ```stats                big number cards, side by side
   HP: 20
   Level: 5
   Gold: 340
   ```
   ```stats:bar             HP/mana-style bars: "Label: value/max"
   HP: 14/20
   Mana: 30/30
   ```
   */
function parseStatsLines(code) {
  const rows = [];
  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.+?):\s*(.+)$/);
    if (m) rows.push({ label: m[1].trim(), value: m[2].trim() });
  }
  return rows;
}

function statsBlockHtml(block) {
  const isBar = block.lang === "stats:bar";
  const rows = parseStatsLines(block.code);
  if (!rows.length) return codeBlockHtml(block);
  if (isBar) {
    const items = rows.map(r => {
      const m = r.value.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
      if (!m) return '<div class="stat-bar-row"><span class="stat-bar-label">' +
        escapeHtml(r.label) + '</span><span class="stat-bar-value">' + escapeHtml(r.value) + "</span></div>";
      const cur = parseFloat(m[1]), max = parseFloat(m[2]);
      const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
      return '<div class="stat-bar-row"><span class="stat-bar-label">' + escapeHtml(r.label) + "</span>" +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="stat-bar-value">' + escapeHtml(m[1]) + "/" + escapeHtml(m[2]) + "</span></div>";
    }).join("");
    return '<div class="statsblock statsblock-bar">' + items + "</div>";
  }
  const cards = rows.map(r =>
    '<div class="stat-card"><div class="stat-card-value">' + escapeHtml(r.value) +
    '</div><div class="stat-card-label">' + escapeHtml(r.label) + "</div></div>"
  ).join("");
  return '<div class="statsblock">' + cards + "</div>";
}

/* ---------------- fenced tabs blocks ----------------
   ```tabs
   ## Option A
   Content for option A...
   ## Option B
   Content for option B...
   ```
   splits on "## Heading" lines within the block, renders as
   clickable tab headers + panels (first tab active by default) */
let tabsCounter = 0;
function tabsBlockHtml(block) {
  const lines = block.code.split("\n");
  const sections = [];
  for (const raw of lines) {
    const h = raw.match(/^##\s+(.*)/);
    if (h) { sections.push({ title: h[1].trim(), lines: [] }); continue; }
    if (sections.length) sections[sections.length - 1].lines.push(raw);
    else { if (!sections.length) sections.push({ title: "Tab 1", lines: [] }); sections[0].lines.push(raw); }
  }
  if (!sections.length) return codeBlockHtml(block);
  const gid = "tabs-" + (tabsCounter++);
  const heads = sections.map((s, i) =>
    '<button class="tab-head' + (i === 0 ? " active" : "") + '" type="button" data-tabgroup="' + gid +
    '" data-tabindex="' + i + '">' + escapeHtml(s.title) + "</button>"
  ).join("");
  const panels = sections.map((s, i) =>
    '<div class="tab-panel' + (i === 0 ? " active" : "") + '" data-tabgroup="' + gid + '" data-tabindex="' + i + '">' +
    renderMarkdown(s.lines.join("\n").trim()) + "</div>"
  ).join("");
  return '<div class="tabsblock"><div class="tab-heads">' + heads + '</div><div class="tab-panels">' + panels + "</div></div>";
}

/* ---------------- fenced roll/dice blocks ----------------
   ```roll
   1d20
   2d6+3
   ```
   animates briefly then lands on a real rolled result; one line
   per roll. Notation: NdM(+/-K) */
let rollCounter = 0;
function parseDiceNotation(expr) {
  const m = expr.trim().match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?$/i);
  if (!m) return null;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3].replace(/\s+/g, ""), 10) : 0;
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  return { count, sides, mod };
}

function rollBlockHtml(block) {
  const lines = block.code.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return codeBlockHtml(block);
  const rows = lines.map(line => {
    const dice = parseDiceNotation(line);
    if (!dice) return '<div class="roll-row"><span class="roll-label">' + escapeHtml(line) + "</span></div>";
    const rolls = Array.from({ length: dice.count }, () => 1 + Math.floor(Math.random() * dice.sides));
    const total = rolls.reduce((a, b) => a + b, 0) + dice.mod;
    const id = "roll-" + (rollCounter++);
    return '<div class="roll-row" id="' + id + '" data-final="' + escapeHtml(String(total)) + '">' +
      '<span class="roll-label">' + escapeHtml(line) + '</span>' +
      '<span class="roll-die rolling">?</span></div>';
  }).join("");
  return '<div class="rollblock">' + rows + "</div>";
}

/* ---------------- fenced rate blocks ----------------
   ```rate: How was this explanation?
   1-5
   ```
   or ```rate: Pick a difficulty
   Easy, Medium, Hard
   ```
   renders clickable rating options; clicking sends the pick as
   the user's next message (wired up in app.js via .rate-btn) */
function rateBlockHtml(block, lang) {
  const m = lang.match(/^rate:?\s*(.*)$/i);
  const question = (m && m[1].trim()) || "Rate this";
  const body = block.code.trim();
  let options;
  const range = body.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const lo = parseInt(range[1], 10), hi = parseInt(range[2], 10);
    options = [];
    for (let i = lo; i <= hi && options.length < 20; i++) options.push(String(i));
  } else {
    options = body.split(/\n|,/).map(s => s.trim()).filter(Boolean);
  }
  if (!options.length) return codeBlockHtml(block);
  const btns = options.map(o =>
    '<button class="rate-btn" type="button">' + escapeHtml(o) + "</button>"
  ).join("");
  return '<div class="rateblock"><div class="rateblock-q">' + escapeHtml(question) +
    '</div><div class="rateblock-opts">' + btns + "</div></div>";
}

function chartBlockHtml(block) {
  const isProgress = block.lang === "chart:progress";
  const rows = parseChartLines(block.code);
  if (!rows.length) return codeBlockHtml(block);
  const max = isProgress ? 100 : Math.max(...rows.map(r => Math.abs(r.value)), 1);
  const bars = rows.map(r => {
    const pct = Math.max(0, Math.min(100, (Math.abs(r.value) / max) * 100));
    return '<div class="chart-row"><span class="chart-label">' + escapeHtml(r.label) +
      '</span><div class="chart-track"><div class="chart-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="chart-value">' + escapeHtml(String(r.value)) + (r.pct ? "%" : "") + "</span></div>";
  }).join("");
  return '<div class="chartblock' + (isProgress ? " progress" : "") + '">' + bars + "</div>";
}

/* ---------------- inline formatting ---------------- */
/* `code`, **bold**, *italic*, ~~strike~~, ||spoiler||, [links](https://...) */

function mdInline(s) {
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (m, c) => {
    codes.push(c);
    return MD_CODE + (codes.length - 1) + MD_CODE;
  });
  /* stray inline LaTeX a bot slipped in despite instructions not to
     ($...$ spans, or leftover \frac/\times/\sqrt with no $ at all) */
  s = s.replace(/\$([^$\n]+)\$/g, (m, expr) => mathLineHtml(expr));
  s = s.replace(/\\(?:frac|sqrt|times|cdot|div|pm|left|right)\b[^\s.,;!?]*/g,
    m => mathLineHtml(m));
  s = s.replace(/\|\|([^|\n]+)\|\|/g, '<span class="spoiler" title="Click to reveal">$1</span>');
  s = s.replace(/\[\[([^\[\]\n]{1,24})\]\]/g, '<kbd>$1</kbd>');
  s = s.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  s = s.replace(/:([a-z][a-z0-9_-]{0,20}):/g, (m, name) => {
    if (hasIcon(name)) return icon(name, "inline-ic");
    if (NAME_TO_EMOJI[name]) return NAME_TO_EMOJI[name];
    return m;
  });
  s = s.replace(/[☀-➿]️?|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F\uDE80-\uDEFF]/g,
    m => MD_EMOJI_TO_ICON[m] ? icon(MD_EMOJI_TO_ICON[m], "inline-ic") : m);
  s = s.replace(/\{(green|red|blue|yellow)\}([^{}\n]+)\{\/\1\}/g, '<span class="ctext ctext-$1">$2</span>');
  s = s.replace(/\(pill:\s*([^()\n]{1,32})\)/g, '<span class="pill">$1</span>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  s = s.replace(/__([^_]+)__/g, "<b>$1</b>");
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*/g, "$1<i>$2</i>");
  s = s.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  /* bare URLs a bot just typed (not already inside a markdown link's
     href, guarded by the lookbehind) become clickable blue links too.
     trailing sentence punctuation is left outside the link. */
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (m, pre, url) => {
    const trail = url.match(/[.,;:!?)\]]+$/);
    let tail = "";
    if (trail) { tail = trail[0]; url = url.slice(0, -tail.length); }
    return pre + '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + "</a>" + tail;
  });
  s = s.replace(new RegExp(MD_CODE + "(\\d+)" + MD_CODE, "g"),
    (m, i) => "<code>" + codes[+i] + "</code>");
  return s;
}

/* ---------------- block-level rendering ---------------- */

function renderMarkdown(src) {
  const blocks = [];
  /* pull fenced code out of the RAW text so the highlighter
     sees real quotes, not &quot; entities */
  let s = src.replace(/```([^\n`]*)\n?([\s\S]*?)```/g, (m, lang, code) => {
    blocks.push({ lang, code: code.replace(/\n$/, "") });
    return MD_BLOCK + (blocks.length - 1) + MD_BLOCK;
  });
  /* a reply can get cut off (token limit / stopped generation) mid code
     block, leaving an opening ``` with no matching close. Rather than
     let that whole tail render as a wall of raw unformatted text, treat
     the last unmatched ``` as still-open and format everything after it
     as a code block (streaming view already does this same "unclosed
     fence" treatment implicitly via the trailing placeholder cleanup below) */
  const fenceLineRe = /^```([^\n`]*)\n?([\s\S]*)$/m;
  const lastFence = s.search(/^```[^\n`]*$/m) === -1 ? -1 : s.lastIndexOf("\n```");
  const atStart = s.startsWith("```") ? 0 : (lastFence === -1 ? -1 : lastFence + 1);
  if (atStart !== -1) {
    const m = s.slice(atStart).match(fenceLineRe);
    if (m) {
      blocks.push({ lang: m[1], code: m[2] });
      s = s.slice(0, atStart) + MD_BLOCK + (blocks.length - 1) + MD_BLOCK;
    }
  }
  /* group sibling html/css/js blocks (adjacent, separated only by blank
     lines / whitespace in the source) so a split multi-file answer still
     gets a working combined preview, not just the bare <html> block alone */
  const orderedIdx = [...s.matchAll(new RegExp(MD_BLOCK + "(\\d+)" + MD_BLOCK, "g"))].map(m => +m[1]);
  const between = [...s.split(new RegExp(MD_BLOCK + "(?:\\d+)" + MD_BLOCK))];
  const previewGroups = {}; // html block index -> combined srcdoc-ready HTML
  for (let i = 0; i < orderedIdx.length; i++) {
    const idx = orderedIdx[i];
    const lang = (blocks[idx].lang || "").split(":")[0].toLowerCase();
    if (lang !== "html" && lang !== "htm") continue;
    let css = "", js = "", j = i + 1;
    while (j < orderedIdx.length && /^\s*$/.test(between[j] || "")) {
      const nLang = (blocks[orderedIdx[j]].lang || "").split(":")[0].toLowerCase();
      if (nLang === "css") { css += blocks[orderedIdx[j]].code + "\n"; j++; }
      else if (nLang === "javascript" || nLang === "js") { js += blocks[orderedIdx[j]].code + "\n"; j++; }
      else break;
    }
    if (css || js) {
      let doc = blocks[idx].code;
      if (css) {
        doc = /<\/head>/i.test(doc)
          ? doc.replace(/<\/head>/i, "<style>\n" + css + "</style>\n</head>")
          : "<style>\n" + css + "</style>\n" + doc;
      }
      if (js) {
        doc = /<\/body>/i.test(doc)
          ? doc.replace(/<\/body>/i, "<script>\n" + js + "</script>\n</body>")
          : doc + "\n<script>\n" + js + "</script>";
      }
      previewGroups[idx] = doc;
    }
  }

  s = escapeHtml(s);

  const lines = s.split("\n");
  let html = "", listType = null, para = [], bq = [], defs = [];

  const flushPara = () => {
    if (para.length) {
      html += "<p>" + para.map(mdInline).join("<br>") + "</p>";
      para = [];
    }
  };
  const closeList = () => {
    if (listType) { html += "</" + listType + ">"; listType = null; }
  };
  const flushBq = () => {
    if (bq.length) {
      const head = bq[0].match(/^\[!(\w+)\]\s*(.*)/i);
      if (head && CALLOUT_TYPES[head[1].toLowerCase()]) {
        const type = head[1].toLowerCase();
        const meta = CALLOUT_TYPES[type];
        const rest = [head[2], ...bq.slice(1)].filter(l => l !== "");
        html += '<div class="callout callout-' + type + '"><div class="callout-head">' +
          icon(meta.icon) + "<span>" + meta.label + "</span></div><div class=\"callout-body\">" +
          (rest.length ? rest.map(mdInline).join("<br>") : "") + "</div></div>";
      } else {
        html += "<blockquote>" + bq.map(mdInline).join("<br>") + "</blockquote>";
      }
      bq = [];
    }
  };
  const flushDefs = () => {
    if (defs.length) {
      html += "<dl>" + defs.map(d => "<dt>" + mdInline(d.term) + "</dt><dd>" + mdInline(d.def) + "</dd>").join("") + "</dl>";
      defs = [];
    }
  };
  const flushAll = () => { flushPara(); closeList(); flushBq(); flushDefs(); };

  const blockRe = new RegExp("^\\s*" + MD_BLOCK + "(\\d+)" + MD_BLOCK + "\\s*$");
  const tableSepRe = /^\s*\|?[\s:|-]+\|?\s*$/;
  const parseRow = l =>
    l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(c => mdInline(c.trim()));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const cb = line.match(blockRe);
    if (cb) {
      flushAll();
      const block = blocks[+cb[1]];
      const lang = block.lang || "";
      if (/^chart(:progress)?$/.test(lang)) html += chartBlockHtml(block);
      else if (lang === "timeline") html += timelineBlockHtml(block);
      else if (/^details:?/i.test(lang)) html += detailsBlockHtml(block, lang);
      else if (lang === "poll" || lang === "choices") html += pollBlockHtml(block);
      else if (lang === "story" || lang === "poem") html += proseBlockHtml(block, lang);
      else if (lang === "math") html += mathBlockHtml(block);
      else if (lang === "calc") html += calcBlockHtml(block);
      else if (/^stats(:bar)?$/.test(lang)) html += statsBlockHtml(block);
      else if (lang === "tabs") html += tabsBlockHtml(block);
      else if (lang === "roll" || lang === "dice") html += rollBlockHtml(block);
      else if (/^rate:?/i.test(lang)) html += rateBlockHtml(block, lang);
      else if (/^compare:?/i.test(lang)) html += compareBlockHtml(block, lang);
      else if (/^quote:?/i.test(lang)) html += quoteBlockHtml(block, lang);
      else if (lang === "checklist") html += checklistBlockHtml(block);
      else if (/^reveal:?/i.test(lang)) html += revealBlockHtml(block, lang);
      else if (lang === "faq") html += faqBlockHtml(block);
      else if (lang === "steps") html += stepsBlockHtml(block);
      else if (/^fields:?/i.test(lang)) html += fieldsBlockHtml(block, lang);
      else if (/^(pros|cons)\s*:?/i.test(lang)) html += prosConsBlockHtml(block, lang);
      else if (/^(tldr|summary|takeaway)\s*:?/i.test(lang)) html += tldrBlockHtml(block, lang);
      else if (/^(keys?|shortcuts?|hotkeys?)\s*:?/i.test(lang)) html += keysBlockHtml(block, lang);
      else if (/^(define|def|glossary|term)\s*:?/i.test(lang)) html += defineBlockHtml(block, lang);
      else if (/^game:?/i.test(lang)) html += gameBlockHtml(block, lang);
      else html += codeBlockHtml(block, previewGroups[+cb[1]]);
      continue;
    }

    if (/^\s*$/.test(line)) { flushAll(); continue; }

    /* tables: a |-row followed by a separator row of dashes */
    if (line.includes("|") && i + 1 < lines.length &&
        lines[i + 1].includes("-") && tableSepRe.test(lines[i + 1])) {
      flushAll();
      const head = parseRow(line);
      html += '<div class="tbl-wrap"><table><thead><tr>' +
        head.map(h => "<th>" + h + "</th>").join("") + "</tr></thead><tbody>";
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        html += "<tr>" + parseRow(lines[i]).map(c => "<td>" + c + "</td>").join("") + "</tr>";
        i++;
      }
      i--; // loop increment compensates
      html += "</tbody></table></div>";
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      flushAll();
      const lvl = h[1].length;
      html += "<h" + lvl + ">" + mdInline(h[2]) + "</h" + lvl + ">";
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flushAll(); html += "<hr>"; continue; }

    const bqm = line.match(/^&gt;\s?(.*)/);
    if (bqm) { flushPara(); closeList(); flushDefs(); bq.push(bqm[1]); continue; }
    flushBq();

    const dm = line.match(/^\s*([^:\n]{1,60}?)::\s+(.*)/);
    if (dm) { flushPara(); closeList(); defs.push({ term: dm[1], def: dm[2] }); continue; }
    flushDefs();

    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      flushPara();
      const t = ul ? "ul" : "ol";
      if (listType !== t) { closeList(); html += "<" + t + ">"; listType = t; }
      const content = (ul || ol)[1];
      /* task list items: - [ ] and - [x] */
      const task = content.match(/^\[( |x|X)\]\s+(.*)/);
      if (task) {
        const done = task[1] !== " ";
        html += '<li class="task"><span class="cb' + (done ? " on" : "") + '">' +
          (done ? icon("check", null, true) : "") + "</span>" +
          (done ? "<s>" + mdInline(task[2]) + "</s>" : mdInline(task[2])) + "</li>";
      } else {
        html += "<li>" + mdInline(content) + "</li>";
      }
      continue;
    }

    para.push(line);
  }
  flushAll();

  /* a placeholder can survive inside a paragraph (unclosed fence etc.) */
  html = html.replace(new RegExp(MD_BLOCK + "(\\d+)" + MD_BLOCK, "g"),
    (m, i) => codeBlockHtml(blocks[+i]));
  return html;
}
