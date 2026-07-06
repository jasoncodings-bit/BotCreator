"use strict";
/* ============================================================
   Bot export/import with optional chat history (kept in its own
   file per the project's "new feature = new file" rule).

   Two export shapes, both using the existing "botforge-bot" file
   type so old importers still recognise the persona:
     - persona only:  { type:"botforge-bot", bot }
     - with history:  { type:"botforge-bot", bot, sessions, msgs }
   On import, a bot carrying sessions/msgs gets its chats recreated
   with fresh session ids (re-pointed at the newly imported bot),
   so importing never collides with or overwrites existing chats.

   openBotExportModal() is opened from the bot editor's Share
   button (js/bots.js). importBotBundle() is called by
   importFile() in js/settings.js for "botforge-bot" files.
   ============================================================ */

let exportBotId = null;

function openBotExportModal(botId) {
  const bot = DB.bot(botId);
  if (!bot) return;
  exportBotId = botId;

  const sessions = DB.botSessions(botId);
  let msgCount = 0;
  for (const s of sessions) msgCount += DB.getMsgs(s.id).length;

  $("bot-export-name").textContent = bot.name;
  const hist = $("bot-export-history-info");
  if (sessions.length) {
    hist.textContent = sessions.length + (sessions.length === 1 ? " chat, " : " chats, ") +
      msgCount + (msgCount === 1 ? " message" : " messages");
  } else {
    hist.textContent = "No saved chats yet";
  }

  const withHistory = $("bot-export-with-history");
  const personaOnly = $("bot-export-persona-only");
  // default to persona-only; disable the history option if there's nothing to include
  personaOnly.checked = true;
  withHistory.checked = false;
  withHistory.disabled = sessions.length === 0;
  $("bot-export-history-option").classList.toggle("disabled", sessions.length === 0);

  $("bot-export-modal").classList.add("open");
}

function closeBotExportModal() {
  $("bot-export-modal").classList.remove("open");
  exportBotId = null;
}

function doBotExport() {
  const bot = DB.bot(exportBotId);
  if (!bot) { closeBotExportModal(); return; }

  const includeHistory = $("bot-export-with-history").checked &&
    !$("bot-export-with-history").disabled;

  const payload = { type: "botforge-bot", bot };

  if (includeHistory) {
    const sessions = DB.botSessions(bot.id);
    payload.sessions = sessions.map(s => ({
      id: s.id, title: s.title, snippet: s.snippet || "",
      createdAt: s.createdAt, updatedAt: s.updatedAt
    }));
    payload.msgs = {};
    for (const s of sessions) payload.msgs[s.id] = DB.getMsgs(s.id);
  }

  const base = bot.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "bot";
  downloadJson(payload, base + (includeHistory ? ".full" : "") + ".botforge.json");
  closeBotExportModal();
  toast(includeHistory
    ? "Bot + chat history saved as a file"
    : "Bot persona saved as a file — share it with friends!");
}

/* Import a "botforge-bot" file (with or without history). Returns the
   new bot so the caller can report it. Called from importFile(). */
function importBotBundle(data) {
  const bot = data.bot;
  const oldBotId = bot.id;
  bot.id = uid("bot");
  bot.createdAt = Date.now();
  DB.bots.push(bot);
  DB.saveBots();

  let importedChats = 0;
  if (Array.isArray(data.sessions) && data.msgs) {
    for (const s of data.sessions) {
      const oldSid = s.id;
      const newSid = uid("s");
      const session = {
        id: newSid,
        botId: bot.id,
        title: s.title || "Imported chat",
        snippet: s.snippet || "",
        createdAt: s.createdAt || Date.now(),
        updatedAt: s.updatedAt || Date.now()
      };
      DB.sessions.push(session);
      const msgs = data.msgs[oldSid];
      if (Array.isArray(msgs)) DB.saveMsgs(newSid, msgs);
      importedChats++;
    }
    DB.saveSessions();
  }
  void oldBotId;
  return { bot, importedChats };
}

function wireBotExportModal() {
  $("bot-export-cancel-btn").onclick = closeBotExportModal;
  $("bot-export-confirm-btn").onclick = doBotExport;
  // clicking anywhere on an option row selects its radio
  for (const id of ["bot-export-persona-option", "bot-export-history-option"]) {
    const row = $(id);
    if (row) row.addEventListener("click", () => {
      const radio = row.querySelector('input[type="radio"]');
      if (radio && !radio.disabled) radio.checked = true;
    });
  }
}
