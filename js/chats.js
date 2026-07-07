"use strict";
/* ============================================================
   Chat view: sessions, message rendering, streaming,
   regenerate / edit / delete message actions
   ============================================================ */

/* ---------- opening chats & sessions ---------- */

function openBotChat(botId) {
  const sessions = DB.botSessions(botId);
  if (sessions.length) openSession(sessions[0].id);
  else openSession(DB.createSession(botId).id);
}

function openSession(sessionId) {
  const s = DB.session(sessionId);
  if (!s) return;
  /* generation for the chat being LEFT keeps running in the background
     (see the Generations map above) — nothing to stop here. */
  State.view = "chat";
  State.botId = s.botId;
  State.sessionId = sessionId;

  /* if this session has a generation still running in the background,
     reattach to its live (in-memory, not-yet-persisted) message array
     instead of re-reading from disk, so the still-streaming reply isn't
     lost or duplicated. */
  const gen = Generations.get(sessionId);
  State.msgs = (gen && gen.msgs) ? gen.msgs : DB.getMsgs(sessionId);
  State.tempOverride = null;
  State.systemOverride = null;
  clearPendingImage();
  closeHistoryPopover();
  closeModePopover();

  /* game bots (Tic-Tac-Toe, Hangman, etc.) show their board as the very
     first message rather than plain greeting text — seed it once, the
     first time this session is opened */
  const bot = DB.bot(s.botId);
  if (!State.msgs.length && isGameBot(bot)) {
    s.gameState = { game: bot.game, state: GAMES[bot.game].init(), turn: "user", over: false };
    DB.saveSessions();
    State.msgs.push({ id: uid("m"), role: "assistant", content: stampGameFence(bot.game, s.gameState), ts: Date.now() });
    DB.saveMsgs(sessionId, State.msgs);
  }

  showView();
  renderChatHeader();
  renderMessages();
  renderSidebar();
  renderModeButton();
  setSendButton(!!gen);
  if (gen && gen.attachDom) gen.attachDom();
  $("msg-input").focus();
}

function newChat() {
  if (!State.botId) return;
  const s = DB.createSession(State.botId);
  openSession(s.id);
  toast("New chat started");
}

function renderChatHeader() {
  const bot = DB.bot(State.botId), s = DB.session(State.sessionId);
  if (!bot || !s) return;
  const holder = $("chat-avatar-holder");
  holder.innerHTML = "";
  holder.appendChild(avatarNode(bot, "md"));
  $("chat-name").textContent = bot.name;
  $("chat-session-title").textContent = s.title;
}

/* ---------- chat mode popover ---------- */
/* per-session "mode" lock (Code/Writing/Thinking/Concise/Auto) — picked
   from a small icon button to the left of the message input, persisted
   on the session record, and appended to the system prompt in
   buildApiMessages() (see js/modes.js for the mode list/instructions) */

function currentMode() {
  const s = DB.session(State.sessionId);
  return (s && CHAT_MODES[s.mode]) ? s.mode : "auto";
}

function renderModeButton() {
  const btn = $("mode-btn");
  const mode = CHAT_MODES[currentMode()];
  btn.innerHTML = icon(mode.icon);
  btn.title = mode.label + " — click to change chat mode";
  btn.classList.toggle("active", currentMode() !== "auto");
}

function toggleModePopover() {
  const pop = $("mode-popover");
  if (pop.hidden) renderModePopover();
  pop.hidden = !pop.hidden;
}
function closeModePopover() { $("mode-popover").hidden = true; }

function renderModePopover() {
  const pop = $("mode-popover");
  pop.innerHTML = "";
  const active = currentMode();
  for (const key of CHAT_MODE_ORDER) {
    const m = CHAT_MODES[key];
    const row = el("button", "mode-row" + (key === active ? " active" : ""));
    row.type = "button";
    row.innerHTML = icon(m.icon) +
      '<span class="mode-row-text"><span class="mode-row-label">' + m.label +
      '</span><span class="mode-row-hint">' + m.hint + "</span></span>";
    row.onclick = () => setChatMode(key);
    pop.appendChild(row);
  }
}

function setChatMode(key) {
  const s = DB.session(State.sessionId);
  if (!s) return;
  s.mode = key;
  DB.saveSessions();
  renderModeButton();
  closeModePopover();
  toast(CHAT_MODES[key].label + " active");
}

