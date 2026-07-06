"use strict";
/* ============================================================
   Games: shared engine for the "Games" category of bots
   (Tic-Tac-Toe, Hangman, Connect Four, Word Guess).

   A game bot (bot.game === "tictactoe" | "hangman" | "connect4" | "wordguess")
   plays through the normal chat view, but instead of the LLM freely writing
   text, its board lives in ```game:<name>``` fenced blocks. The LLM never
   has to remember or reproduce board state — that lives in session.gameState
   (js/storage.js's DB.session shape, same pattern as session.mode in
   js/modes.js) and is the single source of truth. Each per-game module in
   js/games/*.js registers itself into GAMES{} and implements a small
   interface (see the bottom of this file); this file owns:
     - the ```game:<name>``` fenced-block renderer, dispatched from
       markdown.js's block switch (gameBlockHtml, mirroring js/blocks2.js's
       relationship to markdown.js)
     - click handling for board cells (delegated from #messages in js/app.js)
     - the turn engine: apply the user's move, ask the LLM for its move
       (validated against legalMoves(), retried once, then a deterministic
       fallback so the game can never soft-lock), apply it, then ask the LLM
       for a short in-character reaction line

   Load order: this file must load BEFORE js/games/*.js (it declares the
   GAMES registry those files populate with GAMES.<name> = {...}), but
   AFTER storage.js/markdown.js/blocks2.js and BEFORE chats.js/app.js
   (which call into isGameBot()/GAMES[...] at runtime). See index.html.
   ============================================================ */

const GAMES = {};

/* ---------- session game state ---------- */

function isGameBot(bot) {
  return !!(bot && bot.game && GAMES[bot.game]);
}

function ensureGameState(session, bot) {
  if (!session.gameState || session.gameState.game !== bot.game) {
    session.gameState = { game: bot.game, state: GAMES[bot.game].init(), turn: "user", over: false };
    DB.saveSessions();
  }
  return session.gameState;
}

/* ---------- ```game:<name>``` fenced block ---------- */
/* rendered by markdown.js's dispatch (see the game: line added to its
   block-type switch). The board state is serialized as JSON INTO the fence
   body itself when the message is created (see stampGameFence()) — each
   message is a self-contained historical snapshot of the board at that
   point in the conversation, so older messages never change when the game
   moves on. Only the single latest game message is ever "live"/clickable;
   its snapshot happens to equal the current session.gameState because it
   was just stamped from it. */
function gameBlockHtml(block, lang) {
  const m = lang.match(/^game:?\s*(.*)$/i);
  const name = (m && m[1].trim()) || "";
  const g = GAMES[name];
  if (!g) return codeBlockHtml(block);
  let snapshot;
  try { snapshot = JSON.parse(block.code); } catch { return codeBlockHtml(block); }
  if (!snapshot || typeof snapshot !== "object") return codeBlockHtml(block);

  const isLatest = !!State.gameBlockInteractive;
  const interactive = isLatest && !snapshot.over && snapshot.turn === "user";
  const rematch = isLatest && snapshot.over
    ? '<button class="game-rematch-btn" type="button">' + icon("refresh") + "<span>Rematch</span></button>"
    : "";
  return '<div class="gameblock" data-game="' + escapeHtml(name) + '">' +
    g.renderBoard(snapshot.state, { interactive }) + rematch +
    "</div>";
}

/* stamps the CURRENT gs (session.gameState) into a ```game:<name>``` fence
   as a JSON snapshot — call this at the moment a message is created, never
   later, so each message freezes exactly what the board looked like then */
function stampGameFence(gameName, gs) {
  const snapshot = { state: gs.state, over: gs.over, turn: gs.turn };
  return "```game:" + gameName + "\n" + JSON.stringify(snapshot) + "\n```";
}

/* ---------- rematch: fresh board, same bot, same session ---------- */

function restartGame() {
  const bot = DB.bot(State.botId);
  const s = DB.session(State.sessionId);
  if (!bot || !s || !isGameBot(bot) || State.generating) return;
  s.gameState = { game: bot.game, state: GAMES[bot.game].init(), turn: "user", over: false };
  DB.saveSessions();
  State.msgs.push({ id: uid("m"), role: "assistant", content: stampGameFence(bot.game, s.gameState), ts: Date.now() });
  persistMsgs();
  renderMessages();
  toast("Rematch! Your move.");
}

/* called from openSession()/renderMessages() so State.gameState always
   matches whichever session is currently open */
