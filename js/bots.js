"use strict";
/* ============================================================
   Bot editor modal: create/edit/delete/duplicate/share bots,
   avatar image upload, emoji avatars, accent colors,
   advanced character options (scenario, examples, top_p)
   ============================================================ */

const BOT_COLORS = ["", "#7c5cff", "#4bc0ff", "#3ddc84", "#ffb020", "#ff5c6c", "#ff7ad9", "#20c9b7", "#8a94a8"];

let editingBotId = null;   // null = creating a new bot
let editorIcon = "bot";
let editorImage = null;    // dataURL or null
let editorColor = "";      // "" = auto color

function buildIconGrid() {
  const grid = $("emoji-grid");
  grid.innerHTML = "";
  for (const name of AVATAR_ICONS) {
    const b = iconBtn(name, name === editorIcon ? "selected" : "", name);
    b.onclick = () => { editorIcon = name; buildIconGrid(); updateEditorPreview(); };
    grid.appendChild(b);
  }
}

function buildColorSwatches() {
  const wrap = $("color-swatches");
  wrap.innerHTML = "";
  for (const c of BOT_COLORS) {
    const b = el("button", "swatch" + (c === "" ? " none" : "") + (c === editorColor ? " selected" : ""));
    b.type = "button";
    b.title = c === "" ? "Auto (unique color)" : c;
    if (c) b.style.background = c;
    b.onclick = () => { editorColor = c; buildColorSwatches(); updateEditorPreview(); };
    wrap.appendChild(b);
  }
}

function buildCategorySelect(selectedId) {
  const sel = $("bot-category");
  sel.innerHTML = "";
  for (const cat of DB.categories) {
    const opt = el("option", "", cat.name);
    opt.value = cat.id;
    sel.appendChild(opt);
  }
  const uncategorized = el("option", "", "Uncategorized");
  uncategorized.value = "uncategorized";
  sel.appendChild(uncategorized);
  sel.value = selectedId || "uncategorized";
}

/* mirrors buildCharacterPrompt() in chats.js so the editor shows exactly
   what the bot will actually receive as its system prompt */
function updatePromptPreview() {
  const fakeBot = {
    prompt: $("bot-prompt").value.trim(),
    traits: $("bot-traits").value.trim(),
    backstory: $("bot-backstory").value.trim(),
    speechStyle: $("bot-speechstyle").value.trim(),
    likes: $("bot-likes").value.trim(),
    dislikes: $("bot-dislikes").value.trim(),
    scenario: $("bot-scenario").value.trim(),
    example: $("bot-example").value.trim(),
    nickname: $("bot-nickname").value.trim()
  };
  $("bot-prompt-preview").value = buildCharacterPrompt(fakeBot, DB.activePersona());
}

function updateEditorPreview() {
  const preview = $("img-preview"), ph = $("img-placeholder"), drop = $("img-drop");
  if (editorImage) {
    preview.src = editorImage;
    preview.hidden = false;
    ph.hidden = true;
    drop.style.background = "";
    $("img-remove-btn").hidden = false;
  } else {
    preview.hidden = true;
    ph.hidden = false;
    $("editor-emoji-big").innerHTML = icon(editorIcon);
    drop.style.background = editorColor || "";
    ph.style.color = editorColor ? "#fff" : "";
    $("img-remove-btn").hidden = true;
  }
}