/* ---------- history popover ---------- */

function toggleHistoryPopover() {
  const pop = $("history-popover");
  if (pop.hidden) renderHistoryPopover();
  pop.hidden = !pop.hidden;
}
function closeHistoryPopover() { $("history-popover").hidden = true; }

function renderHistoryPopover() {
  const pop = $("history-popover");
  pop.innerHTML = "";

  const newBtn = iconBtn("plus", "pop-new", "Start a fresh chat", "New Chat", true);
  newBtn.onclick = newChat;
  pop.appendChild(newBtn);

  for (const s of DB.botSessions(State.botId)) {
    const row = el("div", "pop-row" + (s.id === State.sessionId ? " active" : ""));
    const title = el("span", "pop-title", s.title);
    title.title = s.title;
    row.appendChild(title);
    row.appendChild(el("span", "pop-time", timeAgo(s.updatedAt)));

    const ren = iconBtn("edit", "pop-act", "Rename");
    ren.onclick = e => { e.stopPropagation(); startRenameSession(s, row, title); };
    row.appendChild(ren);

    const del = iconBtn("trash", "pop-act del", "Delete chat", null, true);
    del.onclick = e => { e.stopPropagation(); deleteSessionUI(s.id); };
    row.appendChild(del);

    row.onclick = () => openSession(s.id);
    pop.appendChild(row);
  }
}

function startRenameSession(s, row, titleEl) {
  const input = el("input", "pop-rename-input");
  input.type = "text";
  input.value = s.title;
  input.maxLength = 60;
  row.replaceChild(input, titleEl);
  input.focus();
  input.select();
  const commit = () => {
    const v = input.value.trim();
    if (v) {
      s.title = v;
      DB.saveSessions();
      if (s.id === State.sessionId) renderChatHeader();
      renderSidebar();
    }
    renderHistoryPopover();
  };
  input.onkeydown = e => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") { input.onblur = null; renderHistoryPopover(); }
    e.stopPropagation();
  };
  input.onblur = commit;
  input.onclick = e => e.stopPropagation();
}

async function deleteSessionUI(id) {
  if (!await appConfirm("Its messages will be gone forever.", { title: "Delete this chat?" })) return;
  const wasActive = State.sessionId === id;
  const botId = DB.session(id)?.botId;
  DB.deleteSession(id);
  toast("Chat deleted");
  stopGenerationFor(id);
  if (wasActive) {
    State.sessionId = null;
    State.msgs = [];
    openBotChat(botId); // opens most recent remaining session or a fresh one
  } else {
    renderSidebar();
    if (State.view === "chat" && !$("history-popover").hidden) renderHistoryPopover();
    if (State.view === "home") renderHome();
  }
}

/* ---------- message rendering ---------- */

function isNearBottom() {
  const b = $("messages");
  return b.scrollHeight - b.scrollTop - b.clientHeight < 140;
}
function scrollBottom() {
  const b = $("messages");
  b.scrollTop = b.scrollHeight;
  updateScrollBtn();
}
/* only autoscroll while streaming if the user hasn't scrolled up to read */
function scrollBottomIfNear() {
  if (!State.userScrolledUp) scrollBottom();
}
function updateScrollBtn() {
  const btn = $("scroll-bottom-btn");
  if (!btn) return;
  const show = !isNearBottom();
  State.userScrolledUp = show;
  btn.classList.toggle("show", show);
}

function renderMessages() {
  const bot = DB.bot(State.botId);
  const box = $("messages");
  box.innerHTML = "";
  if (!bot) return;
  const s = DB.session(State.sessionId);
  if (typeof syncGameState === "function") syncGameState();
  if (bot.greeting) {
    box.appendChild(msgNode(
      { role: "assistant", content: bot.greeting, ts: s ? s.createdAt : Date.now(), greeting: true },
      -1, bot));
  }
  /* only the most recent bot message may show a clickable/live game board —
     older ```game``` fences in history render as a frozen snapshot */
  let lastGameIdx = -1;
  if (isGameBot(bot)) {
    for (let i = State.msgs.length - 1; i >= 0; i--) {
      if (State.msgs[i].role === "assistant" && !State.msgs[i].error) { lastGameIdx = i; break; }
    }
  }
  State.msgs.forEach((m, i) => box.appendChild(msgNode(m, i, bot, i === lastGameIdx)));
  if (box.lastElementChild) box.lastElementChild.classList.add("msg-enter");
  scrollBottom();
}

