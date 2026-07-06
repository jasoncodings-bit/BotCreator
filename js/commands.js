"use strict";
/* ============================================================
   Slash commands: typed at the start of the message box (e.g.
   /clear, /compact) instead of being sent to the bot. Parsed and
   intercepted in sendMessage() (js/chats.js) before anything is
   pushed to State.msgs. Also drives the "/" autocomplete popover
   above the input, mirroring the #mode-popover/#history-popover
   pattern in js/chats.js.
   ============================================================ */

const SLASH_COMMANDS = {
  help: {
    hint: "List all available commands",
    run: () => localNote(commandHelpText())
  },
  clear: {
    hint: "Wipe this chat's messages and start fresh",
    run: async () => {
      if (!await appConfirm("This can't be undone.", { title: "Clear all messages in this chat?" })) return;
      State.msgs = [];
      persistMsgs();
      renderMessages();
      toast("Chat cleared");
    }
  },
  compact: {
    hint: "Summarize older messages to free up context",
    run: () => compactChat()
  },
  regen: {
    hint: "Regenerate the last response",
    run: () => regenerateLast()
  },
  new: {
    hint: "Start a new chat with this bot",
    run: () => newChat()
  },
  export: {
    hint: "Export this chat as a file",
    run: () => exportCurrentChat()
  },
  system: {
    hint: "Show (or override) the bot's system prompt for this session",
    run: arg => showOrOverrideSystemPrompt(arg)
  },
  temp: {
    hint: "Set creativity (0-2) for the rest of this session",
    run: arg => setTempOverride(arg)
  }
};

const SLASH_COMMAND_ORDER = ["clear", "compact", "regen", "new", "export", "system", "temp", "help"];

function commandHelpText() {
  const lines = ["**Available commands:**", ""];
  for (const name of SLASH_COMMAND_ORDER) {
    lines.push("`/" + name + "` — " + SLASH_COMMANDS[name].hint);
  }
  return lines.join("\n");
}

/* pushes a local, never-sent-to-the-model note into the chat (see
   the `local` flag handled in msgNode()/buildApiMessages(), js/chats.js) */
function localNote(content, isError) {
  State.msgs.push({ id: uid("m"), role: "assistant", content, ts: Date.now(), local: true, error: !!isError });
  persistMsgs();
  renderMessages();
}

async function runSlashCommand(raw) {
  const body = raw.slice(1).trim();
  const sp = body.indexOf(" ");
  const name = (sp === -1 ? body : body.slice(0, sp)).toLowerCase();
  const arg = sp === -1 ? "" : body.slice(sp + 1).trim();

  if (!name) { localNote(commandHelpText()); return; }
  const cmd = SLASH_COMMANDS[name];
  if (!cmd) {
    localNote("Unknown command `/" + name + "`. Type `/` to see the list, or `/help`.", true);
    return;
  }
  if (!State.sessionId) return;
  await cmd.run(arg);
}

/* ---------- /compact ---------- */
/* summarizes everything except the last few messages into one local
   note, then removes the summarized messages — a single extra model
   call, no different from a normal generate() round-trip */
const COMPACT_KEEP_RECENT = 6;

