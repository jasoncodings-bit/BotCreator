"use strict";
/* ============================================================
   Home view: bot gallery cards
   ============================================================ */

function lastActivity(bot) {
  const ss = DB.botSessions(bot.id);
  return ss.length ? ss[0].updatedAt : (bot.createdAt || 0);
}

function renderHome() {
  const wrap = $("home-sections");
  wrap.innerHTML = "";
  const q = ($("home-search").value || "").trim().toLowerCase();

  const matches = bot => !q || (bot.name + " " + (bot.tagline || "")).toLowerCase().includes(q);
  const sortByActivity = list => list.slice().sort((a, b) => lastActivity(b) - lastActivity(a));

  const createCard = () => {
    const create = el("div", "bot-card create-card");
    const inner = el("div", "create-inner");
    const plus = el("div", "plus");
    plus.innerHTML = icon("plus", null, true);
    inner.appendChild(plus);
    inner.appendChild(el("div", "", "Create a Bot"));
    inner.appendChild(el("div", "sub", "Forge a brand new character"));
    create.appendChild(inner);
    create.onclick = () => openBotEditor(null);
    return create;
  };

  const favorites = sortByActivity(DB.bots.filter(b => b.favorite && matches(b)));
  const favSection = el("section", "home-section");
  favSection.appendChild(el("h3", "home-section-title", "★ Favourites"));
  const favGrid = el("div", "bot-grid");
  if (!q) favGrid.appendChild(createCard());
  for (const bot of favorites) favGrid.appendChild(botCard(bot));
  favSection.appendChild(favGrid);
  if (favorites.length || !q) wrap.appendChild(favSection);

  const cats = DB.categories.concat([{ id: "uncategorized", name: "Uncategorized" }]);
  for (const cat of cats) {
    const bots = sortByActivity(DB.bots.filter(b => (b.category || "uncategorized") === cat.id && matches(b)));
    if (!bots.length) continue;
    const section = el("section", "home-section");
    section.appendChild(el("h3", "home-section-title", cat.name));
    const grid = el("div", "bot-grid");
    for (const bot of bots) grid.appendChild(botCard(bot));
    section.appendChild(grid);
    wrap.appendChild(section);
  }

  if (!favorites.length && !cats.some(cat => DB.bots.some(b => (b.category || "uncategorized") === cat.id && matches(b))) && q) {
    wrap.appendChild(el("div", "home-empty", "No bots match your search"));
  }
}

function botCard(bot) {
  const card = el("div", "bot-card");

  const cover = el("div", "card-cover");
  if (bot.image) {
    const img = el("img");
    img.src = bot.image;
    img.alt = "";
    cover.appendChild(img);
  } else {
    cover.style.background = botColor(bot);
    const big = el("div", "cover-icon");
    big.innerHTML = icon(bot.icon || "bot");
    cover.appendChild(big);
  }
  const fav = iconBtn("star", "card-favorite" + (bot.favorite ? " active" : ""),
    bot.favorite ? "Remove from favourites" : "Add to favourites", null, true);
  fav.onclick = e => { e.stopPropagation(); DB.toggleFavorite(bot.id); renderHome(); };
  cover.appendChild(fav);
  const edit = iconBtn("edit", "card-edit", "Edit bot");
  edit.onclick = e => { e.stopPropagation(); openBotEditor(bot.id); };
  cover.appendChild(edit);
  card.appendChild(cover);

  const body = el("div", "card-body");
  body.appendChild(el("div", "card-name", bot.name));
  body.appendChild(el("div", "card-tag", bot.tagline || ""));

  const foot = el("div", "card-foot");
  const n = DB.botSessions(bot.id).length;
  foot.appendChild(el("span", "card-chats", n ? n + (n === 1 ? " chat" : " chats") : "No chats yet"));
  const btn = iconBtn("chat", "card-chat-btn", "Chat with " + bot.name, "Chat");
  btn.onclick = e => { e.stopPropagation(); openBotChat(bot.id); };
  foot.appendChild(btn);
  body.appendChild(foot);
  card.appendChild(body);

  card.onclick = () => openBotChat(bot.id);
  return card;
}