function msgNode(m, i, bot, gameInteractive) {
  if (m.local) return localMsgNode(m, i);
  const isUser = m.role === "user";
  const wrap = el("div", "msg " + (isUser ? "user" : "bot"));
  if (i >= 0) wrap.dataset.idx = i;
  if (!isUser) wrap.appendChild(avatarNode(bot, "sm"));

  const col = el("div", "msg-col");
  const bubble = el("div", "msg-bubble" + (m.error ? " error" : ""));
  if (isUser || m.error) {
    if (m.image) {
      const thumb = el("img", "msg-image");
      thumb.src = m.image;
      thumb.alt = "";
      bubble.appendChild(thumb);
    }
    if (m.content) bubble.appendChild(el("div", "msg-image-text", m.content));
  } else {
    State.gameBlockInteractive = !!gameInteractive;
    bubble.innerHTML = renderMarkdown(m.content);
    State.gameBlockInteractive = false;
    animateRolls(bubble);
  }
  bubble.title = m.ts ? new Date(m.ts).toLocaleString() : "";
  col.appendChild(bubble);

  if (!m.greeting && i >= 0) {
    const meta = el("div", "msg-meta");

    const act = el("div", "msg-actions");
    const mkBtn = (name, title, fn) => {
      const b = iconBtn(name, "", title);
      b.onclick = fn;
      act.appendChild(b);
    };
    mkBtn("copy", "Copy", () => copyText(m.content));
    if (isUser) mkBtn("edit", "Edit & resend", () => editUserMessage(i));
    mkBtn("trash", "Delete message", () => deleteMessage(i));
    meta.appendChild(act);

    const info = el("div", "msg-info");
    if (m.stats) info.appendChild(el("span", "", m.stats.tok + " tok · " + m.stats.tps + "/s"));
    if (m.ts) info.appendChild(el("span", "", new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })));
    meta.appendChild(info);

    col.appendChild(meta);
  }

  wrap.appendChild(col);
  return wrap;
}

/* local system-note bubble for slash-command feedback (/help, /clear, etc.) —
   never sent to the model, see the `local` filter in buildApiMessages() */
function localMsgNode(m, i) {
  const wrap = el("div", "msg local" + (m.error ? " error" : ""));
  if (i >= 0) wrap.dataset.idx = i;
  const bubble = el("div", "msg-bubble");
  bubble.innerHTML = renderMarkdown(m.content);
  wrap.appendChild(bubble);
  return wrap;
}

/* ---------- image attachment ---------- */

async function attachImageFile(file) {
  try {
    const dataUrl = await resizeImageFile(file, 1024);
    State.pendingImage = dataUrl;
    $("image-attach-thumb").src = dataUrl;
    $("image-attach-preview").hidden = false;
  } catch (e) {
    toast(e.message || "Couldn't read that image");
  }
}

function clearPendingImage() {
  State.pendingImage = null;
  $("image-attach-preview").hidden = true;
  $("image-attach-thumb").src = "";
}

/* ---------- sending & streaming ---------- */

function setSendButton(stop) {
  const b = $("send-btn");
  b.classList.toggle("stop", stop);
  b.innerHTML = icon(stop ? "stop" : "send");
  b.title = stop ? "Stop generating" : "Send";
}

function autoGrow() {
  const input = $("msg-input");
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 42) + "px";
}

function persistMsgs() { persistMsgsFor(State.sessionId, State.msgs); }

function persistMsgsFor(sessionId, msgs) {
  DB.saveMsgs(sessionId, msgs);
  const s = DB.session(sessionId);
  if (!s) return;
  s.updatedAt = Date.now();
  const last = [...msgs].reverse().find(m => !m.local);
  s.snippet = last ? ((last.role === "user" ? "You: " : "") + last.content.slice(0, 60)) : "";
  if (s.title === "New Chat") {
    const firstUser = msgs.find(m => m.role === "user");
    if (firstUser) s.title = firstUser.content.slice(0, 42);
  }
  DB.saveSessions();
  if (isActiveSession(sessionId)) renderChatHeader();
  renderSidebar();
}