function openBotEditor(botId) {
  editingBotId = botId || null;
  const bot = botId ? DB.bot(botId) : null;

  $("bot-modal-title").textContent = bot ? "Edit Bot" : "Create a Bot";
  $("bot-name").value = bot ? bot.name : "";
  $("bot-tagline").value = bot ? (bot.tagline || "") : "";
  $("bot-prompt").value = bot ? (bot.prompt || "") : "";
  $("bot-greeting").value = bot ? (bot.greeting || "") : "";
  $("bot-temp").value = bot ? (bot.temp ?? 0.8) : 0.8;
  $("temp-val").textContent = $("bot-temp").value;
  $("bot-traits").value = bot ? (bot.traits || "") : "";
  $("bot-backstory").value = bot ? (bot.backstory || "") : "";
  $("bot-speechstyle").value = bot ? (bot.speechStyle || "") : "";
  $("bot-likes").value = bot ? (bot.likes || "") : "";
  $("bot-dislikes").value = bot ? (bot.dislikes || "") : "";
  $("bot-scenario").value = bot ? (bot.scenario || "") : "";
  $("bot-example").value = bot ? (bot.example || "") : "";
  $("bot-topp").value = bot ? (bot.topP ?? 1) : 1;
  $("topp-val").textContent = $("bot-topp").value;
  $("bot-nickname").value = bot ? (bot.nickname || "") : "";
  $("bot-adv").open = !!(bot && (bot.scenario || bot.example || bot.nickname || bot.traits ||
    bot.backstory || bot.speechStyle || bot.likes || bot.dislikes || (bot.topP != null && bot.topP < 1)));

  editorIcon = bot ? (bot.icon || "bot") : AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)];
  editorImage = bot ? (bot.image || null) : null;
  editorColor = bot ? (bot.color || "") : "";

  $("bot-delete-btn").hidden = !bot;
  $("bot-duplicate-btn").hidden = !bot;
  $("bot-export-btn").hidden = !bot;

  buildIconGrid();
  buildColorSwatches();
  buildCategorySelect(bot ? (bot.category || "uncategorized") : "uncategorized");
  updateEditorPreview();
  updatePromptPreview();
  $("bot-modal").classList.add("open");
  $("bot-name").focus();
}

function closeBotEditor() { $("bot-modal").classList.remove("open"); }

/* ---------- image upload / resize ---------- */
function processImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const MAX = 640;
    let w = img.width, h = img.height;
    const scale = Math.min(1, MAX / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#1a1e29"; // transparent PNGs get a dark backing
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    editorImage = c.toDataURL("image/jpeg", 0.85);
    URL.revokeObjectURL(url);
    updateEditorPreview();
    toast("Image added — it'll be the bot's cover and avatar");
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("Couldn't read that image"); };
  img.src = url;
}

function wireBotEditor() {
  /* icon labels on static buttons */
  $("img-upload-btn").innerHTML = icon("image") + "<span>Upload</span>";
  $("img-remove-btn").innerHTML = icon("x", null, true) + "<span>Remove</span>";
  $("bot-delete-btn").innerHTML = icon("trash", null, true) + "<span>Delete</span>";
  $("bot-duplicate-btn").innerHTML = icon("copy") + "<span>Duplicate</span>";
  $("bot-export-btn").innerHTML = icon("share") + "<span>Share</span>";

  $("bot-temp").addEventListener("input", e => $("temp-val").textContent = e.target.value);
  $("bot-topp").addEventListener("input", e => $("topp-val").textContent = e.target.value);

  $("category-manage-btn").innerHTML = icon("settings");
  $("category-manage-btn").title = "Manage categories";
  $("category-manage-btn").onclick = openCategoryManager;

  const previewFields = ["bot-prompt", "bot-traits", "bot-backstory", "bot-speechstyle",
    "bot-likes", "bot-dislikes", "bot-scenario", "bot-example", "bot-nickname"];
  for (const id of previewFields) $(id).addEventListener("input", updatePromptPreview);

  const drop = $("img-drop");
  drop.onclick = () => $("bot-img-input").click();
  $("img-upload-btn").onclick = () => $("bot-img-input").click();
  $("bot-img-input").addEventListener("change", e => {
    processImageFile(e.target.files[0]);
    e.target.value = "";
  });
  $("img-remove-btn").onclick = e => {
    e.stopPropagation();
    editorImage = null;
    updateEditorPreview();
  };

  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("dragover"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
  drop.addEventListener("drop", e => {
    e.preventDefault();
    drop.classList.remove("dragover");
    processImageFile(e.dataTransfer.files[0]);
  });

  $("bot-cancel-btn").onclick = closeBotEditor;
  $("bot-save-btn").onclick = saveBotFromEditor;

  /* Ctrl/Cmd+Enter saves from anywhere in the editor */
  $("bot-modal").addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveBotFromEditor(); }
  });
  $("bot-delete-btn").onclick = deleteBotFromEditor;
  $("bot-duplicate-btn").onclick = duplicateBotFromEditor;
  $("bot-export-btn").onclick = exportBotFromEditor;
}

