"use strict";
/* ============================================================
   App state, view switching, sidebar, global wiring, init
   ============================================================ */

const State = {
  view: "home",        // "home" | "chat"
  botId: null,
  sessionId: null,
  msgs: [],
  generating: false,
  abort: null,
  userScrolledUp: false,
  tempOverride: null,   // set by /temp, reset whenever a session is (re-)opened
  systemOverride: null, // set by /system <text>, reset whenever a session is (re-)opened
  pendingImage: null    // data URL attached via the image button, cleared after send
};

function showView() {
  $("home-view").hidden = State.view !== "home";
  $("chat-view").hidden = State.view !== "chat";
}

function goHome() {
  if (State.generating) stopGeneration();
  State.view = "home";
  State.botId = null;
  State.sessionId = null;
  State.msgs = [];
  closeHistoryPopover();
  showView();
  renderHome();
  renderSidebar();
}

/* ---------- mobile sidebar (off-canvas below the mobile.css breakpoint) ---------- */

function openSidebar() {
  document.body.classList.add("sidebar-open");
}
function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

/* re-render everything that shows bot data */
function refreshAll() {
  renderSidebar();
  if (State.view === "home") renderHome();
}

/* ---------- sidebar: recent chats across all bots ---------- */

function renderSidebar() {
  const list = $("session-list");
  list.innerHTML = "";
  const q = ($("sidebar-search").value || "").trim().toLowerCase();
  const sessions = DB.sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt);

  for (const s of sessions) {
    const bot = DB.bot(s.botId);
    if (!bot) continue;
    const hay = (bot.name + " " + s.title + " " + (s.snippet || "")).toLowerCase();
    if (q && !hay.includes(q)) continue;

    const row = el("div", "session-item" + (s.id === State.sessionId ? " active" : ""));
    row.appendChild(avatarNode(bot, "sm"));

    const info = el("div", "s-info");
    const top = el("div", "s-top");
    top.appendChild(el("span", "s-bot", bot.name));
    top.appendChild(el("span", "s-time", timeAgo(s.updatedAt)));
    info.appendChild(top);
    info.appendChild(el("div", "s-snippet", s.snippet || s.title));
    row.appendChild(info);

    const del = iconBtn("trash", "s-del", "Delete chat", null, true);
    del.onclick = e => { e.stopPropagation(); deleteSessionUI(s.id); };
    row.appendChild(del);

    row.onclick = () => { openSession(s.id); closeSidebar(); };
    list.appendChild(row);
  }

  if (!list.children.length) {
    list.appendChild(el("div", "empty-list",
      q ? "No chats match your search" : "No chats yet. Pick a bot on the Home screen to start talking."));
  }
}

/* ---------- theme ---------- */

function applyTheme() {
  document.documentElement.dataset.theme = DB.settings.theme || "light";
}

/* ---------- init ---------- */

/* dedicated flat logo mark: a friendly robot-head badge with a fixed
   black outline — the fill color is driven by currentColor (red/green
   connection state) but the outline never changes and there's no
   glow/filter effect. Original silhouette (rounded dome, single
   antenna, dot eyes, two grey ear bumps on the sides) — not a copy
   of any third-party robot mascot. */
function logoMarkup() {
  return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="4.3" cy="12.5" r="2" fill="#9aa1b5" stroke="#000" stroke-width="1.1"/>' +
    '<circle cx="19.7" cy="12.5" r="2" fill="#9aa1b5" stroke="#000" stroke-width="1.1"/>' +
    '<path d="M12 2.2v2.1" stroke="#000" stroke-width="1.6" stroke-linecap="round"/>' +
    '<circle cx="12" cy="2.3" r="1.15" fill="currentColor" stroke="#000" stroke-width="1.2"/>' +
    '<path d="M5.5 10.5A6.5 6.5 0 0 1 12 5a6.5 6.5 0 0 1 6.5 5.5V16a2.5 2.5 0 0 1-2.5 2.5H8A2.5 2.5 0 0 1 5.5 16Z" ' +
      'fill="currentColor" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<circle cx="9.2" cy="11.6" r="1.35" fill="#000"/>' +
    '<circle cx="14.8" cy="11.6" r="1.35" fill="#000"/>' +
    '<path d="M9 15.3h6" stroke="#000" stroke-width="1.4" stroke-linecap="round"/>' +
    '</svg>';
}