/* builds the character-only portion of the system prompt (no formatting instructions) —
   shared by buildApiMessages() and the bot editor's live prompt preview, so they never drift */
function buildCharacterPrompt(bot, persona) {
  let sys = bot.prompt || "You are a helpful assistant.";
  if (bot.traits) sys += "\n\nPersonality traits: " + bot.traits;
  if (bot.backstory) sys += "\n\nBackstory: " + bot.backstory;
  if (bot.speechStyle) sys += "\n\nSpeech style/quirks: " + bot.speechStyle;
  if (bot.likes) sys += "\n\nLikes: " + bot.likes;
  if (bot.dislikes) sys += "\n\nDislikes: " + bot.dislikes;
  if (bot.scenario) sys += "\n\nScenario: " + bot.scenario;
  if (bot.example) sys += "\n\nExample conversation showing your exact style:\n" + bot.example;
  if (persona) {
    sys += "\n\nThe user's name is " + persona.name + ".";
    if (persona.desc) sys += "\nAbout the user: " + persona.desc;
  }
  if (bot.nickname) sys += "\nYou like to call the user \"" + bot.nickname + "\".";
  return sys;
}

function buildApiMessages(botId, msgs, systemOverride) {
  botId = botId ?? State.botId;
  msgs = msgs ?? State.msgs;
  systemOverride = arguments.length > 2 ? systemOverride : State.systemOverride;
  const bot = DB.bot(botId);
  let sys = systemOverride || buildCharacterPrompt(bot, DB.activePersona());
  sys += "\n\nFormatting: whenever you write any multi-line code, a full snippet, a config file, or " +
    "anything meant to be copied/run/saved — ALWAYS wrap it in a triple-backtick fenced code block with " +
    "the language named right after the backticks (e.g. ```python or ```javascript), never as plain text " +
    "or inline `code` — fenced blocks get syntax highlighting plus working Copy and Save-to-file buttons " +
    "that plain text does not. Use inline `code` only for short inline references (a variable name, a " +
    "single command). " +
    "You can naturally use **bold**, *italic*, `code`, ==highlighted text==, " +
    "{green}success{/green}/{red}danger{/red}/{blue}info{/blue} colored text, [[Key]] for keyboard keys, " +
    "(pill: label) for small badges, tables, numbered/bulleted lists, task lists (- [ ]), " +
    "> [!note]/[!tip]/[!warning] callouts, ```chart``` bar charts, ```timeline``` step trackers " +
    "(e.g. \"Step 1: ...\" per line), Term:: definition lists, ```details: Summary text``` for a " +
    "click-to-expand section (put the hidden content on the lines inside), and ```poll``` or ```choices``` " +
    "with one option per line to offer the user clickable reply buttons (great for \"what should I do?\" " +
    "moments). Use ```stats``` (one \"Label: value\" per line) for a row of big number cards, or " +
    "```stats:bar``` (one \"Label: current/max\" per line) for HP/mana-style progress bars. Use ```tabs``` " +
    "with \"## Section Title\" lines to split content the user can click between instead of one long wall " +
    "of text. Use ```roll``` or ```dice``` (one dice notation like \"1d20\" or \"2d6+3\" per line) whenever " +
    "a dice roll or random chance is relevant — it animates and reveals a real result, don't just state a " +
    "number yourself. Use ```rate: your question``` with either a numeric range on the next line (e.g. " +
    "\"1-5\") or a comma-separated list of options (e.g. \"Easy, Medium, Hard\") to let the user pick an " +
    "answer with one click instead of typing. Use ```compare: Left Title | Right Title``` with one " +
    "\"left | right\" line per row to lay out a side-by-side comparison (pros/cons, A vs B, this vs that) " +
    "instead of a wall of prose — a line with no \"|\" renders as a full-width note. Use " +
    "```quote: Attribution``` for a standout quotation (a person, a book, a line worth setting apart) with " +
    "the quoted text on the lines inside and the speaker/source named after the colon. Use ```checklist``` " +
    "(one item per line) for packing lists, recipe steps, or any set of items the user might want to tick " +
    "off one at a time — each line becomes its own independently clickable checkbox with a live done-count. " +
    "Use ```reveal: a short teaser``` for a plot twist, riddle answer, or surprise — put the hidden payoff " +
    "on the lines inside; it shows only the teaser until clicked, then flips open with a flourish (use this " +
    "instead of ```details``` when the reveal itself is meant to feel dramatic, not just tucked away). " +
    "Use ```faq``` (one \"Q: question\" line followed by its \"A: answer\" line, repeated) for common " +
    "questions, help/support answers, or any set of question/answer pairs — each becomes a click-to-expand " +
    "item. Use ```steps``` (one instruction per line) for a how-to or ordered procedure — it renders as a " +
    "numbered flow with a connecting spine (prefer this over a plain \"1. 2. 3.\" list for real step-by-step " +
    "instructions). Use ```fields: Optional Title``` (one \"Label: value\" per line) to lay out structured " +
    "facts as a clean labelled card — a profile, an order summary, specs, a character sheet — when the values " +
    "are text rather than the big numbers ```stats``` is for. Use ```pros: Heading``` (one plus per line) " +
    "and/or ```cons: Heading``` (one minus per line) to weigh up one side on its own with green ticks or red " +
    "crosses (use ```compare``` instead when you want both sides in side-by-side columns). Use ```tldr``` " +
    "(a sentence or two inside) at the end of a long answer for the single key takeaway — the one thing to " +
    "remember — rendered as a highlighted lightbulb box. Use ```keys``` (one \"Action: Ctrl+S\" per line) to " +
    "list keyboard shortcuts — each combo renders as real key chips. Use ```define: Term``` (the definition " +
    "on the lines inside) for a \"what is X?\" answer, rendering the term as a glossary card. And " +
    "use ```story```/```poem``` blocks whenever the user asks " +
    "you to write a story, poem, script, " +
    "or other long-form creative writing — put ONLY the piece itself inside the fence (no extra commentary " +
    "inside it) so it renders as a clean, copyable card. For ANY math, ALWAYS use ```math``` fenced blocks " +
    "with this app's plain notation — NEVER LaTeX (no $, no \\frac{}{}, no \\times, no \\cdot, no backslash " +
    "commands of any kind, since they will NOT render and will show up as broken raw text). Inside a " +
    "```math``` block, one expression per line, write x^2 for exponents, sqrt(x) for roots, a/b for " +
    "fractions (e.g. 2/5 * 3/4, NOT \\frac{2}{5}\\times\\frac{3}{4}), and ```calc``` blocks (same plain " +
    "notation) when you want the app to actually compute and verify a numeric result for you. Use ```math``` " +
    "for ALL math, even a single short equation. " +
    "Any fenced code block automatically gets a Save-to-file download button (name the file by writing e.g. " +
    "```html:index.html``` or ```python:script.py``` right after the language), and a ```html``` block " +
    "additionally gets a live Preview button that renders the page right in the chat, plus an Expand button " +
    "that opens the same preview fullscreen (the app auto-focuses the preview so keyboard input reaches it " +
    "immediately — for anything with keyboard controls, like a game, attach listeners to window/document and " +
    "call preventDefault() on arrow keys/WASD/space so the page doesn't scroll, and always add a visible " +
    "on-screen restart/reset button, not just a keyboard shortcut). Prefer writing a " +
    "complete HTML page as ONE single ```html``` block with inline <style>/<script> when possible, since " +
    "that's the simplest and most reliable to preview/save. If you DO split into separate ```html```, " +
    "```css```, and ```javascript``` files (e.g. because the user asked for separate files), place them " +
    "immediately adjacent with no other text between them — the app automatically detects that pattern and " +
    "stitches the CSS/JS into the HTML preview, so the Preview button still works correctly either way. " +
    "Instead of emoji, prefer this app's own icon set with :name: syntax. There are almost 2000 icons " +
    "available, but stick close to this confirmed list rather than inventing exotic names — an unrecognized " +
    "name either falls back to a plain emoji automatically (for common everyday words) or, failing that, " +
    "prints as harmless plain text, so it's low-risk to try a plausible common word, but the list below is " +
    "guaranteed to render as a real icon: " +
    ":star: :heart: :check: :x: :plus: :minus: :arrow-right: :arrow-up: :flag: :pin: :rocket: :zap: " +
    ":settings: :search: :code: :terminal: :wifi: :battery: :camera: :mic: :sun: :moon: :cloud: :wind: " +
    ":flame: :droplet: :waves: :tree-deciduous: :palmtree: :mountain: :flower: :snowflake: :apple: :pizza: " +
    ":coffee: :cake: :egg: :salad: :cookie: :wheat: :bike: :car: :plane: :train: :ship: :gamepad: :dice-5: " +
    ":volleyball: :briefcase: :folder: :file: :mail: :calendar: :clock: :book: :pencil: :pen: :scissors: " +
    ":paperclip: :ruler: :calculator: :smile: :laugh: :frown: :angry: :meh: :brain: :thumbs-up: :handshake: " +
    ":user: :users: :hand: :sparkles: :gem: :crown: :key: :shield: :sword: :target: :lightbulb: " +
    ":circle-help: :alert-triangle: :info: :trophy: :medal: :award: :banknote: :wallet: :piggy-bank: " +
    ":backpack: :school: :graduation-cap: :link: :share-2: :bookmark: :map: :compass: :umbrella: " +
    ":thermometer: :pill: :stethoscope: :syringe: :bone: — since they render as crisp icons matching the " +
    "UI. Plain emoji you type will also auto-convert to the closest icon when one exists. When it " +
    "genuinely makes a reply " +
    "clearer, sprinkle these into normal conversation like a person texting with rich formatting, not just " +
    "when explicitly asked. Don't overdo it or force it into every message.";
  const modeInstruction = CHAT_MODES[currentMode()].instruction;
  if (modeInstruction) sys += "\n\n" + modeInstruction;
  const arr = [{ role: "system", content: sys }];
  if (bot.greeting) arr.push({ role: "assistant", content: bot.greeting });
  for (const m of msgs) {
    if (m.error || m.local) continue;
    if (m.image) {
      arr.push({
        role: m.role,
        content: [
          { type: "text", text: m.content || "" },
          { type: "image_url", image_url: { url: m.image } }
        ]
      });
    } else {
      arr.push({ role: m.role, content: m.content });
    }
  }
  return arr;
}