function syncGameState() {
  const s = DB.session(State.sessionId);
  State.gameState = s ? s.gameState || null : null;
}

/* ---------- click delegation entry point (called from js/app.js) ---------- */

async function handleGameCellClick(cellEl) {
  const bot = DB.bot(State.botId);
  const s = DB.session(State.sessionId);
  if (!bot || !s || !isGameBot(bot) || State.generating) return;
  const gs = ensureGameState(s, bot);
  if (gs.over || gs.turn !== "user") return;
  const g = GAMES[bot.game];

  const move = g.readMoveFromCell(cellEl, gs.state);
  if (move == null) return;
  const legal = g.legalMoves(gs.state);
  if (!g.isLegal(gs.state, move, legal)) return;

  g.applyMove(gs.state, move, "user");
  gs.turn = "bot";
  const result = g.checkEnd(gs.state);
  if (result) { gs.over = true; gs.result = result; }
  DB.saveSessions();
  await advanceGame(bot, s, gs, g);
}

/* for games where "the move" is typed text (Hangman letters, Word Guess
   guesses) rather than a click — called from sendMessage() in js/chats.js
   before the text is treated as a normal chat message */
async function handleGameTextInput(text) {
  if (State.generating) return false;
  const bot = DB.bot(State.botId);
  const s = DB.session(State.sessionId);
  if (!bot || !s || !isGameBot(bot)) return false;
  const g = GAMES[bot.game];
  if (!g.parseUserTextMove) return false;
  const gs = ensureGameState(s, bot);
  if (gs.over || gs.turn !== "user") return false;

  const move = g.parseUserTextMove(text, gs.state);
  if (move == null) return false;

  State.msgs.push({ id: uid("m"), role: "user", content: text, ts: Date.now() });
  g.applyMove(gs.state, move, "user");
  gs.turn = g.soloTurn ? "user" : "bot";
  const result = g.checkEnd(gs.state);
  if (result) { gs.over = true; gs.result = result; }
  DB.saveSessions();
  persistMsgs();
  await advanceGame(bot, s, gs, g);
  return true;
}

/* ---------- the bot's turn: LLM move (validated/retried/fallback) + reaction ---------- */

async function pickValidatedMove(bot, g, state) {
  const legal = g.legalMoves(state);
  if (!legal.length) return null;

  const describe = g.describeStateForLLM(state, legal);
  const sys = "You are playing a game as your character. Given the current state, choose your next move. " +
    "Reply with ONLY the move in the exact format requested — no words, no punctuation, no explanation.";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let text = "";
      await streamChat({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: describe + (attempt > 0 ? "\n\nYour last answer wasn't a valid move. Answer with ONLY the move." : "") }
        ],
        temperature: 0.6, topP: 1, signal: undefined,
        onDelta: d => { text += d; }
      });
      const move = g.parseLLMMove(text, state);
      if (move != null && g.isLegal(state, move, legal)) return move;
    } catch { /* fall through to retry / fallback */ }
  }
  return g.fallbackMove(state, legal);
}

async function botReaction(bot, situationText) {
  try {
    let text = "";
    await streamChat({
      messages: [
        { role: "system", content: buildCharacterPrompt(bot, DB.activePersona()) +
          "\n\nRespond in character with ONE short reaction (max 2 sentences) to what just happened in the game. " +
          "Do not describe the board or restate rules — just react like a person watching the game." },
        { role: "user", content: situationText }
      ],
      temperature: bot.temp ?? 0.8, topP: bot.topP, signal: undefined,
      onDelta: d => { text += d; }
    });
    return text.trim();
  } catch {
    return "";
  }
}

async function advanceGame(bot, session, gs, g) {
  renderMessages();
  State.generating = true;
  setSendButton(true);
  try {
    if (!gs.over && !g.soloTurn) {
      const move = await pickValidatedMove(bot, g, gs.state);
      if (move != null) {
        g.applyMove(gs.state, move, "bot");
        const result = g.checkEnd(gs.state);
        if (result) { gs.over = true; gs.result = result; }
        gs.turn = "user";
        DB.saveSessions();
      }
    }

    const situation = g.situationSummary(gs);
    const reaction = await botReaction(bot, situation);
    const boardMsg = stampGameFence(bot.game, gs) + (reaction ? "\n\n" + reaction : "");
    State.msgs.push({ id: uid("m"), role: "assistant", content: boardMsg, ts: Date.now() });
    persistMsgs();
    renderMessages();
  } finally {
    State.generating = false;
    setSendButton(false);
  }
}
