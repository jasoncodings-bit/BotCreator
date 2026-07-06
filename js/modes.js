"use strict";
/* ============================================================
   Chat modes: an optional per-session lock that narrows what a
   bot is allowed to do (e.g. "only write code, nothing else").
   Picked from a small icon popover to the left of the message
   input (wired in js/app.js); the active mode's instruction is
   appended to the system prompt in buildApiMessages() (js/chats.js).
   ============================================================ */

const CHAT_MODES = {
  auto: {
    label: "Auto",
    icon: "sparkles",
    hint: "No restrictions — the bot behaves normally.",
    instruction: ""
  },
  code: {
    label: "Code Mode",
    icon: "code",
    hint: "Only code — minimal talk, no roleplay/personality flourishes.",
    instruction: "MODE: Code Mode is active. Respond with working code first, in fenced code blocks " +
      "with the language named. Keep any explanation to a few short sentences directly relevant to the " +
      "code (key decisions, tradeoffs, how to run it) — no roleplay, no personality flourishes, no small " +
      "talk, no restating the request. If the request isn't actually about code, briefly say so and ask " +
      "what code-related task they want instead."
  },
  writing: {
    label: "Writing Mode",
    icon: "feather",
    hint: "Focused long-form writing — stories, prose, articles.",
    instruction: "MODE: Writing Mode is active. Focus entirely on producing high-quality long-form " +
      "writing (stories, prose, articles, scripts, etc.) using ```story```/```poem``` blocks for " +
      "finished creative pieces. Minimize meta-commentary before/after the piece — a single short " +
      "framing line is fine, but don't over-explain your choices unless asked. Prioritize voice, pacing, " +
      "and vivid concrete detail over generic description."
  },
  thinking: {
    label: "Thinking Mode",
    icon: "brain",
    hint: "Shows step-by-step reasoning before the final answer.",
    instruction: "MODE: Thinking Mode is active. Before giving your final answer, work through your " +
      "reasoning step by step inside a ```details: Reasoning``` collapsible block, so the user can " +
      "expand it if they want to see your thought process but it doesn't clutter the main reply. After " +
      "the details block, give a clear, concise final answer on its own."
  },
  concise: {
    label: "Concise Mode",
    icon: "zap",
    hint: "Short, direct answers only — no filler.",
    instruction: "MODE: Concise Mode is active. Keep every response as short as possible while still " +
      "fully answering — no filler, no restating the question, no unnecessary pleasantries or hedging. " +
      "Prefer a few sentences or a tight list over paragraphs. Only go longer if the request genuinely " +
      "requires it (e.g. a full code file)."
  }
};

const CHAT_MODE_ORDER = ["auto", "code", "writing", "thinking", "concise"];
