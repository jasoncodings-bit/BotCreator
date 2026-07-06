"use strict";
/* ============================================================
   More common fenced block types (kept out of markdown.js /
   blocks2.js per the project's "new feature = new file" rule):
   ```faq```, ```steps```, ```fields```, ```pros``` / ```cons```.
   These cover the everyday shapes that show up in most
   conversations (Q&A, how-to sequences, labelled info, and
   pro/con weigh-ups) so bots reach for a clean card instead of
   a wall of prose. Dispatched from renderMarkdown()'s
   block-type switch in js/markdown.js.
   ============================================================ */

/* ---------------- fenced faq blocks ----------------
   ```faq
   Q: How do I reset my password?
   A: Open Settings, then click "Reset password".
   Q: Is my data stored anywhere?
   A: No — everything stays in your browser's localStorage.
   ```
   pairs each "Q:" line with the "A:" line(s) that follow it into
   a click-to-expand question/answer accordion. A line with no
   "Q:"/"A:" prefix continues the current answer. Great for
   help/support answers, "common questions", cheat-sheets. */
let faqCounter = 0;
function parseFaqLines(code) {
  const items = [];
  let cur = null;
  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const q = line.match(/^Q(?:uestion)?\s*[:.)]\s*(.*)/i);
    if (q) {
      if (cur) items.push(cur);
      cur = { q: q[1].trim(), a: [] };
      continue;
    }
    const a = line.match(/^A(?:nswer)?\s*[:.)]\s*(.*)/i);
    if (a) {
      if (!cur) cur = { q: "", a: [] };
      if (a[1].trim()) cur.a.push(a[1].trim());
      continue;
    }
    if (cur) cur.a.push(line);
  }
  if (cur) items.push(cur);
  return items.filter(it => it.q || it.a.length);
}

function faqBlockHtml(block) {
  const items = parseFaqLines(block.code);
  if (!items.length) return codeBlockHtml(block);
  const gid = "faq-" + (faqCounter++);
  const rows = items.map((it, i) =>
    '<div class="faq-item" data-faq="' + gid + '" data-index="' + i + '" data-open="false">' +
    '<button class="faq-q" type="button" data-faq-toggle="' + gid + '" data-index="' + i + '">' +
    '<span class="faq-q-text">' + mdInline(escapeHtml(it.q || "Question")) + "</span>" +
    '<span class="faq-chevron">' + icon("chevron-down") + "</span></button>" +
    '<div class="faq-a" hidden>' + (it.a.length ? renderMarkdown(it.a.join("\n")) : "") + "</div></div>"
  ).join("");
  return '<div class="faqblock" data-faq-group="' + gid + '">' + rows + "</div>";
}

/* ---------------- fenced steps blocks ----------------
   ```steps
   Preheat the oven to 200C.
   Chop the vegetables while it heats.
   Toss everything in oil and roast for 25 minutes.
   ```
   an ordered how-to flow with big numbered markers and a
   connecting spine down the left — distinct from ```timeline```
   (event/date log) and a plain "1." list (no visual sequence).
   A line ending in ":" becomes a bold sub-heading for the step
   that follows it. */
function parseStepsLines(code) {
  const steps = [];
  for (const raw of code.split("\n")) {
    let line = raw.trim();
    if (!line) continue;
    // tolerate the model prefixing its own "1." / "Step 1:" numbering
    line = line.replace(/^(?:step\s*)?\d+\s*[:.)-]\s*/i, "").trim();
    if (!line) continue;
    steps.push(line);
  }
  return steps;
}

function stepsBlockHtml(block) {
  const steps = parseStepsLines(block.code);
  if (!steps.length) return codeBlockHtml(block);
  const rows = steps.map((text, i) =>
    '<div class="step-item">' +
    '<div class="step-num">' + (i + 1) + "</div>" +
    '<div class="step-body">' + mdInline(escapeHtml(text)) + "</div></div>"
  ).join("");
  return '<div class="stepsblock">' + rows + "</div>";
}

/* ---------------- fenced fields blocks ----------------
   ```fields: Order #1042
   Status: Shipped
   Carrier: DHL
   Estimated delivery: Tuesday
   ```
   a clean labelled info card — one "Label: value" per line — for
   summarising structured facts (a profile, an order, specs, a
   character sheet) without the big-number weight of ```stats```.
   The optional ": Title" after the fence renders as a card
   header. A line with no ":" becomes a full-width note. */
function parseFieldsLines(code) {
  const rows = [];
  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx > 0) {
      rows.push({ label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() });
    } else {
      rows.push({ note: line });
    }
  }
  return rows;
}

function fieldsBlockHtml(block, lang) {
  const m = lang.match(/^fields:?\s*(.*)$/i);
  const title = (m && m[1].trim()) || "";
  const rows = parseFieldsLines(block.code);
  if (!rows.length) return codeBlockHtml(block);
  const body = rows.map(r => r.note
    ? '<div class="field-note">' + mdInline(escapeHtml(r.note)) + "</div>"
    : '<div class="field-row"><span class="field-label">' + mdInline(escapeHtml(r.label)) +
      '</span><span class="field-value">' + mdInline(escapeHtml(r.value)) + "</span></div>"
  ).join("");
  return '<div class="fieldsblock">' +
    (title ? '<div class="fields-head">' + escapeHtml(title) + "</div>" : "") +
    '<div class="fields-body">' + body + "</div></div>";
}

