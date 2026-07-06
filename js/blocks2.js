"use strict";
/* ============================================================
   Extra fenced block types (kept out of markdown.js per the
   project's "new feature = new file" rule): ```compare```,
   ```quote```, ```checklist```, ```reveal```. Dispatched from
   renderMarkdown()'s block-type switch in js/markdown.js.
   ============================================================ */

/* ---------------- fenced compare blocks ----------------
   ```compare: Cats | Dogs
   Independent | Loyal
   Low maintenance | Needs walks
   Quiet | Playful
   ```
   header after "compare:" splits on "|" into two column titles;
   each body line splits the same way into a row. Lines with no
   "|" become a full-width note row. */
function parseCompareLines(code) {
  const rows = [];
  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.includes("|")) {
      const parts = line.split("|").map(s => s.trim());
      rows.push({ left: parts[0] || "", right: parts[1] || "" });
    } else {
      rows.push({ note: line });
    }
  }
  return rows;
}

function compareBlockHtml(block, lang) {
  const m = lang.match(/^compare:?\s*(.*)$/i);
  const header = (m && m[1].trim()) || "";
  const [leftTitle, rightTitle] = header.includes("|")
    ? header.split("|").map(s => s.trim())
    : ["A", "B"];
  const rows = parseCompareLines(block.code);
  if (!rows.length) return codeBlockHtml(block);
  const body = rows.map(r => r.note
    ? '<div class="cmp-note">' + escapeHtml(r.note) + "</div>"
    : '<div class="cmp-row"><div class="cmp-cell cmp-left">' + escapeHtml(r.left) +
      '</div><div class="cmp-cell cmp-right">' + escapeHtml(r.right) + "</div></div>"
  ).join("");
  return '<div class="compareblock"><div class="cmp-head"><span class="cmp-title cmp-left">' +
    escapeHtml(leftTitle) + '</span><span class="cmp-vs">' + icon("arrow-right") +
    '</span><span class="cmp-title cmp-right">' + escapeHtml(rightTitle) + "</span></div>" +
    '<div class="cmp-body">' + body + "</div></div>";
}

/* ---------------- fenced quote blocks ----------------
   ```quote: Marcus Aurelius
   The happiness of your life depends upon the quality of
   your thoughts.
   ```
   big styled quotation mark + the quoted text; the optional
   ": Attribution" suffix on the fence line renders as a byline. */
function quoteBlockHtml(block, lang) {
  const m = lang.match(/^quote:?\s*(.*)$/i);
  const attribution = (m && m[1].trim()) || "";
  const text = block.code.trim();
  if (!text) return codeBlockHtml(block);
  return '<div class="quoteblock"><div class="quote-mark">' + icon("quote") + "</div>" +
    '<div class="quote-body">' + mdInline(escapeHtml(text)) + "</div>" +
    (attribution ? '<div class="quote-attr">' + escapeHtml(attribution) + "</div>" : "") +
    "</div>";
}

/* ---------------- fenced checklist blocks ----------------
   ```checklist
   Pack sunscreen
   Charge camera
   Book campsite
   ```
   like a task list, but each item is independently clickable in
   the DOM (persists only in-message, not saved to storage) and
   shows a live "N/total done" progress readout — good for
   recipes, packing lists, step-by-step instructions. */
let checklistCounter = 0;
function checklistBlockHtml(block) {
  const items = block.code.split("\n").map(l => l.trim()).filter(Boolean);
  if (!items.length) return codeBlockHtml(block);
  const gid = "checklist-" + (checklistCounter++);
  const rows = items.map((text, i) =>
    '<button class="checklist-item" type="button" data-checklist="' + gid + '" data-index="' + i + '">' +
    '<span class="checklist-box">' + icon("check") + '</span>' +
    '<span class="checklist-text">' + escapeHtml(text) + "</span></button>"
  ).join("");
  return '<div class="checklistblock" data-checklist-group="' + gid + '">' +
    '<div class="checklist-progress"><span class="checklist-done">0</span>/' + items.length + " done</div>" +
    '<div class="checklist-items">' + rows + "</div></div>";
}

/* ---------------- fenced reveal blocks ----------------
   ```reveal: What's behind the door?
   A sleeping dragon, curled around a pile of gold.
   ```
   a dramatic click-to-flip card for plot twists, riddle answers,
   surprises — distinct from ```details``` (plain collapsible) and
   ||spoiler|| (inline word-level blur): this is a full block-level
   flourish with a flip transition. */
let revealCounter = 0;
function revealBlockHtml(block, lang) {
  const m = lang.match(/^reveal:?\s*(.*)$/i);
  const prompt = (m && m[1].trim()) || "Click to reveal";
  const id = "reveal-" + (revealCounter++);
  return '<div class="revealblock" id="' + id + '" data-revealed="false">' +
    '<button class="reveal-front" type="button" data-target="' + id + '">' +
    icon("sparkles") + "<span>" + escapeHtml(prompt) + "</span></button>" +
    '<div class="reveal-back" hidden>' + renderMarkdown(block.code) + "</div></div>";
}