/* ---------- background generation ----------
   Keyed by sessionId so a reply keeps streaming/persisting even after
   the user navigates to another chat or Home — only the live DOM
   (#messages, State.msgs, the send/stop button) is gated behind
   "is this session still the one on screen", checked fresh on every
   delta/finish rather than once at the start. `msgs` is the same array
   reference generate() is appending to, and `reply`/`bot` let a chat
   reattach to a still-streaming reply if the user comes back mid-stream. */
const Generations = new Map();  // sessionId -> { abort, msgs, bot, reply }

function isActiveSession(sessionId) { return State.sessionId === sessionId; }

/* stops a specific session's background generation (used when deleting
   that chat) — distinct from stopGeneration(), which only ever stops
   whichever session is currently on screen (the stop button's target). */
function stopGenerationFor(sessionId) {
  const gen = Generations.get(sessionId);
  if (gen) gen.abort.abort();
}

async function sendMessage() {
  if (State.sessionId && Generations.has(State.sessionId)) { stopGeneration(); return; }
  const input = $("msg-input");
  const text = input.value.trim();
  const image = State.pendingImage;
  if ((!text && !image) || !State.sessionId) return;
  if (text.startsWith("/")) {
    input.value = "";
    autoGrow();
    closeCommandPopover();
    await runSlashCommand(text);
    return;
  }
  input.value = "";
  autoGrow();
  if (!image && await handleGameTextInput(text)) return;
  const msg = { id: uid("m"), role: "user", content: text, ts: Date.now() };
  if (image) msg.image = image;
  State.msgs.push(msg);
  clearPendingImage();
  persistMsgs();
  renderMessages();
  generate(State.sessionId, State.botId, State.msgs, State.tempOverride, State.systemOverride);
}

