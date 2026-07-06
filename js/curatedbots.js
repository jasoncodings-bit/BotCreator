"use strict";
/* ============================================================
   Curated Bots: auto-syncs .botforge.json files from
   github.com/jasoncodings-bit/BotCreator/Bots on every app load
   into a standing "Curated Bots" category (js/storage.js seeds
   the category itself). Each file is tracked by its GitHub path
   (`curatedSource`) and blob sha (`curatedSha`) on the imported
   bot record, so re-syncing only adds bots that are genuinely new
   and re-imports ones whose file changed since last sync — it
   never duplicates an unchanged bot. Runs silently; a failed or
   offline fetch is a no-op; there is no "no internet" toast, since
   this is a nice-to-have background sync, not a user-requested action.
   ============================================================ */

const CURATED_BOTS_REPO_API = "https://api.github.com/repos/jasoncodings-bit/BotCreator/contents/Bots";

async function syncCuratedBots() {
  let listing;
  try {
    const r = await fetch(CURATED_BOTS_REPO_API, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return;
    listing = await r.json();
  } catch { return; }
  if (!Array.isArray(listing)) return;

  const jsonFiles = listing.filter(f => f.type === "file" && /\.json$/i.test(f.name));
  let changed = false;

  for (const file of jsonFiles) {
    const existing = DB.bots.find(b => b.curatedSource === file.path);
    if (existing && existing.curatedSha === file.sha) continue; // unchanged, already have it

    let data;
    try {
      const r = await fetch(file.download_url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      data = await r.json();
    } catch { continue; }
    if (!data || data.type !== "botforge-bot" || !data.bot || !data.bot.name) continue;

    const bot = data.bot;
    bot.category = "curated-bots";
    bot.curatedSource = file.path;
    bot.curatedSha = file.sha;

    if (existing) {
      bot.id = existing.id;
      bot.createdAt = existing.createdAt;
      bot.favorite = existing.favorite;
      Object.assign(existing, bot);
    } else {
      bot.id = uid("bot");
      bot.createdAt = Date.now();
      bot.favorite = false;
      DB.bots.push(bot);
    }
    changed = true;
  }

  if (changed) {
    DB.saveBots();
    if (State.view === "home") renderHome();
  }
}
