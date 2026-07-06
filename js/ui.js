"use strict";
/* ============================================================
   Small DOM / UI helpers: toasts, avatars, time formatting
   ============================================================ */

const $ = id => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let _toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 604800) return Math.floor(s / 86400) + "d";
  return new Date(ts).toLocaleDateString();
}

/* stable hue per bot for gradient fallback avatars/covers */
function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

/* flat accent color for a bot: chosen swatch or a stable hash color */
function botColor(bot) {
  if (bot.color) return bot.color;
  return "hsl(" + hashHue(bot.id) + ",50%,42%)";
}

function avatarNode(bot, sizeCls) {
  const d = el("div", "avatar" + (sizeCls ? " " + sizeCls : ""));
  if (bot.image) {
    const img = el("img");
    img.src = bot.image;
    img.alt = "";
    d.appendChild(img);
  } else {
    d.style.background = botColor(bot);
    d.innerHTML = icon(bot.icon || "bot");
  }
  return d;
}

function copyText(text) {
  const done = () => toast("Copied to clipboard");
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => legacyCopy(text, done));
  } else {
    legacyCopy(text, done);
  }
}
function legacyCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch { toast("Copy failed"); }
  ta.remove();
}

function downloadJson(obj, filename) {
  downloadBlob(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }), filename);
}
function downloadText(text, filename, mime) {
  downloadBlob(new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" }), filename);
}
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/* filesystem-safe slug for filenames */
function slugify(s) {
  return (s || "chat").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "chat";
}

/* resizes/compresses an image file down to a JPEG data URL, same approach
   as the bot editor's avatar upload (js/bots.js) — keeps chat image
   attachments small for localStorage and for the vision model payload */
function resizeImageFile(file, maxDim) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) { reject(new Error("Not an image")); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#1a1e29";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image")); };
    img.src = url;
  });
}