function wireStaticIcons() {
  $("logo-holder").innerHTML = logoMarkup();
  $("home-btn").innerHTML = icon("home") + "<span>Home</span>";
  $("create-bot-btn").innerHTML = icon("plus", null, true) + "<span>Create Bot</span>";
  $("settings-btn").innerHTML = icon("settings") + "<span>Settings</span>";
  $("back-btn").innerHTML = icon("back");
  $("new-chat-btn").innerHTML = icon("plus", null, true) + "<span>New Chat</span>";
  $("history-btn").innerHTML = icon("history") + "<span>History</span>";
  $("export-chat-btn").innerHTML = icon("download") + "<span>Export</span>";
  $("edit-bot-btn").innerHTML = icon("edit") + "<span>Edit</span>";
  $("scroll-bottom-btn").innerHTML = icon("chevron-down");
  $("refresh-models-btn").innerHTML = icon("refresh");
  $("persona-add-btn").innerHTML = icon("plus", null, true);
  $("persona-del-btn").innerHTML = icon("trash", null, true);
  $("export-btn").innerHTML = icon("download") + "<span>Export backup</span>";
  $("import-btn").innerHTML = icon("upload") + "<span>Import backup / bot</span>";
  $("reset-btn").innerHTML = icon("alert") + "<span>Reset everything</span>";
  $("preview-fullscreen-close").innerHTML = icon("x", null, true) + "<span>Close</span>";
  $("sidebar-close-btn").innerHTML = icon("x", null, true);
  $("sidebar-open-btn").innerHTML = icon("menu");
  $("home-sidebar-open-btn").innerHTML = icon("menu");
  $("image-attach-btn").innerHTML = icon("image");
  $("image-attach-remove").innerHTML = icon("x", null, true);
  setSendButton(false);
}

/* ---------- fullscreen HTML preview (games/canvas demos need real room
   to play, and the inline 320px preview pane is too cramped) ---------- */
function openPreviewFullscreen(srcdoc) {
  const overlay = $("preview-fullscreen");
  const body = $("preview-fullscreen-body");
  body.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.sandbox = "allow-scripts";
  iframe.title = "Fullscreen preview";
  iframe.srcdoc = srcdoc;
  iframe.addEventListener("load", () => iframe.contentWindow?.focus());
  body.appendChild(iframe);
  overlay.hidden = false;
}
function closePreviewFullscreen() {
  const overlay = $("preview-fullscreen");
  if (overlay.hidden) return;
  overlay.hidden = true;
  $("preview-fullscreen-body").innerHTML = "";
}

