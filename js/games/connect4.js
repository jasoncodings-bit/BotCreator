"use strict";
/* ============================================================
   Connect Four — one game module registered into GAMES.connect4
   (see js/games.js for the shared engine/interface this implements).
   6 rows x 7 columns, user is Red and drops first, bot is Yellow.
   Cells stored row-major, row 0 = top, row 5 = bottom.
   ============================================================ */

const C4_ROWS = 6, C4_COLS = 7;

function c4LowestEmptyRow(cells, col) {
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    if (!cells[r * C4_COLS + col]) return r;
  }
  return -1;
}

function c4CheckWinner(cells) {
  const at = (r, c) => (r < 0 || r >= C4_ROWS || c < 0 || c >= C4_COLS) ? null : cells[r * C4_COLS + c];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const v = at(r, c);
      if (!v) continue;
      for (const [dr, dc] of dirs) {
        if (v === at(r + dr, c + dc) && v === at(r + 2 * dr, c + 2 * dc) && v === at(r + 3 * dr, c + 3 * dc)) {
          return v;
        }
      }
    }
  }
  return null;
}

GAMES.connect4 = {
  init() {
    return { cells: Array(C4_ROWS * C4_COLS).fill(null) };
  },

  renderBoard(state, { interactive }) {
    const cols = [];
    for (let c = 0; c < C4_COLS; c++) {
      const full = c4LowestEmptyRow(state.cells, c) === -1;
      const canClick = interactive && !full;
      cols.push('<button class="game-cell c4-col" type="button"' +
        (canClick ? ' data-col="' + c + '"' : " disabled") + "></button>");
    }
    const cells = state.cells.map(v =>
      '<div class="c4-cell' + (v ? " filled " + v.toLowerCase() : "") + '"><span class="c4-disc"></span></div>'
    ).join("");
    return '<div class="c4-wrap">' +
      '<div class="c4-cols">' + cols.join("") + "</div>" +
      '<div class="c4-grid" style="grid-template-columns: repeat(' + C4_COLS + ', 1fr)">' + cells + "</div>" +
      "</div>";
  },

  readMoveFromCell(cellEl) {
    const col = parseInt(cellEl.dataset.col, 10);
    return Number.isInteger(col) ? col : null;
  },

  legalMoves(state) {
    const moves = [];
    for (let c = 0; c < C4_COLS; c++) if (c4LowestEmptyRow(state.cells, c) !== -1) moves.push(c);
    return moves;
  },

  isLegal(state, move, legal) {
    return legal.includes(move);
  },

  applyMove(state, move, player) {
    const row = c4LowestEmptyRow(state.cells, move);
    if (row === -1) return;
    state.cells[row * C4_COLS + move] = player === "user" ? "Red" : "Yellow";
  },

  checkEnd(state) {
    const w = c4CheckWinner(state.cells);
    if (w) return { winner: w === "Red" ? "user" : "bot" };
    if (state.cells.every(Boolean)) return { winner: null, draw: true };
    return null;
  },

  describeStateForLLM(state, legal) {
    const rows = [];
    for (let r = 0; r < C4_ROWS; r++) {
      const row = [];
      for (let c = 0; c < C4_COLS; c++) {
        const v = state.cells[r * C4_COLS + c];
        row.push(v === "Red" ? "R" : v === "Yellow" ? "Y" : ".");
      }
      rows.push(row.join(" "));
    }
    return "Connect Four board (you are Y, opponent is R). Columns are numbered 0-6 left to right. " +
      "Board top-to-bottom (. = empty):\n" + rows.join("\n") +
      "\n\nColumns you can drop into: " + legal.join(", ") +
      "\n\nReply with ONLY the number of the column you choose.";
  },

  parseLLMMove(text) {
    const m = text.match(/-?\d+/);
    return m ? parseInt(m[0], 10) : null;
  },

  fallbackMove(state, legal) {
    const tryWin = player => {
      for (const col of legal) {
        const test = state.cells.slice();
        const row = c4LowestEmptyRow(test, col);
        test[row * C4_COLS + col] = player;
        if (c4CheckWinner(test) === player) return col;
      }
      return null;
    };
    return tryWin("Yellow") ?? tryWin("Red") ??
      (legal.includes(3) ? 3 : legal[Math.floor(Math.random() * legal.length)]);
  },

  situationSummary(gs) {
    if (gs.result) {
      if (gs.result.draw) return "The board filled up with no winner — a draw.";
      return gs.result.winner === "user" ? "The user just connected four and won!" : "You (the bot) just connected four and won.";
    }
    return "The game is ongoing; it's the user's turn next.";
  }
};
