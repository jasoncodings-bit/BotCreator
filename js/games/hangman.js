"use strict";
/* ============================================================
   Hangman — one game module registered into GAMES.hangman
   (see js/games.js for the shared engine/interface this implements).

   The secret word is picked from a small local word bank rather than
   asked from the LLM — a local model tasked with "pick a secret word and
   never reveal it" reliably leaks it within a few turns of chat, since it
   has no real mechanism to keep information out of its own context. The
   bot still picks WHICH category flavor-wise via its personality/reaction
   text, it just doesn't choose the literal word.
   ============================================================ */

const HANGMAN_WORDS = [
  "PYTHON", "GALAXY", "PUZZLE", "CASTLE", "DRAGON", "GUITAR", "PLANET", "WIZARD",
  "JUNGLE", "ROCKET", "SHADOW", "TEMPLE", "VOLCANO", "WHISPER", "PHANTOM", "CRYSTAL",
  "HARBOR", "MYSTIC", "THUNDER", "GARDEN", "ISLAND", "MIRROR", "SILVER", "AUTUMN"
];

const HANGMAN_MAX_WRONG = 6;

/* stages 0-6: bare gallows through fully drawn hanged figure */
const HANGMAN_STAGES = [
  "  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n========="
];

GAMES.hangman = {
  soloTurn: true, // the user guesses letters; the bot only reacts, never makes moves

  init() {
    const word = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
    return { word, guessed: [], wrong: 0 };
  },

  renderBoard(state) {
    const word = state.word.split("").map(ch =>
      '<span class="hangman-letter">' + (state.guessed.includes(ch) ? ch : "_") + "</span>"
    ).join("");
    const wrongLetters = state.guessed.filter(ch => !state.word.includes(ch));
    const stage = HANGMAN_STAGES[Math.min(state.wrong, HANGMAN_MAX_WRONG)];
    return '<div class="hangman-wrap">' +
      '<pre class="hangman-gallows">' + escapeHtml(stage) + "</pre>" +
      '<div class="hangman-word">' + word + "</div>" +
      (wrongLetters.length ? '<div class="hangman-wrong">Wrong: ' + escapeHtml(wrongLetters.join(", ")) + "</div>" : "") +
      '<div class="hangman-hint">Type a letter to guess</div>' +
      "</div>";
  },

  readMoveFromCell() { return null; },

  parseUserTextMove(text, state) {
    const t = text.trim().toUpperCase();
    if (!/^[A-Z]$/.test(t)) return null;
    if (state.guessed.includes(t)) return null;
    return t;
  },

  legalMoves(state) {
    const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    return all.filter(ch => !state.guessed.includes(ch));
  },

  isLegal(state, move, legal) {
    return legal.includes(move);
  },

  applyMove(state, move, player) {
    if (player !== "user") return; // the bot never guesses in Hangman, only the user does
    state.guessed.push(move);
    if (!state.word.includes(move)) state.wrong++;
  },

  checkEnd(state) {
    const solved = state.word.split("").every(ch => state.guessed.includes(ch));
    if (solved) return { winner: "user" };
    if (state.wrong >= HANGMAN_MAX_WRONG) return { winner: "bot", word: state.word };
    return null;
  },

  describeStateForLLM() { return ""; }, // unused: the bot never picks a move in Hangman
  parseLLMMove() { return null; },
  fallbackMove() { return null; },

  situationSummary(gs) {
    if (gs.result) {
      return gs.result.winner === "user"
        ? "The user guessed the word and won!"
        : "The user ran out of guesses. The word was " + gs.result.word + ".";
    }
    const last = gs.state.guessed[gs.state.guessed.length - 1];
    const correct = last && gs.state.word.includes(last);
    return "The user just guessed the letter " + last + ", which was " + (correct ? "correct" : "wrong") +
      ". Wrong guesses so far: " + gs.state.wrong + "/" + HANGMAN_MAX_WRONG + ".";
  }
};