function init() {
  DB.init();
  scheduleBootLoaderHide();
  wireStaticIcons();
  applyTheme();
  applyDyslexiaFont();

  /* sidebar */
  $("home-btn").onclick = () => { goHome(); closeSidebar(); };
  $("create-bot-btn").onclick = () => { openBotEditor(null); closeSidebar(); };
  $("sidebar-search").addEventListener("input", renderSidebar);
  $("conn-status").onclick = checkConnection;
  $("sidebar-close-btn").onclick = closeSidebar;
  $("sidebar-open-btn").onclick = openSidebar;
  $("home-sidebar-open-btn").onclick = openSidebar;
  $("sidebar-backdrop").onclick = closeSidebar;

  /* home */
  $("home-search").addEventListener("input", renderHome);

  /* chat */
  $("back-btn").onclick = goHome;
  $("new-chat-btn").onclick = newChat;
  $("history-btn").onclick = e => { e.stopPropagation(); toggleHistoryPopover(); };
  $("mode-btn").onclick = e => { e.stopPropagation(); toggleModePopover(); };
  $("preview-fullscreen-close").onclick = closePreviewFullscreen;
  $("edit-bot-btn").onclick = () => State.botId && openBotEditor(State.botId);
  $("export-chat-btn").onclick = exportCurrentChat;
  $("send-btn").onclick = sendMessage;
  wireCommandPopover();

  /* image attachment */
  $("image-attach-btn").onclick = () => $("chat-image-input").click();
  $("chat-image-input").addEventListener("change", e => {
    if (e.target.files[0]) attachImageFile(e.target.files[0]);
    e.target.value = "";
  });
  $("image-attach-remove").onclick = clearPendingImage;

  /* jump-to-latest button + show/hide it as the user scrolls */
  $("scroll-bottom-btn").onclick = () => { State.userScrolledUp = false; scrollBottom(); };
  $("messages").addEventListener("scroll", updateScrollBtn, { passive: true });

  const input = $("msg-input");
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener("input", autoGrow);

  /* code-block copy buttons + spoiler reveal + details toggle +
     choice buttons + universal text-copy (event delegation) */
  $("messages").addEventListener("click", e => {
    const gameCell = e.target.closest(".game-cell");
    if (gameCell && !gameCell.disabled) { handleGameCellClick(gameCell); return; }

    const rematchBtn = e.target.closest(".game-rematch-btn");
    if (rematchBtn) { restartGame(); return; }

    const spoiler = e.target.closest(".spoiler");
    if (spoiler) { spoiler.classList.add("revealed"); return; }

    const summary = e.target.closest(".details-summary");
    if (summary) {
      const body = document.getElementById(summary.dataset.target);
      const open = summary.getAttribute("aria-expanded") === "true";
      summary.setAttribute("aria-expanded", String(!open));
      if (body) body.hidden = open;
      return;
    }

    const choice = e.target.closest(".choice-btn");
    if (choice) {
      const group = choice.closest(".pollblock");
      group.querySelectorAll(".choice-btn").forEach(b => b.disabled = true);
      choice.classList.add("picked");
      $("msg-input").value = choice.textContent;
      sendMessage();
      return;
    }

    const rate = e.target.closest(".rate-btn");
    if (rate) {
      const group = rate.closest(".rateblock");
      group.querySelectorAll(".rate-btn").forEach(b => b.disabled = true);
      rate.classList.add("picked");
      $("msg-input").value = rate.textContent;
      sendMessage();
      return;
    }

    const checklistItem = e.target.closest(".checklist-item");
    if (checklistItem) {
      checklistItem.classList.toggle("done");
      const group = checklistItem.closest(".checklistblock");
      const doneCount = group.querySelectorAll(".checklist-item.done").length;
      group.querySelector(".checklist-done").textContent = String(doneCount);
      return;
    }

    const revealFront = e.target.closest(".reveal-front");
    if (revealFront) {
      const card = document.getElementById(revealFront.dataset.target);
      if (!card) return;
      card.dataset.revealed = "true";
      card.querySelector(".reveal-back").hidden = false;
      return;
    }

    const faqToggle = e.target.closest(".faq-q");
    if (faqToggle) {
      const item = faqToggle.closest(".faq-item");
      if (!item) return;
      const open = item.dataset.open !== "true";
      item.dataset.open = open ? "true" : "false";
      const ans = item.querySelector(".faq-a");
      if (ans) ans.hidden = !open;
      return;
    }

    const tabHead = e.target.closest(".tab-head");
    if (tabHead) {
      const gid = tabHead.dataset.tabgroup, idx = tabHead.dataset.tabindex;
      const scope = tabHead.closest(".tabsblock");
      scope.querySelectorAll('.tab-head[data-tabgroup="' + gid + '"]').forEach(b =>
        b.classList.toggle("active", b.dataset.tabindex === idx));
      scope.querySelectorAll('.tab-panel[data-tabgroup="' + gid + '"]').forEach(p =>
        p.classList.toggle("active", p.dataset.tabindex === idx));
      return;
    }

    const dlBtn = e.target.closest(".code-download");
    if (dlBtn) {
      const code = dlBtn.closest(".codeblock")?.querySelector("pre code");
      if (!code) return;
      downloadText(code.textContent, dlBtn.dataset.filename || "snippet.txt", "text/plain");
      dlBtn.classList.add("copied");
      dlBtn.innerHTML = icon("check", null, true) + "<span>Saved</span>";
      setTimeout(() => {
        dlBtn.classList.remove("copied");
        dlBtn.innerHTML = icon("download") + "<span>Save</span>";
      }, 1600);
      return;
    }

    const previewBtn = e.target.closest(".code-preview-btn");
    if (previewBtn) {
      const pane = document.getElementById(previewBtn.dataset.target);
      const code = previewBtn.closest(".codeblock")?.querySelector("pre code");
      const expandBtn = previewBtn.parentElement.querySelector(".code-expand-btn");
      if (!pane || !code) return;
      const open = !pane.hidden;
      if (open) {
        pane.hidden = true;
        pane.querySelector("iframe").remove();
        previewBtn.innerHTML = icon("eye") + "<span>Preview</span>";
        if (expandBtn) expandBtn.hidden = true;
      } else {
        const iframe = document.createElement("iframe");
        iframe.sandbox = "allow-scripts";
        iframe.title = "HTML preview";
        iframe.srcdoc = pane.dataset.previewSrc || code.textContent;
        /* without this, arrow keys / WASD / space typed by the user go to
           the outer chat page (scrolling #messages) instead of the game's
           own keydown listeners inside the sandboxed iframe — clicking
           the preview area re-focuses it so keyboard-driven previews
           (games, canvas demos) actually receive input */
        iframe.addEventListener("load", () => iframe.contentWindow?.focus());
        pane.appendChild(iframe);
        pane.addEventListener("click", () => iframe.contentWindow?.focus());
        pane.hidden = false;
        previewBtn.innerHTML = icon("x", null, true) + "<span>Hide</span>";
        if (expandBtn) expandBtn.hidden = false;
      }
      return;
    }

    const expandBtn = e.target.closest(".code-expand-btn");
    if (expandBtn) {
      const pane = document.getElementById(expandBtn.dataset.target);
      const srcdoc = pane?.dataset.previewSrc ||
        expandBtn.closest(".codeblock")?.querySelector("pre code")?.textContent;
      if (srcdoc) openPreviewFullscreen(srcdoc);
      return;
    }

    const btn = e.target.closest(".code-copy");
    if (!btn) return;
    const code = btn.closest(".codeblock")?.querySelector("pre code")
      || btn.closest(".proseblock")?.querySelector(".proseblock-body")
      || btn.closest(".mathblock")?.querySelector(".mathblock-body");
    if (!code) return;
    copyText(code.textContent);
    btn.classList.add("copied");
    btn.innerHTML = icon("check", null, true) + "<span>Copied</span>";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = icon("copy") + "<span>Copy</span>";
    }, 1600);
  });

  /* modals & editor */
  wireBotEditor();
  wireCategoryManager();
  wireSettings();
  for (const id of ["bot-modal", "settings-modal", "category-modal"]) {
    $(id).addEventListener("mousedown", e => {
      if (e.target === $(id)) $(id).classList.remove("open");
    });
  }

  /* global keys + click-away for popover */
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      $("bot-modal").classList.remove("open");
      $("settings-modal").classList.remove("open");
      $("category-modal").classList.remove("open");
      closeHistoryPopover();
      closeModePopover();
      closeCommandPopover();
      closePreviewFullscreen();
      closeSidebar();
    }
    if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      $("sidebar-search").focus();
    }
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#history-wrap")) closeHistoryPopover();
    if (!e.target.closest("#mode-wrap")) closeModePopover();
  });

  /* stop nice-to-know: warn if leaving mid-generation */
  window.addEventListener("beforeunload", e => {
    if (State.generating) e.preventDefault();
  });

  showView();
  renderHome();
  renderSidebar();
  checkConnection();
  setInterval(checkConnection, 30000);
}

document.addEventListener("DOMContentLoaded", init);

/* ```roll```/```dice``` blocks render with a "?" placeholder and their
   real result stashed in data-final; animate a quick spin then reveal it */
function animateRolls(container) {
  const rows = container.querySelectorAll(".roll-row[data-final]");
  rows.forEach((row, i) => {
    const die = row.querySelector(".roll-die");
    if (!die) return;
    const final = row.dataset.final;
    let ticks = 0;
    const maxTicks = 8 + i * 3;
    const spin = setInterval(() => {
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(spin);
        die.textContent = final;
        die.classList.remove("rolling");
        die.classList.add("landed");
      } else {
        die.textContent = String(1 + Math.floor(Math.random() * 20));
      }
    }, 60);
  });
}