function saveBotFromEditor() {
  const name = $("bot-name").value.trim();
  if (!name) { $("bot-name").focus(); toast("Give your bot a name!"); return; }
  const data = {
    name,
    tagline: $("bot-tagline").value.trim(),
    prompt: $("bot-prompt").value.trim(),
    greeting: $("bot-greeting").value.trim(),
    temp: parseFloat($("bot-temp").value),
    category: $("bot-category").value || "uncategorized",
    traits: $("bot-traits").value.trim(),
    backstory: $("bot-backstory").value.trim(),
    speechStyle: $("bot-speechstyle").value.trim(),
    likes: $("bot-likes").value.trim(),
    dislikes: $("bot-dislikes").value.trim(),
    scenario: $("bot-scenario").value.trim(),
    example: $("bot-example").value.trim(),
    topP: parseFloat($("bot-topp").value),
    nickname: $("bot-nickname").value.trim(),
    icon: editorIcon,
    image: editorImage,
    color: editorColor
  };
  if (editingBotId) {
    Object.assign(DB.bot(editingBotId), data);
    DB.saveBots();
    closeBotEditor();
    toast("Bot updated");
    refreshAll();
    if (State.view === "chat" && State.botId === editingBotId) renderChatHeader();
  } else {
    data.id = uid("bot");
    data.createdAt = Date.now();
    data.favorite = false;
    DB.bots.push(data);
    DB.saveBots();
    closeBotEditor();
    toast("Bot created — say hi!");
    openBotChat(data.id);
  }
}

function deleteBotFromEditor() {
  if (!editingBotId) return;
  const bot = DB.bot(editingBotId);
  if (!confirm('Delete "' + bot.name + '" and ALL of its chats? This cannot be undone.')) return;
  DB.deleteBot(editingBotId);
  if (State.botId === editingBotId) goHome();
  closeBotEditor();
  toast("Bot deleted");
  refreshAll();
}

function duplicateBotFromEditor() {
  if (!editingBotId) return;
  const src = DB.bot(editingBotId);
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid("bot");
  copy.name = src.name + " (copy)";
  copy.createdAt = Date.now();
  copy.favorite = false;
  DB.bots.push(copy);
  DB.saveBots();
  closeBotEditor();
  toast("Duplicated — editing the copy");
  refreshAll();
  openBotEditor(copy.id);
}

function exportBotFromEditor() {
  if (!editingBotId) return;
  const bot = DB.bot(editingBotId);
  downloadJson({ type: "botforge-bot", bot },
    bot.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() + ".botforge.json");
  toast("Bot saved as a file — share it with friends!");
}

/* ---------- category manager modal ---------- */
function openCategoryManager() {
  renderCategoryList();
  $("category-modal").classList.add("open");
  $("category-new-name").value = "";
}

function closeCategoryManager() {
  $("category-modal").classList.remove("open");
  buildCategorySelect($("bot-category").value);
}

function renderCategoryList() {
  const list = $("category-list");
  list.innerHTML = "";
  for (const cat of DB.categories) {
    const row = el("div", "category-row-item");
    const input = document.createElement("input");
    input.type = "text";
    input.value = cat.name;
    input.maxLength = 40;
    input.addEventListener("change", () => {
      if (input.value.trim()) DB.renameCategory(cat.id, input.value);
      else input.value = cat.name;
    });
    row.appendChild(input);
    const count = DB.bots.filter(b => b.category === cat.id).length;
    row.appendChild(el("span", "category-count", count + (count === 1 ? " bot" : " bots")));
    const del = iconBtn("trash", "btn sm danger icon-only", "Delete category", null, true);
    del.onclick = () => {
      if (count && !confirm('Delete "' + cat.name + '"? ' + count + ' bot(s) will become Uncategorized.')) return;
      DB.deleteCategory(cat.id);
      renderCategoryList();
      refreshAll();
    };
    row.appendChild(del);
    list.appendChild(row);
  }
}

function wireCategoryManager() {
  $("category-add-btn").innerHTML = icon("plus", null, true) + "<span>Add</span>";
  $("category-add-btn").onclick = () => {
    const name = $("category-new-name").value.trim();
    if (!name) return;
    DB.addCategory(name);
    $("category-new-name").value = "";
    renderCategoryList();
  };
  $("category-new-name").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); $("category-add-btn").click(); }
  });
  $("category-done-btn").onclick = closeCategoryManager;
}
