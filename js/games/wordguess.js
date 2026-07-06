"use strict";
/* ============================================================
   Word Guess (Wordle-style) — one game module registered into
   GAMES.wordguess (see js/games.js for the shared engine/interface).

   Secret word comes from a local word bank for the same reason as
   Hangman (js/games/hangman.js): a local LLM asked to keep a secret
   word hidden across turns reliably leaks it. soloTurn: true — the
   bot never "plays", it only reacts to each guess.
   ============================================================ */

const WORDGUESS_WORDS = [
  "CRANE", "PLANT", "BRAVE", "STONE", "MONEY", "TIGER", "CLOUD", "SPARK",
  "GRAPE", "CHESS", "FLAME", "SWIFT", "TRUCK", "PIANO", "SHINE", "BLAZE"
];
const WORDGUESS_MAX_TRIES = 6;

function wordguessScore(guess, secret) {
  const result = Array(guess.length).fill("gray");
  const secretChars = secret.split("");
  const used = Array(secret.length).fill(false);

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secretChars[i]) { result[i] = "green"; used[i] = true; }
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === "green") continue;
    const idx = secretChars.findIndex((ch, j) => ch === guess[i] && !used[j]);
    if (idx !== -1) { result[i] = "yellow"; used[idx] = true; }
  }
  return result;
}

GAMES.wordguess = {
  soloTurn: true,

  init() {
    const word = WORDGUESS_WORDS[Math.floor(Math.random() * WORDGUESS_WORDS.length)];
    return { word, guesses: [] }; // guesses: [{ word, scores: [...] }]
  },

  renderBoard(state) {
    const rows = [];
    for (let i = 0; i < WORDGUESS_MAX_TRIES; i++) {
      const g = state.guesses[i];
      if (g) {
        const cells = g.word.split("").map((ch, j) =>
          '<span class="wg-cell ' + g.scores[j] + '">' + escapeHtml(ch) + "</span>"
        ).join("");
        rows.push('<div class="wg-row">' + cells + "</div>");
      } else {
        const cells = Array(state.word.length).fill('<span class="wg-cell empty"></span>').join("");
        rows.push('<div class="wg-row">' + cells + "</div>");
      }
    }
    return '<div class="wg-wrap"><div class="wg-grid">' + rows.join("") +
      '</div><div class="hangman-hint">Type a ' + state.word.length + '-letter word to guess</div></div>';
  },

  readMoveFromCell() { return null; },

  parseUserTextMove(text, state) {
    const t = text.trim().toUpperCase();
    if (!/^[A-Z]+$/.test(t) || t.length !== state.word.length) return null;
    if (state.guesses.length >= WORDGUESS_MAX_TRIES) return null;
    return t;
  },

  legalMoves() { return null; }, // free-form word entry, not a fixed move list
  isLegal() { return true; },

  applyMove(state, move) {
    state.guesses.push({ word: move, scores: wordguessScore(move, state.word) });
  },

  checkEnd(state) {
    const last = state.guesses[state.guesses.length - 1];
    if (last && last.word === state.word) return { winner: "user" };
    if (state.guesses.length >= WORDGUESS_MAX_TRIES) return { winner: "bot", word: state.word };
    return null;
  },

  describeStateForLLM() { return ""; },
  parseLLMMove() { return null; },
  fallbackMove() { return null; },

  situationSummary(gs) {
    if (gs.result) {
      return gs.result.winner === "user"
        ? "The user guessed the word correctly and won!"
        : "The user ran out of guesses. The word was " + gs.result.word + ".";
    }
    const last = gs.state.guesses[gs.state.guesses.length - 1];
    const greens = last ? last.scores.filter(s => s === "green").length : 0;
    return "The user just guessed " + (last ? last.word : "") + " — " + greens + " of " +
      (last ? last.word.length : 0) + " letters in the exact right spot. " +
      (WORDGUESS_MAX_TRIES - gs.state.guesses.length) + " guesses left.";
  }
};