/* a reply that hit the token limit mid code-fence (odd number of ```)
   or was flagged "length" by the server is very likely cut off */
function looksCutOff(text, finishReason) {
  if (finishReason === "length") return true;
  const fences = (text.match(/^```/gm) || []).length;
  return fences % 2 === 1;
}

/* auto-continue asks the model to "continue where you left off", but
   despite that instruction some models restate the tail of what they
   already wrote instead of only adding new text — if the continuation's
   start overlaps with the end of what came before, drop the duplicate
   part rather than showing it twice. */
function dedupeContinuation(before, after) {
  const maxOverlap = Math.min(before.length, after.length, 400);
  for (let len = maxOverlap; len >= 20; len--) {
    if (before.slice(-len) === after.slice(0, len)) return after.slice(len);
  }
  return after;
}

const MAX_AUTO_CONTINUES = 3;

/* msgs/tempOverride/systemOverride are snapshotted at call time (the
   moment the user hits send/regenerate/edit, when this session is
   always the active one) so the request itself is unaffected by the
   user navigating elsewhere mid-stream. */
async function generate(sessionId, botId, msgs, tempOverride, systemOverride) {
  const bot = DB.bot(botId);
  if (!bot) return;
  let reply = "";
  let firstToken = true;

  /* (re)creates the streaming bubble DOM — called immediately if this
     session is on screen when generation starts, and again from
     openSession() if the user navigates back mid-stream. */
  const attachDom = () => {
    const box = $("messages");
    const wrap = el("div", "msg bot msg-enter");
    wrap.appendChild(avatarNode(bot, "sm"));
    const col = el("div", "msg-col");
    const bubble = el("div", "msg-bubble streaming");
    const cursor = el("span", "cursor");
    if (firstToken) {
      const typing = el("div", "typing");
      typing.innerHTML = "<span></span><span></span><span></span>";
      bubble.appendChild(typing);
      gen.typing = typing;
    } else {
      bubble.innerHTML = renderMarkdown(reply);
      bubble.appendChild(cursor);
    }
    col.appendChild(bubble);
    wrap.appendChild(col);
    box.appendChild(wrap);
    gen.bubble = bubble;
    gen.cursor = cursor;
    scrollBottom();
  };

  const gen = { abort: new AbortController(), msgs, bot, attachDom, bubble: null, cursor: null, typing: null };
  Generations.set(sessionId, gen);
  if (isActiveSession(sessionId)) { setSendButton(true); attachDom(); }

  let chunks = 0;
  const t0 = performance.now();

  /* live markdown preview while streaming: re-render at most once per
     animation frame (not on every token) so fast local models don't
     re-parse/re-paint dozens of times a second on heavy blocks like
     tables/tabs/compare. renderMarkdown() already tolerates an
     unterminated trailing fence, so a block still mid-typing (e.g. a
     ```compare``` that hasn't closed yet) just renders as an open code
     block until its closing ``` arrives, rather than breaking. */
  let renderScheduled = false;
  const scheduleRender = () => {
    if (renderScheduled || !isActiveSession(sessionId)) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      if (!isActiveSession(sessionId)) return;
      gen.bubble.innerHTML = renderMarkdown(reply);
      gen.bubble.appendChild(gen.cursor);
      scrollBottomIfNear();
    });
  };

  const onDelta = d => {
    if (firstToken) {
      firstToken = false;
      if (isActiveSession(sessionId)) { gen.typing.remove(); gen.bubble.appendChild(gen.cursor); }
    }
    reply += d;
    scheduleRender();
  };

  try {
    const temp = tempOverride ?? bot.temp ?? 0.8;
    let result = await streamChat({
      messages: buildApiMessages(botId, msgs, systemOverride),
      temperature: temp,
      topP: bot.topP,
      signal: gen.abort.signal,
      onDelta
    });
    chunks = result.chunks;

    let continues = 0;
    while (DB.settings.autoContinue && looksCutOff(reply, result.finishReason) &&
           continues < MAX_AUTO_CONTINUES) {
      continues++;
      const beforeContinue = reply;
      const contMessages = buildApiMessages(botId, msgs, systemOverride);
      contMessages.push({ role: "assistant", content: reply });
      contMessages.push({ role: "user", content: "Continue exactly where you left off. Do not repeat any earlier text, do not add commentary — just continue the response (e.g. finish the code block/file) from the exact cutoff point." });
      result = await streamChat({
        messages: contMessages,
        temperature: temp,
        topP: bot.topP,
        signal: gen.abort.signal,
        onDelta
      });
      chunks += result.chunks;

      /* strip an accidentally-repeated tail: dedupe against everything
         added by this continuation round, then re-render once so the
         user never sees the duplicate flash by even for one frame. */
      const deduped = beforeContinue + dedupeContinuation(beforeContinue, reply.slice(beforeContinue.length));
      if (deduped !== reply) {
        reply = deduped;
        if (isActiveSession(sessionId)) { gen.bubble.innerHTML = renderMarkdown(reply); gen.bubble.appendChild(gen.cursor); }
      }
    }

    Generations.delete(sessionId);
    finishReply(sessionId, msgs, reply, chunks, t0, false);
  } catch (err) {
    Generations.delete(sessionId);
    if (err.name === "AbortError") {
      finishReply(sessionId, msgs, reply, chunks, t0, true);
    } else {
      const hint = /Failed to fetch|NetworkError|load failed/i.test(err.message)
        ? "Can't reach the server at " + apiBase() +
          "\n\n• Is your AI model server running?\n• Check the URL in ⚙️ Settings.\n• If it IS running, it may need CORS enabled."
        : err.message;
      msgs.push({ id: uid("m"), role: "assistant", content: "⚠️ " + hint, ts: Date.now(), error: true });
      persistMsgsFor(sessionId, msgs);
      if (isActiveSession(sessionId)) renderMessages();
      checkConnection();
    }
  } finally {
    if (isActiveSession(sessionId)) setSendButton(false);
  }
}

