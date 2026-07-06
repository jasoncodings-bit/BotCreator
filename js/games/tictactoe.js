"use strict";
/* ============================================================
   Tic-Tac-Toe — one game module registered into GAMES.tictactoe
   (see js/games.js for the shared engine/interface this implements).
   User is always X and moves first; the bot is O.
   ============================================================ */

const TICTACTOE_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

GAMES.tictactoe = {
  init() {
    return { cells: Array(9).fill(null) };
  },

  renderBoard(state, { interactive }) {
    const cells = state.cells.map((v, i) => {
      const cls = "game-cell ttt-cell" + (v ? " filled " + v.toLowerCase() : "");
      if (v || !interactive) {
        return '<button class="' + cls + '" type="button" disabled>' + (v || "") + "</button>";
      }
      return '<button class="' + cls + '" type="button" data-idx="' + i + '">' + "</button>";
    }).join("");
    return '<div class="ttt-board">' + cells + "</div>";
  },

  readMoveFromCell(cellEl) {
    const idx = parseInt(cellEl.dataset.idx, 10);
    return Number.isInteger(idx) ? idx : null;
  },

  legalMoves(state) {
    const moves = [];
    state.cells.forEach((v, i) => { if (!v) moves.push(i); });
    return moves;
  },

  isLegal(state, move, legal) {
    return legal.includes(move);
  },

  applyMove(state, move, player) {
    state.cells[move] = player === "user" ? "X" : "O";
  },

  checkEnd(state) {
    for (const [a, b, c] of TICTACTOE_LINES) {
      const v = state.cells[a];
      if (v && v === state.cells[b] && v === state.cells[c]) {
        return { winner: v === "X" ? "user" : "bot", line: [a, b, c] };
      }
    }
    if (state.cells.every(Boolean)) return { winner: null, draw: true };
    return null;
  },

  describeStateForLLM(state, legal) {
    const grid = [0, 3, 6].map(r =>
      [0, 1, 2].map(c => state.cells[r + c] || ".").join(" ")
    ).join("\n");
    return "Tic-Tac-Toe board (you are O, opponent is X). Positions are numbered 0-8, left-to-right, " +
      "top-to-bottom:\n0 1 2\n3 4 5\n6 7 8\n\nCurrent board (. = empty):\n" + grid +
      "\n\nAvailable empty positions: " + legal.join(", ") +
      "\n\nReply with ONLY the number of the position you choose.";
  },

  parseLLMMove(text) {
    const m = text.match(/-?\d+/);
    return m ? parseInt(m[0], 10) : null;
  },

  fallbackMove(state, legal) {
    /* simple heuristic: win if possible, block if needed, else center/corner/random */
    const mine = "O", theirs = "X";
    const tryWin = player => {
      for (const [a, b, c] of TICTACTOE_LINES) {
        const line = [a, b, c];
        const vals = line.map(i => state.cells[i]);
        const empties = line.filter(i => !state.cells[i]);
        if (empties.length === 1 && vals.filter(v => v === player).length === 2) return empties[0];
      }
      return null;
    };
    return tryWin(mine) ?? tryWin(theirs) ??
      (legal.includes(4) ? 4 : null) ??
      legal.find(i => [0, 2, 6, 8].includes(i)) ??
      legal[Math.floor(Math.random() * legal.length)];
  },

  situationSummary(gs) {
    if (gs.result) {
      if (gs.result.draw) return "The game ended in a draw.";
      return gs.result.winner === "user" ? "The user just won the game!" : "You (the bot) just won the game.";
    }
    return "The game is ongoing; it's the user's turn next.";
  }
};