/* ---------------- fenced pros / cons blocks ----------------
   ```pros: Remote work
   No commute
   Flexible hours
   Fewer distractions
   ```
   ```cons
   Easy to overwork
   Less face-to-face time
   ```
   a single-sided weigh-up card — green ticks for ```pros```, red
   crosses for ```cons``` — for when you want the plus OR minus
   side on its own (use ```compare``` when you want both columns
   side by side). The optional ": Heading" sets the card title. */
function prosConsBlockHtml(block, lang) {
  const m = lang.match(/^(pros|cons)\s*:?\s*(.*)$/i);
  const kind = (m && m[1].toLowerCase()) || "pros";
  const title = (m && m[2].trim()) || (kind === "pros" ? "Pros" : "Cons");
  const items = block.code.split("\n").map(l => l.trim()).filter(Boolean);
  if (!items.length) return codeBlockHtml(block);
  const mark = kind === "pros" ? "check" : "x";
  const rows = items.map(text =>
    '<div class="pc-item"><span class="pc-mark">' + icon(mark) + "</span>" +
    '<span class="pc-text">' + mdInline(escapeHtml(text)) + "</span></div>"
  ).join("");
  return '<div class="prosconsblock pc-' + kind + '">' +
    '<div class="pc-head">' + escapeHtml(title) + "</div>" +
    '<div class="pc-body">' + rows + "</div></div>";
}

/* ---------------- fenced tldr blocks ----------------
   ```tldr
   Cache invalidation is hard because you can't tell a stale
   value from a fresh one without asking the source.
   ```
   a single highlighted "the one thing to remember" takeaway box
   with a lightbulb marker — distinct from a > [!note] callout in
   that it's framed as THE key summary of a long answer. An
   optional ": Label" overrides the "TL;DR" tag. */
function tldrBlockHtml(block, lang) {
  const m = lang.match(/^(?:tldr|summary|takeaway)\s*:?\s*(.*)$/i);
  const label = (m && m[1].trim()) || "TL;DR";
  const text = block.code.trim();
  if (!text) return codeBlockHtml(block);
  return '<div class="tldrblock"><div class="tldr-tag">' + icon("lightbulb") +
    "<span>" + escapeHtml(label) + "</span></div>" +
    '<div class="tldr-body">' + renderMarkdown(text) + "</div></div>";
}

/* ---------------- fenced keys blocks ----------------
   ```keys
   Save file: Ctrl+S
   Find: Ctrl+F
   Undo: Ctrl+Z
   ```
   a keyboard-shortcut reference — "Action: Key+Combo" per line —
   rendering each key combo as real <kbd> chips. The optional
   ": Title" after the fence renders as a header. */
function keysBlockHtml(block, lang) {
  const m = lang.match(/^(?:keys?|shortcuts?|hotkeys?)\s*:?\s*(.*)$/i);
  const title = (m && m[1].trim()) || "";
  const rows = [];
  for (const raw of block.code.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.lastIndexOf(":");
    if (idx < 0) continue;
    const action = line.slice(0, idx).trim();
    const combo = line.slice(idx + 1).trim();
    if (!action || !combo) continue;
    const chips = combo.split(/\s*\+\s*/).map(k =>
      "<kbd>" + escapeHtml(k) + "</kbd>").join('<span class="key-plus">+</span>');
    rows.push('<div class="key-row"><span class="key-action">' +
      mdInline(escapeHtml(action)) + '</span><span class="key-combo">' + chips + "</span></div>");
  }
  if (!rows.length) return codeBlockHtml(block);
  return '<div class="keysblock">' +
    (title ? '<div class="keys-head">' + escapeHtml(title) + "</div>" : "") +
    '<div class="keys-body">' + rows.join("") + "</div></div>";
}

/* ---------------- fenced define blocks ----------------
   ```define: Recursion
   A function that calls itself to solve a smaller instance of
   the same problem, until it hits a base case.
   ```
   a glossary card for "what is X?" answers — the term after the
   colon becomes a heading, the body is its definition. Cleaner
   and more memorable than a plain paragraph for a single term. */
function defineBlockHtml(block, lang) {
  const m = lang.match(/^(?:define|def|glossary|term)\s*:?\s*(.*)$/i);
  const term = (m && m[1].trim()) || "";
  const text = block.code.trim();
  if (!term && !text) return codeBlockHtml(block);
  return '<div class="defineblock"><div class="define-term">' + icon("book-open") +
    "<span>" + escapeHtml(term || "Definition") + "</span></div>" +
    (text ? '<div class="define-body">' + renderMarkdown(text) + "</div>" : "") +
    "</div>";
}