function finishReply(sessionId, msgs, reply, chunks, t0, stopped) {
  if (reply) {
    const secs = Math.max(0.05, (performance.now() - t0) / 1000);
    const tok = chunks || Math.max(1, Math.round(reply.length / 4));
    msgs.push({
      id: uid("m"), role: "assistant", content: reply, ts: Date.now(),
      stats: { tok, tps: (tok / secs).toFixed(1) }
    });
  } else {
    msgs.push({
      id: uid("m"), role: "assistant", ts: Date.now(), error: true,
      content: stopped ? "(stopped)" : "(no response — is a model loaded on the server?)"
    });
  }
  persistMsgsFor(sessionId, msgs);
  if (isActiveSession(sessionId)) renderMessages();
}

function stopGeneration() {
  const gen = Generations.get(State.sessionId);
  if (gen) gen.abort.abort();
}

/* ---------- message actions ---------- */

/* export the open chat as a readable Markdown transcript */
function exportCurrentChat() {
  const bot = DB.bot(State.botId), s = DB.session(State.sessionId);
  if (!bot || !s) { toast("Open a chat first"); return; }
  const persona = DB.activePersona();
  const you = persona ? persona.name : "You";
  const lines = ["# " + bot.name + " — " + s.title, "", "_Exported " + new Date().toLocaleString() + "_", ""];
  if (bot.greeting) lines.push("**" + bot.name + ":** " + bot.greeting, "");
  for (const m of State.msgs) {
    if (m.error) continue;
    const who = m.role === "user" ? you : bot.name;
    lines.push("**" + who + ":** " + m.content, "");
  }
  downloadText(lines.join("\n"), slugify(bot.name + "-" + s.title) + ".md", "text/markdown");
  toast("Chat exported");
}

