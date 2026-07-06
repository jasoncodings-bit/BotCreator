"use strict";
/* ============================================================
   Settings modal: server, model list, persona manager,
   backup export/import, full reset
   ============================================================ */

/* working copy of personas while the modal is open */
let workPersonas = [];
let workSelected = "";   // id of persona currently shown in the fields

function openSettings() {
  $("set-url").value = DB.settings.url;
  $("set-maxtok").value = DB.settings.maxTokens;
  $("maxtok-val").textContent = DB.settings.maxTokens;
  $("set-autocontinue").checked = !!DB.settings.autoContinue;
  $("set-darkmode").checked = DB.settings.theme === "dark";
  $("set-dyslexiafont").checked = !!DB.settings.dyslexiaFont;
  $("settings-test-result").textContent = "";
  $("settings-test-result").className = "";

  workPersonas = JSON.parse(JSON.stringify(DB.settings.personas || []));
  workSelected = DB.settings.activePersona || "";
  renderPersonaUI();

  populateModelSelect(DB.settings.model ? [DB.settings.model] : []);
  refreshModels(false);
  $("settings-modal").classList.add("open");
}

function closeSettings() { $("settings-modal").classList.remove("open"); }

/* ---------- persona manager ---------- */

function workPersona(id) { return workPersonas.find(p => p.id === id); }

function commitPersonaFields() {
  const p = workPersona(workSelected);
  if (!p) return;
  p.name = $("persona-name").value.trim() || "Unnamed";
  p.desc = $("persona-desc").value.trim();
}

function renderPersonaUI() {
  const sel = $("persona-select");
  sel.innerHTML = "";
  const none = el("option", "", "(no persona — bots know nothing about you)");
  none.value = "";
  sel.appendChild(none);
  for (const p of workPersonas) {
    const o = el("option", "", p.name);
    o.value = p.id;
    sel.appendChild(o);
  }
  sel.value = workPersona(workSelected) ? workSelected : "";
  workSelected = sel.value;

  const p = workPersona(workSelected);
  $("persona-name").value = p ? p.name : "";
  $("persona-desc").value = p ? p.desc : "";
  $("persona-fields").classList.toggle("disabled", !p);
  $("persona-del-btn").disabled = !p;
}

function wirePersonaUI() {
  $("persona-select").addEventListener("change", e => {
    commitPersonaFields();
    workSelected = e.target.value;
    renderPersonaUI();
  });
  $("persona-add-btn").onclick = () => {
    commitPersonaFields();
    const p = { id: uid("p"), name: "New persona", desc: "" };
    workPersonas.push(p);
    workSelected = p.id;
    renderPersonaUI();
    $("persona-name").focus();
    $("persona-name").select();
  };
  $("persona-del-btn").onclick = () => {
    const p = workPersona(workSelected);
    if (!p) return;
    if (!confirm('Delete persona "' + p.name + '"?')) return;
    workPersonas = workPersonas.filter(x => x.id !== p.id);
    workSelected = workPersonas.length ? workPersonas[0].id : "";
    renderPersonaUI();
  };
}

/* ---------- server / model ---------- */

function populateModelSelect(ids) {
  const sel = $("set-model");
  sel.innerHTML = "";
  const auto = el("option", "", "(auto — server default)");
  auto.value = "";
  sel.appendChild(auto);
  for (const id of ids) {
    const o = el("option", "", id);
    o.value = id;
    sel.appendChild(o);
  }
  sel.value = ids.includes(DB.settings.model) ? DB.settings.model : "";
}

async function refreshModels(showResult) {
  const url = $("set-url").value.trim() || DB.settings.url;
  const res = $("settings-test-result");
  if (showResult) { res.textContent = "Connecting…"; res.className = ""; }
  try {
    const ids = await fetchModelList(url);
    populateModelSelect(ids);
    res.textContent = "Connected" + (ids.length ? " — " + ids.length + " model(s) found" : " — no model list (that's OK)");
    res.className = "ok";
  } catch (e) {
    if (showResult) {
      res.textContent = "Could not reach server (" + e.message + ")";
      res.className = "fail";
    }
  }
}

function saveSettingsFromModal() {
  commitPersonaFields();
  DB.settings.url = ($("set-url").value.trim() || DEFAULT_SETTINGS.url).replace(/\/+$/, "");
  DB.settings.model = $("set-model").value;
  DB.settings.maxTokens = parseInt($("set-maxtok").value, 10) || 1024;
  DB.settings.autoContinue = $("set-autocontinue").checked;
  DB.settings.theme = $("set-darkmode").checked ? "dark" : "light";
  DB.settings.dyslexiaFont = $("set-dyslexiafont").checked;
  DB.settings.personas = workPersonas;
  DB.settings.activePersona = $("persona-select").value;
  DB.saveSettings();
  applyTheme();
  applyDyslexiaFont();
  closeSettings();
  toast("Settings saved");
  checkConnection();
}

function applyDyslexiaFont() {
  document.body.classList.toggle("dyslexia-font", !!DB.settings.dyslexiaFont);
}

/* ---------- backup / restore ---------- */

function exportBackup() {
  const data = {
    type: "botforge-backup",
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: DB.settings,
    bots: DB.bots,
    sessions: DB.sessions,
    msgs: {}
  };
  for (const s of DB.sessions) data.msgs[s.id] = DB.getMsgs(s.id);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadJson(data, "botforge-backup-" + stamp + ".json");
  toast("Backup downloaded");
}

function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); }
    catch { toast("That file isn't valid JSON"); return; }

    /* single shared bot */
    if (data && data.type === "botforge-bot" && data.bot && data.bot.name) {
      const bot = data.bot;
      bot.id = uid("bot");
      bot.createdAt = Date.now();
      DB.bots.push(bot);
      DB.saveBots();
      toast('Imported bot "' + bot.name + '"');
      refreshAll();
      return;
    }

    /* full backup */
    if (data && Array.isArray(data.bots)) {
      if (!confirm("Restore this backup? It will REPLACE all current bots, chats and settings.")) return;
      for (const s of DB.sessions) Store.del(K.msgs(s.id));
      Store.set(K.settings, Object.assign({}, DEFAULT_SETTINGS, data.settings || {}));
      Store.set(K.bots, data.bots);
      Store.set(K.sessions, Array.isArray(data.sessions) ? data.sessions : []);
      if (data.msgs) {
        for (const sid of Object.keys(data.msgs)) Store.set(K.msgs(sid), data.msgs[sid]);
      }
      location.reload();
      return;
    }

    toast("Unrecognized file — expected a Bot Master backup or bot file");
  };
  reader.readAsText(file);
}

function resetEverything() {
  if (!confirm("Reset EVERYTHING? All bots, chats and settings will be deleted.")) return;
  if (!confirm("Really sure? There is no undo. (Tip: export a backup first!)")) return;
  const mine = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("bf2_")) mine.push(k);
  }
  mine.forEach(k => localStorage.removeItem(k));
  location.reload();
}

function wireSettings() {
  $("settings-btn").onclick = openSettings;
  $("settings-cancel-btn").onclick = closeSettings;
  $("settings-save-btn").onclick = saveSettingsFromModal;
  $("refresh-models-btn").onclick = () => refreshModels(true);
  $("set-maxtok").addEventListener("input", e => $("maxtok-val").textContent = e.target.value);
  $("export-btn").onclick = exportBackup;
  $("import-btn").onclick = () => $("import-input").click();
  $("import-input").addEventListener("change", e => {
    importFile(e.target.files[0]);
    e.target.value = "";
  });
  $("reset-btn").onclick = resetEverything;
  wirePersonaUI();
}