async function compactChat() {
  const bot = DB.bot(State.botId);
  if (!bot) return;
  const real = State.msgs.filter(m => !m.local);
  if (real.length <= COMPACT_KEEP_RECENT) {
    toast("Not enough history to compact yet");
    return;
  }
  const toSummarize = real.slice(0, real.length - COMPACT_KEEP_RECENT);
  const keep = real.slice(real.length - COMPACT_KEEP_RECENT);

  toast("Compacting chat…");
  const transcript = toSummarize.map(m => (m.role === "user" ? "User" : bot.name) + ": " + m.content).join("\n\n");
  const messages = [
    { role: "system", content: "Summarize the following conversation into a short, dense recap (5-10 sentences) " +
      "that preserves names, facts, decisions, and anything a bot would need to keep talking naturally as if it " +
      "remembered the whole thing. Write only the summary, no preamble." },
    { role: "user", content: transcript }
  ];

  let summary = "";
  try {
    const result = await streamChat({
      messages, temperature: 0.3, topP: 1,
      signal: undefined,
      onDelta: d => { summary += d; }
    });
    if (!summary) throw new Error("empty summary");
  } catch (err) {
    toast("Compact failed: " + err.message);
    return;
  }

  State.msgs = [
    { id: uid("m"), role: "assistant", content: "**Compacted " + toSummarize.length + " earlier messages:**\n\n" + summary,
      ts: Date.now(), local: true },
    ...keep
  ];
  persistMsgs();
  renderMessages();
  toast("Chat compacted");
}

/* ---------- /regen ---------- */

function regenerateLast() {
  if (Generations.has(State.sessionId)) return;
  for (let i = State.msgs.length - 1; i >= 0; i--) {
    if (!State.msgs[i].local && State.msgs[i].role === "assistant") {
      State.msgs.splice(i, 1);
      persistMsgs();
      renderMessages();
      generate(State.sessionId, State.botId, State.msgs, State.tempOverride, State.systemOverride);
      return;
    }
  }
  toast("Nothing to regenerate yet");
}

/* ---------- /system ---------- */

function showOrOverrideSystemPrompt(arg) {
  const bot = DB.bot(State.botId);
  if (!bot) return;
  if (!arg) {
    const sys = buildCharacterPrompt(bot, DB.activePersona());
    localNote("**Current system prompt for this session:**\n\n```\n" + sys + "\n```\n\nType `/system <text>` to override it for the rest of this chat.");
    return;
  }
  State.systemOverride = arg;
  localNote("System prompt overridden for the rest of this chat:\n\n```\n" + arg + "\n```");
}

/* ---------- /temp ---------- */

function setTempOverride(arg) {
  const v = parseFloat(arg);
  if (arg === "" || isNaN(v) || v < 0 || v > 2) {
    localNote("Usage: `/temp <0-2>` — e.g. `/temp 1.1`. Current: " +
      (State.tempOverride ?? (DB.bot(State.botId)?.temp ?? 0.8)), true);
    return;
  }
  State.tempOverride = v;
  localNote("Creativity set to **" + v + "** for the rest of this chat.");
}

/* ---------- "/" autocomplete popover ---------- */

function closeCommandPopover() {
  const pop = $("command-popover");
  if (pop) pop.hidden = true;
}

function renderCommandPopover(filter) {
  const pop = $("command-popover");
  if (!pop) return;
  const q = filter.toLowerCase();
  const matches = SLASH_COMMAND_ORDER.filter(name => name.startsWith(q));
  if (!matches.length) { pop.hidden = true; return; }

  pop.innerHTML = "";
  for (const name of matches) {
    const row = el("button", "cmd-row");
    row.type = "button";
    row.innerHTML = '<span class="cmd-name">/' + name + '</span><span class="cmd-hint">' + SLASH_COMMANDS[name].hint + "</span>";
    row.onclick = () => {
      const input = $("msg-input");
      input.value = "/" + name + " ";
      input.focus();
      closeCommandPopover();
    };
    pop.appendChild(row);
  }
  pop.hidden = false;
}

function wireCommandPopover() {
  const input = $("msg-input");
  if (!input) return;
  input.addEventListener("input", () => {
    const v = input.value;
    if (v.startsWith("/") && !v.includes(" ")) renderCommandPopover(v.slice(1));
    else closeCommandPopover();
  });
  input.addEventListener("keydown", e => {
    const pop = $("command-popover");
    if (pop && !pop.hidden && e.key === "Escape") { closeCommandPopover(); e.stopPropagation(); }
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#command-popover") && e.target !== input) closeCommandPopover();
  });
}