function deleteMessage(i) {
  if (Generations.has(State.sessionId)) return;
  State.msgs.splice(i, 1);
  persistMsgs();
  renderMessages();
}

function editUserMessage(i) {
  if (Generations.has(State.sessionId)) return;
  const m = State.msgs[i];
  if (!m) return;
  renderMessages();
  const bubble = $("messages").querySelector('[data-idx="' + i + '"] .msg-bubble');
  if (!bubble) return;
  bubble.innerHTML = "";

  const ta = el("textarea", "edit-ta");
  ta.value = m.content;
  bubble.appendChild(ta);

  const row = el("div", "edit-row");
  const cancelB = el("button", "btn sm", "Cancel");
  cancelB.type = "button";
  const saveB = el("button", "btn primary sm", "Save & Resend");
  saveB.type = "button";
  row.appendChild(cancelB);
  row.appendChild(saveB);
  bubble.appendChild(row);
  ta.focus();

  cancelB.onclick = () => renderMessages();
  saveB.onclick = async () => {
    const v = ta.value.trim();
    if (!v) return;
    m.content = v;
    State.msgs = State.msgs.slice(0, i + 1); // everything after gets regenerated
    persistMsgs();
    renderMessages();
    generate(State.sessionId, State.botId, State.msgs, State.tempOverride, State.systemOverride);
  };
  ta.onkeydown = e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveB.onclick();
    if (e.key === "Escape") renderMessages();
    e.stopPropagation();
  };
}
